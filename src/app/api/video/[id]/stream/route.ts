import { NextRequest, NextResponse } from "next/server";
import {
  resolvePlayableSource,
  verifyPlaybackToken,
} from "@/lib/playback-access";
import { getAuthContextFromRequest } from "@/lib/session";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
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

  const auth = getAuthContextFromRequest(request);
  if (auth.userId !== claims.sub) {
    return NextResponse.json(
      { error: "Playback token does not belong to this session" },
      { status: 403 },
    );
  }

  const { id } = await params;
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

  const upstreamSource = resolvePlayableSource(id, claims.quality);

  return NextResponse.redirect(upstreamSource, {
    status: 302,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
