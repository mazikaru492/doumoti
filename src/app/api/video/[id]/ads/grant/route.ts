import { NextRequest, NextResponse } from "next/server";
import { grantAdSessionPlayback } from "@/lib/playback-access";
import { getAuthContextFromRequest } from "@/lib/session";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const auth = await getAuthContextFromRequest(request);
  if (auth.plan !== "general") {
    return NextResponse.json(
      { error: "Ad grant is only for General plan" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    adSessionId?: string;
  } | null;

  if (!body?.adSessionId) {
    return NextResponse.json(
      { error: "adSessionId is required" },
      { status: 400 },
    );
  }

  const source = await grantAdSessionPlayback({
    adSessionId: body.adSessionId,
    userId: auth.userId,
    videoId: id,
    minimumWatchMs: 8000,
  });

  if (!source) {
    return NextResponse.json(
      { error: "Ad verification failed or watch time is too short" },
      { status: 403 },
    );
  }

  return NextResponse.json(
    {
      source,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
