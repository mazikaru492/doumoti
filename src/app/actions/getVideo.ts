"use server";

import "server-only";
import {
  canWatchFull,
  getOrCreatePreviewWindow,
  getOrCreateUserByAuthId,
  getVideoByIdForBff,
  toAppPlan,
  type SubscriptionTier,
} from "@/lib/db";
import {
  issuePlaybackToken,
  type PlaybackQuality,
} from "@/lib/playback-access";

const NORMAL_PREVIEW_SECONDS = 60;

type VideoPayload = {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  minimumRequiredTier: SubscriptionTier;
};

type SuccessResponse = {
  ok: true;
  video: VideoPayload;
  access: {
    mode: "FULL" | "PREVIEW";
    streamUrl: string;
    expiresAt: number;
    userTier: SubscriptionTier;
    minimumRequiredTier: SubscriptionTier;
    remainingPreviewSeconds: number | null;
  };
};

type ErrorResponse = {
  ok: false;
  code: "BAD_REQUEST" | "NOT_FOUND" | "PREVIEW_EXPIRED" | "UPGRADE_REQUIRED";
  message: string;
};

export type GetVideoActionResult = SuccessResponse | ErrorResponse;

export async function getVideoAction(params: {
  videoId: string;
  authId: string;
  email: string;
}): Promise<GetVideoActionResult> {
  if (!params.videoId || !params.authId || !params.email) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: "videoId, authId, email are required",
    };
  }

  const user = await getOrCreateUserByAuthId({
    authId: params.authId,
    email: params.email,
  });

  const video = await getVideoByIdForBff(params.videoId);
  if (!video || !video.is_published) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Video not found",
    };
  }

  const payload: VideoPayload = {
    id: video.id,
    title: video.title,
    description: video.description,
    thumbnailUrl: video.thumbnail_url,
    minimumRequiredTier: video.minimum_required_tier,
  };

  const userTier = user.subscription_tier;
  const requiredTier = video.minimum_required_tier;

  if (canWatchFull(userTier, requiredTier)) {
    const quality: PlaybackQuality = userTier === "VIP" ? "hd" : "sd";
    const { token, expiresAt } = issuePlaybackToken({
      userId: user.id,
      videoId: video.id,
      plan: toAppPlan(userTier),
      quality,
      ttlSeconds: 60 * 10,
    });

    return {
      ok: true,
      video: payload,
      access: {
        mode: "FULL",
        streamUrl: `/api/video/${video.id}/stream?token=${encodeURIComponent(token)}`,
        expiresAt,
        userTier,
        minimumRequiredTier: requiredTier,
        remainingPreviewSeconds: null,
      },
    };
  }

  // Threat model rule: NORMAL users can get only one fixed 60-second preview window.
  if (userTier === "NORMAL") {
    const previewWindow = await getOrCreatePreviewWindow({
      userId: user.id,
      videoId: video.id,
      windowSeconds: NORMAL_PREVIEW_SECONDS,
    });

    if (previewWindow.remainingSeconds <= 0) {
      return {
        ok: false,
        code: "PREVIEW_EXPIRED",
        message: "Preview window expired. Upgrade to continue watching.",
      };
    }

    const { token, expiresAt } = issuePlaybackToken({
      userId: user.id,
      videoId: video.id,
      plan: "normal",
      quality: "sd",
      ttlSeconds: Math.min(previewWindow.remainingSeconds, 60),
      previewWindowEndSec: previewWindow.endsAtEpochSec,
    });

    return {
      ok: true,
      video: payload,
      access: {
        mode: "PREVIEW",
        streamUrl: `/api/video/${video.id}/stream?token=${encodeURIComponent(token)}`,
        expiresAt,
        userTier,
        minimumRequiredTier: requiredTier,
        remainingPreviewSeconds: previewWindow.remainingSeconds,
      },
    };
  }

  return {
    ok: false,
    code: "UPGRADE_REQUIRED",
    message: "Your current plan does not allow this video. Upgrade required.",
  };
}
