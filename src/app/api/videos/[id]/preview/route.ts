import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { verifyVideoUrl } from "@/utils/video-signer";
import {
  getAllowedVideoHosts,
  validateVideoSourceUrl,
} from "@/utils/env-config";

export const runtime = "nodejs";

const PREVIEW_SECONDS = 60;
const MP4_MAX_BYTES = 24 * 1024 * 1024;

type Tier = "NORMAL" | "GENERAL" | "VIP";

type VideoRow = {
  id: string;
  video_source_url: string;
};

type ProfileRow = {
  subscription_tier: Tier;
};

interface Params {
  params: Promise<{ id: string }>;
}

function isSafeVideoId(videoId: string): boolean {
  return /^[a-f0-9-]{36}$/i.test(videoId);
}

function isTier(value: string | null | undefined): value is Tier {
  return value === "NORMAL" || value === "GENERAL" || value === "VIP";
}

function isM3u8Path(sourceUrl: string): boolean {
  const pathname = new URL(sourceUrl).pathname.toLowerCase();
  return pathname.endsWith(".m3u8");
}

function parseExtInfDuration(line: string): number {
  const value = line.replace("#EXTINF:", "").split(",")[0]?.trim();
  const seconds = Number.parseFloat(value ?? "");
  return Number.isFinite(seconds) ? seconds : Number.NaN;
}

function toAbsoluteUrl(pathOrUrl: string, baseUrl: string): string {
  return new URL(pathOrUrl, baseUrl).toString();
}

function isMediaPlaylist(body: string): boolean {
  return body.includes("#EXTINF:");
}

function pickBestVariantUri(masterPlaylist: string): string | null {
  const lines = masterPlaylist.split(/\r?\n/);
  const variants: Array<{ uri: string; bandwidth: number }> = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = (lines[i] ?? "").trim();
    if (!line.startsWith("#EXT-X-STREAM-INF:")) {
      continue;
    }

    const bandwidth = Number.parseInt(
      line.match(/BANDWIDTH=(\d+)/)?.[1] ?? "0",
      10,
    );

    let nextUri: string | null = null;
    for (let j = i + 1; j < lines.length; j += 1) {
      const candidate = (lines[j] ?? "").trim();
      if (!candidate) {
        continue;
      }
      if (candidate.startsWith("#")) {
        continue;
      }
      nextUri = candidate;
      break;
    }

    if (nextUri) {
      variants.push({
        uri: nextUri,
        bandwidth: Number.isFinite(bandwidth) ? bandwidth : 0,
      });
    }
  }

  if (variants.length === 0) {
    return null;
  }

  variants.sort((a, b) => a.bandwidth - b.bandwidth);
  return variants[0]?.uri ?? null;
}

async function resolveHlsMediaPlaylist(sourceUrl: string): Promise<{
  mediaPlaylistUrl: string;
  mediaPlaylistBody: string;
}> {
  const masterResponse = await fetch(sourceUrl, {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.apple.mpegurl, application/x-mpegURL, */*",
    },
  });

  if (!masterResponse.ok) {
    throw new Error("hls-fetch-failed");
  }

  const body = await masterResponse.text();
  if (isMediaPlaylist(body)) {
    return {
      mediaPlaylistUrl: sourceUrl,
      mediaPlaylistBody: body,
    };
  }

  const variantUri = pickBestVariantUri(body);
  if (!variantUri) {
    throw new Error("variant-not-found");
  }

  const variantUrl = toAbsoluteUrl(variantUri, sourceUrl);
  const variantResponse = await fetch(variantUrl, {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.apple.mpegurl, application/x-mpegURL, */*",
    },
  });

  if (!variantResponse.ok) {
    throw new Error("variant-fetch-failed");
  }

  const variantBody = await variantResponse.text();
  if (!isMediaPlaylist(variantBody)) {
    throw new Error("media-playlist-required");
  }

  return {
    mediaPlaylistUrl: variantUrl,
    mediaPlaylistBody: variantBody,
  };
}

function buildTruncatedPlaylist(params: {
  mediaPlaylistUrl: string;
  mediaPlaylistBody: string;
  maxDurationSec: number;
}): string {
  const lines = params.mediaPlaylistBody.split(/\r?\n/);
  const out: string[] = [];

  let durationAcc = 0;
  let expectingSegmentUri = false;
  let includedAnySegment = false;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    const line = raw.trim();

    if (line.length === 0) {
      continue;
    }

    if (line.startsWith("#EXT-X-ENDLIST")) {
      continue;
    }

    if (line.startsWith("#EXTINF:")) {
      const segmentDuration = parseExtInfDuration(line);
      if (!Number.isFinite(segmentDuration)) {
        continue;
      }

      if (durationAcc + segmentDuration > params.maxDurationSec) {
        break;
      }

      out.push(raw);
      durationAcc += segmentDuration;
      expectingSegmentUri = true;
      includedAnySegment = true;
      continue;
    }

    if (expectingSegmentUri) {
      if (line.startsWith("#")) {
        out.push(raw);
        continue;
      }

      out.push(toAbsoluteUrl(line, params.mediaPlaylistUrl));
      expectingSegmentUri = false;
      continue;
    }

    if (line.startsWith("#")) {
      out.push(raw);
    }
  }

  if (!includedAnySegment) {
    throw new Error("preview-segments-not-found");
  }

  out.push("#EXT-X-ENDLIST");
  return out.join("\n");
}

function clampRangeHeader(rangeHeader: string | null): {
  start: number;
  end: number;
  partial: boolean;
} {
  const defaultEnd = MP4_MAX_BYTES - 1;

  if (!rangeHeader) {
    return {
      start: 0,
      end: defaultEnd,
      partial: true,
    };
  }

  const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/i);
  if (!match) {
    return {
      start: 0,
      end: defaultEnd,
      partial: true,
    };
  }

  const start = Number.parseInt(match[1] ?? "0", 10);
  const rawEnd = match[2];
  const end = rawEnd ? Number.parseInt(rawEnd, 10) : defaultEnd;

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return {
      start: 0,
      end: defaultEnd,
      partial: true,
    };
  }

  const safeStart = Math.max(0, Math.min(start, defaultEnd));
  const safeEnd = Math.max(safeStart, Math.min(end, defaultEnd));

  return {
    start: safeStart,
    end: safeEnd,
    partial: true,
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!isSafeVideoId(id)) {
    return NextResponse.json({ error: "INVALID_VIDEO_ID" }, { status: 400 });
  }

  let allowedHosts: readonly string[];
  try {
    allowedHosts = getAllowedVideoHosts();
  } catch {
    return NextResponse.json(
      { error: "SERVER_MISCONFIGURED_ALLOWLIST" },
      { status: 500 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  let userTier: Tier = "NORMAL";
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (!profileError && isTier(profile?.subscription_tier)) {
    userTier = profile.subscription_tier;
  }

  if (userTier !== "NORMAL") {
    return NextResponse.json(
      {
        error: "PREVIEW_NOT_ALLOWED_FOR_PLAN",
      },
      { status: 403 },
    );
  }

  const check = verifyVideoUrl({
    videoId: id,
    userId: user.id,
    expiresRaw: request.nextUrl.searchParams.get("expires"),
    signatureRaw: request.nextUrl.searchParams.get("signature"),
  });

  if (!check.ok) {
    return NextResponse.json(
      { error: "INVALID_PREVIEW_SIGNATURE", reason: check.reason },
      { status: 403 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: video, error: videoError } = await admin
    .from("videos")
    .select("id,video_source_url")
    .eq("id", id)
    .maybeSingle<VideoRow>();

  if (videoError) {
    return NextResponse.json({ error: "VIDEO_LOOKUP_FAILED" }, { status: 500 });
  }

  if (!video) {
    return NextResponse.json({ error: "VIDEO_NOT_FOUND" }, { status: 404 });
  }

  const sourceValidation = validateVideoSourceUrl(video.video_source_url, {
    allowHttp: process.env.NODE_ENV !== "production",
    allowlist: allowedHosts,
  });

  if (!sourceValidation.ok) {
    return NextResponse.json({ error: "UNSAFE_UPSTREAM_URL" }, { status: 400 });
  }

  const upstreamUrl = sourceValidation.normalizedUrl;

  if (isM3u8Path(upstreamUrl)) {
    try {
      const { mediaPlaylistUrl, mediaPlaylistBody } =
        await resolveHlsMediaPlaylist(upstreamUrl);

      const truncated = buildTruncatedPlaylist({
        mediaPlaylistUrl,
        mediaPlaylistBody,
        maxDurationSec: PREVIEW_SECONDS,
      });

      return new NextResponse(truncated, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
          "X-Preview-Limit-Seconds": String(PREVIEW_SECONDS),
        },
      });
    } catch {
      return NextResponse.json(
        { error: "HLS_PREVIEW_BUILD_FAILED" },
        { status: 502 },
      );
    }
  }

  const limitedRange = clampRangeHeader(request.headers.get("range"));
  const upstreamResponse = await fetch(upstreamUrl, {
    cache: "no-store",
    headers: {
      Accept: "video/mp4,application/octet-stream,*/*",
      Range: `bytes=${limitedRange.start}-${limitedRange.end}`,
    },
  });

  if (!upstreamResponse.ok) {
    return NextResponse.json(
      { error: "UPSTREAM_FETCH_FAILED" },
      { status: 502 },
    );
  }

  const headers = new Headers();
  const contentType =
    upstreamResponse.headers.get("content-type") ?? "video/mp4";
  headers.set("Content-Type", contentType);

  const contentLength = upstreamResponse.headers.get("content-length");
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }

  const contentRange = upstreamResponse.headers.get("content-range");
  if (contentRange) {
    headers.set("Content-Range", contentRange);
  } else {
    headers.set(
      "Content-Range",
      `bytes ${limitedRange.start}-${limitedRange.end}/*`,
    );
  }

  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Preview-Limit-Bytes", String(MP4_MAX_BYTES));
  headers.set("X-Preview-Limit-Seconds", String(PREVIEW_SECONDS));

  return new NextResponse(upstreamResponse.body, {
    status: 206,
    headers,
  });
}
