import { NextRequest, NextResponse } from "next/server";
import {
  resolvePlayableSource,
  verifyPlaybackToken,
} from "@/lib/playback-access";
import { signClaims, verifyClaims } from "@/lib/security";
import { NORMAL_PREVIEW_SECONDS } from "@/lib/subscription";
import { getAuthContextFromRequest } from "@/lib/session";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

type ResourceClaims = {
  sub: string;
  videoId: string;
  quality: "sd" | "hd";
  plan: "normal" | "general" | "vip";
  resourceUrl: string;
  resourceType: "segment" | "key" | "map";
};

const HLS_CONTENT_TYPE = "application/vnd.apple.mpegurl; charset=utf-8";

export async function GET(request: NextRequest, { params }: Params) {
  const segmentToken = request.nextUrl.searchParams.get("segmentToken");
  const { id } = await params;

  if (segmentToken) {
    return handleProtectedResource(request, id, segmentToken);
  }

  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json(
      { error: "Missing playback token" },
      { status: 401 },
    );
  }

  const claims = verifyPlaybackToken(token);
  if (!claims) {
    return NextResponse.json(
      { error: "Invalid or expired playback token" },
      { status: 401 },
    );
  }

  const auth = await getAuthContextFromRequest(request);
  if (auth.userId !== claims.sub) {
    return NextResponse.json(
      { error: "Playback token does not belong to this session" },
      { status: 403 },
    );
  }

  if (claims.videoId !== id) {
    return NextResponse.json(
      { error: "Token video mismatch" },
      { status: 403 },
    );
  }

  if (claims.quality === "hd" && claims.plan !== "vip") {
    return NextResponse.json(
      { error: "High quality requires VIP" },
      { status: 403 },
    );
  }

  if (
    claims.plan === "normal" &&
    typeof claims.previewWindowEndSec === "number" &&
    Math.floor(Date.now() / 1000) >= claims.previewWindowEndSec
  ) {
    return NextResponse.json(
      { error: "Preview window expired" },
      { status: 403 },
    );
  }

  const upstreamSource = await resolvePlayableSource(id, claims.quality);

  if (claims.plan === "normal") {
    if (!isM3u8Url(upstreamSource)) {
      // MP4等は正確な時間制限が困難なため、Normalでは配信を拒否する。
      return NextResponse.json(
        {
          error:
            "Normal preview is only available on HLS streams. This title requires upgrade.",
        },
        { status: 403 },
      );
    }

    try {
      const previewLimitSec =
        claims.previewLimitSec && claims.previewLimitSec > 0
          ? claims.previewLimitSec
          : NORMAL_PREVIEW_SECONDS;

      const { mediaPlaylistUrl, mediaPlaylistBody } =
        await resolveHlsMediaPlaylist(upstreamSource);

      const truncatedPlaylist = buildTruncatedProtectedPlaylist({
        videoId: id,
        userId: auth.userId,
        plan: claims.plan,
        quality: claims.quality,
        mediaPlaylistUrl,
        mediaPlaylistBody,
        maxDurationSec: previewLimitSec,
      });

      return new NextResponse(truncatedPlaylist, {
        status: 200,
        headers: {
          "Content-Type": HLS_CONTENT_TYPE,
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      return NextResponse.json(
        { error: "Failed to build secure preview playlist" },
        { status: 502 },
      );
    }
  }

  return NextResponse.redirect(upstreamSource, {
    status: 302,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

async function handleProtectedResource(
  request: NextRequest,
  videoId: string,
  segmentToken: string,
): Promise<NextResponse> {
  const claims = verifyClaims<ResourceClaims>(segmentToken, {
    secret: "playback",
    expectedPurpose: "video-resource",
  });

  if (!claims) {
    return NextResponse.json(
      { error: "Invalid or expired segment token" },
      { status: 401 },
    );
  }

  const auth = await getAuthContextFromRequest(request);
  if (auth.userId !== claims.sub) {
    return NextResponse.json(
      { error: "Segment token does not belong to this session" },
      { status: 403 },
    );
  }

  if (claims.videoId !== videoId || claims.plan !== "normal") {
    return NextResponse.json(
      { error: "Segment token scope mismatch" },
      { status: 403 },
    );
  }

  const upstreamResponse = await fetch(claims.resourceUrl, {
    cache: "no-store",
    headers: buildResourceHeaders(request),
  });

  if (!upstreamResponse.ok) {
    return NextResponse.json(
      { error: "Failed to load protected media resource" },
      { status: 502 },
    );
  }

  const headers = new Headers();
  const upstreamContentType = upstreamResponse.headers.get("content-type");
  if (upstreamContentType) {
    headers.set("Content-Type", upstreamContentType);
  }
  const contentLength = upstreamResponse.headers.get("content-length");
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }
  const contentRange = upstreamResponse.headers.get("content-range");
  if (contentRange) {
    headers.set("Content-Range", contentRange);
  }
  headers.set("Cache-Control", "private, no-store");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers,
  });
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

function buildTruncatedProtectedPlaylist(params: {
  videoId: string;
  userId: string;
  plan: "normal" | "general" | "vip";
  quality: "sd" | "hd";
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
        out.push(rewriteTagResourceIfNeeded(raw, params));
        continue;
      }

      out.push(
        buildProtectedResourcePath({
          resourceUrl: toAbsoluteUrl(line, params.mediaPlaylistUrl),
          resourceType: "segment",
          ...params,
        }),
      );
      expectingSegmentUri = false;
      continue;
    }

    if (line.startsWith("#")) {
      out.push(rewriteTagResourceIfNeeded(raw, params));
    }
  }

  if (!includedAnySegment) {
    throw new Error("preview-segments-not-found");
  }

  out.push("#EXT-X-ENDLIST");
  return out.join("\n");
}

function rewriteTagResourceIfNeeded(
  rawTagLine: string,
  params: {
    videoId: string;
    userId: string;
    plan: "normal" | "general" | "vip";
    quality: "sd" | "hd";
    mediaPlaylistUrl: string;
    maxDurationSec: number;
  },
): string {
  const uriMatch = rawTagLine.match(/URI="([^"]+)"/);
  if (!uriMatch?.[1]) {
    return rawTagLine;
  }

  const absolute = toAbsoluteUrl(uriMatch[1], params.mediaPlaylistUrl);
  const resourceType = rawTagLine.startsWith("#EXT-X-KEY")
    ? "key"
    : rawTagLine.startsWith("#EXT-X-MAP")
      ? "map"
      : "segment";

  const protectedPath = buildProtectedResourcePath({
    resourceUrl: absolute,
    resourceType,
    ...params,
  });

  return rawTagLine.replace(uriMatch[1], protectedPath);
}

function buildProtectedResourcePath(params: {
  videoId: string;
  userId: string;
  plan: "normal" | "general" | "vip";
  quality: "sd" | "hd";
  resourceUrl: string;
  resourceType: "segment" | "key" | "map";
  maxDurationSec: number;
}): string {
  const token = signClaims<ResourceClaims>(
    {
      sub: params.userId,
      videoId: params.videoId,
      quality: params.quality,
      plan: params.plan,
      resourceUrl: params.resourceUrl,
      resourceType: params.resourceType,
    },
    {
      // セグメント取得用トークンは短命にし、使い回しリスクを下げる。
      ttlSeconds: Math.max(75, Math.ceil(params.maxDurationSec) + 15),
      secret: "playback",
      purpose: "video-resource",
    },
  );

  return `/api/video/${params.videoId}/stream?segmentToken=${encodeURIComponent(token)}`;
}

function isM3u8Url(sourceUrl: string): boolean {
  const clean = sourceUrl.split("?")[0]?.toLowerCase() ?? "";
  return clean.endsWith(".m3u8");
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

function parseExtInfDuration(line: string): number {
  const value = line.replace("#EXTINF:", "").split(",")[0]?.trim();
  const seconds = Number.parseFloat(value ?? "");
  return Number.isFinite(seconds) ? seconds : Number.NaN;
}

function toAbsoluteUrl(pathOrUrl: string, baseUrl: string): string {
  return new URL(pathOrUrl, baseUrl).toString();
}

function buildResourceHeaders(request: NextRequest): HeadersInit {
  const range = request.headers.get("range");
  if (!range) {
    return {
      Accept: "*/*",
    };
  }

  return {
    Accept: "*/*",
    Range: range,
  };
}
