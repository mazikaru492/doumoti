import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { signClaims } from "@/lib/security";

export const runtime = "nodejs";

const PREVIEW_SECONDS = 60;
const TIER_RANK = {
  NORMAL: 0,
  GENERAL: 1,
  VIP: 2,
} as const;

type Tier = keyof typeof TIER_RANK;

interface Params {
  params: Promise<{ id: string }>;
}

type VideoRow = {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  minimum_required_tier: Tier;
  duration_seconds: number;
  video_source_url: string;
};

type ProfileRow = {
  subscription_tier: Tier;
};

function isTier(value: string | null | undefined): value is Tier {
  return value === "NORMAL" || value === "GENERAL" || value === "VIP";
}

function canAccessFull(userTier: Tier, requiredTier: Tier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
}

function issuePreviewToken(params: {
  userId: string;
  videoId: string;
  tier: Tier;
}): string {
  return signClaims(
    {
      sub: params.userId,
      videoId: params.videoId,
      tier: params.tier,
      maxPreviewSeconds: PREVIEW_SECONDS,
      mode: "preview-only",
    },
    {
      ttlSeconds: PREVIEW_SECONDS,
      secret: "playback",
      purpose: "supabase-video-preview",
    },
  );
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      {
        error: "AUTH_REQUIRED",
        message: "ログインが必要です。",
      },
      { status: 401 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (profileError) {
    return NextResponse.json(
      {
        error: "PROFILE_LOOKUP_FAILED",
        message: "プロフィール情報の取得に失敗しました。",
      },
      { status: 500 },
    );
  }

  const userTier = isTier(profile?.subscription_tier)
    ? profile.subscription_tier
    : "NORMAL";

  const admin = createSupabaseAdminClient();
  const { data: video, error: videoError } = await admin
    .from("videos")
    .select(
      "id,title,description,thumbnail_url,minimum_required_tier,duration_seconds,video_source_url",
    )
    .eq("id", id)
    .maybeSingle<VideoRow>();

  if (videoError) {
    return NextResponse.json(
      {
        error: "VIDEO_LOOKUP_FAILED",
        message: "動画情報の取得に失敗しました。",
      },
      { status: 500 },
    );
  }

  if (!video) {
    return NextResponse.json(
      {
        error: "VIDEO_NOT_FOUND",
        message: "動画が見つかりません。",
      },
      { status: 404 },
    );
  }

  const requiredTier = isTier(video.minimum_required_tier)
    ? video.minimum_required_tier
    : "NORMAL";

  const metadata = {
    id: video.id,
    title: video.title,
    description: video.description,
    thumbnailUrl: video.thumbnail_url,
    durationSeconds: video.duration_seconds,
    minimumRequiredTier: requiredTier,
  };

  if (canAccessFull(userTier, requiredTier)) {
    return NextResponse.json(
      {
        video: metadata,
        access: {
          allowed: true,
          mode: "full",
          streamUrl: video.video_source_url,
          userTier,
          requiredTier,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  if (userTier === "NORMAL") {
    const previewToken = issuePreviewToken({
      userId: user.id,
      videoId: video.id,
      tier: userTier,
    });

    return NextResponse.json(
      {
        video: metadata,
        access: {
          allowed: false,
          mode: "preview",
          reason: "UPGRADE_REQUIRED",
          userTier,
          requiredTier,
          maxPreviewSeconds: PREVIEW_SECONDS,
          preview: {
            issued: true,
            // Placeholder endpoint for a future signed preview stream implementation.
            previewUrl: `/api/videos/${video.id}/preview?token=${encodeURIComponent(previewToken)}`,
            tokenExpiresInSeconds: PREVIEW_SECONDS,
          },
        },
      },
      {
        status: 403,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  return NextResponse.json(
    {
      video: metadata,
      access: {
        allowed: false,
        mode: "denied",
        reason: "UPGRADE_REQUIRED",
        userTier,
        requiredTier,
        upsell: true,
      },
    },
    {
      status: 403,
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
