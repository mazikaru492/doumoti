import "server-only";
import { sql } from "@vercel/postgres";

export type SubscriptionTier = "NORMAL" | "GENERAL" | "VIP";
export type AppPlan = "normal" | "general" | "vip";

const TIER_RANK: Record<SubscriptionTier, number> = {
  NORMAL: 0,
  GENERAL: 1,
  VIP: 2,
};

export type DbUser = {
  id: string;
  auth_id: string;
  email: string;
  subscription_tier: SubscriptionTier;
};

export type DbVideo = {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  video_source_url: string;
  minimum_required_tier: SubscriptionTier;
  is_published: boolean;
};

export function canWatchFull(
  userTier: SubscriptionTier,
  requiredTier: SubscriptionTier,
): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
}

export function toAppPlan(tier: SubscriptionTier): AppPlan {
  switch (tier) {
    case "VIP":
      return "vip";
    case "GENERAL":
      return "general";
    default:
      return "normal";
  }
}

export async function getOrCreateUserByAuthId(params: {
  authId: string;
  email: string;
}): Promise<DbUser> {
  const upsert = await sql<DbUser>`
    INSERT INTO users (auth_id, email)
    VALUES (${params.authId}, ${params.email})
    ON CONFLICT (auth_id)
    DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = NOW()
    RETURNING id, auth_id, email, subscription_tier;
  `;

  if (!upsert.rows[0]) {
    throw new Error("user-upsert-failed");
  }

  return upsert.rows[0];
}

export async function getVideoByIdForBff(
  videoId: string,
): Promise<DbVideo | null> {
  const result = await sql<DbVideo>`
    SELECT
      id,
      title,
      description,
      thumbnail_url,
      video_source_url,
      minimum_required_tier,
      is_published
    FROM videos
    WHERE id = ${videoId}
    LIMIT 1;
  `;

  return result.rows[0] ?? null;
}

export async function getOrCreatePreviewWindow(params: {
  userId: string;
  videoId: string;
  windowSeconds: number;
}): Promise<{ endsAtEpochSec: number; remainingSeconds: number }> {
  await sql`
    INSERT INTO preview_windows (user_id, video_id, window_started_at, window_ends_at)
    VALUES (
      ${params.userId},
      ${params.videoId},
      NOW(),
      NOW() + (${params.windowSeconds} * INTERVAL '1 second')
    )
    ON CONFLICT (user_id, video_id)
    DO NOTHING;
  `;

  const result = await sql<{ window_ends_at: Date }>`
    SELECT window_ends_at
    FROM preview_windows
    WHERE user_id = ${params.userId}
      AND video_id = ${params.videoId}
    LIMIT 1;
  `;

  const window = result.rows[0];
  if (!window) {
    throw new Error("preview-window-not-found");
  }

  const endsAtMs = new Date(window.window_ends_at).getTime();
  const nowMs = Date.now();
  const remainingSeconds = Math.max(0, Math.floor((endsAtMs - nowMs) / 1000));

  return {
    endsAtEpochSec: Math.floor(endsAtMs / 1000),
    remainingSeconds,
  };
}
