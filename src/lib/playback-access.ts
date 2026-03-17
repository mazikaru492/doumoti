import crypto from "crypto";
import { getVideoById } from "@/lib/data";
import {
  canAccessHighQuality,
  defaultPlaybackQuality,
  isAdRequired,
  NORMAL_PREVIEW_SECONDS,
  type SubscriptionPlan,
} from "@/lib/subscription";
import { signClaims, verifyClaims } from "@/lib/security";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

export type PlaybackQuality = "sd" | "hd";

type PlaybackClaims = {
  sub: string;
  videoId: string;
  quality: PlaybackQuality;
  plan: SubscriptionPlan;
  previewLimitSec?: number;
  previewWindowEndSec?: number;
};

type AdSession = {
  adSessionId: string;
  userId: string;
  videoId: string;
  createdAt: number;
  expiresAt: number;
  consumed: boolean;
};

const adSessionStore = new Map<string, AdSession>();

async function streamCatalog(
  videoId: string,
): Promise<{ sd: string; hd: string }> {
  const video = await getVideoById(videoId);
  if (!video) {
    throw new Error("video-not-found");
  }

  // デモ実装ではSD/HDを同一オリジンで返す。実運用ではCDNの別品質URLを返す。
  return {
    sd: video.videoUrl,
    hd: video.videoUrl,
  };
}

export function issuePlaybackToken(params: {
  userId: string;
  videoId: string;
  plan: SubscriptionPlan;
  quality: PlaybackQuality;
  ttlSeconds?: number;
  previewWindowEndSec?: number;
}): { token: string; expiresAt: number } {
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds =
    params.ttlSeconds ?? (params.plan === "normal" ? 60 : 60 * 10);
  const previewLimitSec =
    params.plan === "normal" ? NORMAL_PREVIEW_SECONDS : undefined;

  const token = signClaims<PlaybackClaims>(
    {
      sub: params.userId,
      videoId: params.videoId,
      plan: params.plan,
      quality: params.quality,
      previewLimitSec,
      previewWindowEndSec: params.previewWindowEndSec,
    },
    {
      ttlSeconds,
      secret: "playback",
      purpose: "video-playback",
    },
  );

  return {
    token,
    expiresAt: now + ttlSeconds,
  };
}

export function verifyPlaybackToken(token: string): PlaybackClaims | null {
  return verifyClaims<PlaybackClaims>(token, {
    secret: "playback",
    expectedPurpose: "video-playback",
  });
}

export async function resolvePlayableSource(
  videoId: string,
  quality: PlaybackQuality,
): Promise<string> {
  const variants = await streamCatalog(videoId);
  return quality === "hd" ? variants.hd : variants.sd;
}

export async function buildEntitlement(params: {
  userId: string;
  videoId: string;
  plan: SubscriptionPlan;
}): Promise<{
  plan: SubscriptionPlan;
  adRequired: boolean;
  canAccessHighQuality: boolean;
  maxPreviewSeconds: number | null;
  playback:
    | {
        needsAdGrant: true;
        adSessionId: string;
      }
    | {
        needsAdGrant: false;
        defaultQuality: PlaybackQuality;
        sources: Partial<
          Record<PlaybackQuality, { url: string; expiresAt: number }>
        >;
      };
}> {
  const plan = params.plan;
  const adRequired = isAdRequired(plan);
  const defaultQuality = defaultPlaybackQuality(plan);

  if (adRequired) {
    const adSessionId = cryptoRandomId();
    adSessionStore.set(adSessionId, {
      adSessionId,
      userId: params.userId,
      videoId: params.videoId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000,
      consumed: false,
    });

    return {
      plan,
      adRequired,
      canAccessHighQuality: false,
      maxPreviewSeconds: null,
      playback: {
        needsAdGrant: true,
        adSessionId,
      },
    };
  }

  const sources: Partial<
    Record<PlaybackQuality, { url: string; expiresAt: number }>
  > = {};

  const sdSource = await buildSignedSource(
    params.userId,
    params.videoId,
    plan,
    "sd",
  );
  if (sdSource) {
    sources.sd = sdSource;
  }

  if (canAccessHighQuality(plan)) {
    const hdSource = await buildSignedSource(
      params.userId,
      params.videoId,
      plan,
      "hd",
    );
    if (hdSource) {
      sources.hd = hdSource;
    }
  }

  return {
    plan,
    adRequired,
    canAccessHighQuality: canAccessHighQuality(plan),
    maxPreviewSeconds: plan === "normal" ? NORMAL_PREVIEW_SECONDS : null,
    playback: {
      needsAdGrant: false,
      defaultQuality,
      sources,
    },
  };
}

export async function grantAdSessionPlayback(params: {
  adSessionId: string;
  userId: string;
  videoId: string;
  minimumWatchMs?: number;
}): Promise<{ url: string; expiresAt: number } | null> {
  const adSession = adSessionStore.get(params.adSessionId);
  if (!adSession) {
    return null;
  }
  if (adSession.consumed) {
    return null;
  }
  if (
    adSession.userId !== params.userId ||
    adSession.videoId !== params.videoId
  ) {
    return null;
  }
  if (Date.now() > adSession.expiresAt) {
    return null;
  }

  const minimumWatchMs = params.minimumWatchMs ?? 8000;
  const elapsed = Date.now() - adSession.createdAt;
  if (elapsed < minimumWatchMs) {
    return null;
  }

  adSessionStore.set(params.adSessionId, {
    ...adSession,
    consumed: true,
  });

  return buildSignedSource(params.userId, params.videoId, "general", "sd");
}

async function buildSignedSource(
  userId: string,
  videoId: string,
  plan: SubscriptionPlan,
  quality: PlaybackQuality,
): Promise<{ url: string; expiresAt: number } | null> {
  if (quality === "hd" && !canAccessHighQuality(plan)) {
    throw new Error("forbidden-quality");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  let ttlSeconds: number | undefined;
  let previewWindowEndSec: number | undefined;

  if (plan === "normal") {
    const endsAtSec = await getOrCreatePreviewWindowEndSec(userId, videoId);

    const remainingSec = endsAtSec - nowSec;
    if (remainingSec <= 0) {
      return null;
    }

    previewWindowEndSec = endsAtSec;
    ttlSeconds = Math.min(remainingSec, 60);
  }

  const { token, expiresAt } = issuePlaybackToken({
    userId,
    videoId,
    plan,
    quality,
    ttlSeconds,
    previewWindowEndSec,
  });

  return {
    url: `/api/video/${videoId}/stream?token=${encodeURIComponent(token)}`,
    expiresAt,
  };
}

async function getOrCreatePreviewWindowEndSec(
  userId: string,
  videoId: string,
): Promise<number> {
  const now = new Date();
  const defaultEndsAtSec =
    Math.floor(now.getTime() / 1000) + NORMAL_PREVIEW_SECONDS;
  const admin = createSupabaseAdminClient();

  await admin.from("preview_windows").upsert(
    {
      user_id: userId,
      video_id: videoId,
      window_started_at: now.toISOString(),
      window_ends_at: new Date(
        now.getTime() + NORMAL_PREVIEW_SECONDS * 1000,
      ).toISOString(),
    },
    {
      onConflict: "user_id,video_id",
      ignoreDuplicates: true,
    },
  );

  const { data, error } = await admin
    .from("preview_windows")
    .select("window_ends_at")
    .eq("user_id", userId)
    .eq("video_id", videoId)
    .maybeSingle<{ window_ends_at: string }>();

  if (error || !data?.window_ends_at) {
    return defaultEndsAtSec;
  }

  const endsAtMs = Date.parse(data.window_ends_at);
  if (!Number.isFinite(endsAtMs)) {
    return defaultEndsAtSec;
  }

  return Math.floor(endsAtMs / 1000);
}

function cryptoRandomId(): string {
  return crypto.randomUUID();
}
