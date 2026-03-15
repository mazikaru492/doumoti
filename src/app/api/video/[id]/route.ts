import { NextRequest, NextResponse } from "next/server";
import { getVideoById } from "@/lib/data";
import { buildEntitlement } from "@/lib/playback-access";
import { getAuthContextFromRequest } from "@/lib/session";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const video = await getVideoById(id);

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const auth = getAuthContextFromRequest(request);
  const entitlement = buildEntitlement({
    userId: auth.userId,
    plan: auth.plan,
    videoId: id,
  });

  return NextResponse.json(
    {
      video: {
        id: video.id,
        title: video.title,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        genre: video.genre,
        views: video.views,
        publishedAt: video.publishedAt,
        rating: video.rating,
        episode: video.episode,
        season: video.season,
      },
      entitlement,
      serverTime: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
