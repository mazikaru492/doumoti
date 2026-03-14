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

export type PlaybackQuality = "sd" | "hd";

type PlaybackClaims = {
  sub: string;
  videoId: string;
  quality: PlaybackQuality;
  plan: SubscriptionPlan;
  previewLimitSec?: number;
};

type AdSession = {
  adSessionId: string;
  userId: string;
  videoId: string;
  createdAt: number;
  consumed: boolean;
};

const adSessionStore = new Map<string, AdSession>();

function streamCatalog(videoId: string): { sd: string; hd: string } {
  const video = getVideoById(videoId);
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
}): { token: string; expiresAt: number } {
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = params.plan === "normal" ? 60 : 60 * 10;
  const previewLimitSec =
    params.plan === "normal" ? NORMAL_PREVIEW_SECONDS : undefined;

  const token = signClaims<PlaybackClaims>(
    {
      sub: params.userId,
      videoId: params.videoId,
      plan: params.plan,
      quality: params.quality,
      previewLimitSec,
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

export function resolvePlayableSource(
  videoId: string,
  quality: PlaybackQuality,
): string {
  const variants = streamCatalog(videoId);
  return quality === "hd" ? variants.hd : variants.sd;
}

export function buildEntitlement(params: {
  userId: string;
  videoId: string;
  plan: SubscriptionPlan;
}): {
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
} {
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
  > = {
    sd: buildSignedSource(params.userId, params.videoId, plan, "sd"),
    hd: buildSignedSource(params.userId, params.videoId, plan, "hd"),
  };

  if (!canAccessHighQuality(plan)) {
    delete sources.hd;
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

export function grantAdSessionPlayback(params: {
  adSessionId: string;
  userId: string;
  videoId: string;
  minimumWatchMs?: number;
}): { url: string; expiresAt: number } | null {
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

function buildSignedSource(
  userId: string,
  videoId: string,
  plan: SubscriptionPlan,
  quality: PlaybackQuality,
): { url: string; expiresAt: number } {
  if (quality === "hd" && !canAccessHighQuality(plan)) {
    throw new Error("forbidden-quality");
  }

  const { token, expiresAt } = issuePlaybackToken({
    userId,
    videoId,
    plan,
    quality,
  });

  return {
    url: `/api/video/${videoId}/stream?token=${encodeURIComponent(token)}`,
    expiresAt,
  };
}

function cryptoRandomId(): string {
  return crypto.randomUUID();
}
