import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { normalizePlan } from "@/lib/subscription";
import { setUserPlan } from "@/lib/user-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    userId?: string;
    plan?: string;
  } | null;

  const userId = body?.userId?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const plan = normalizePlan(body?.plan);
  const user = setUserPlan(userId, plan);
  const token = createSessionToken(user.userId);

  const response = NextResponse.json({
    ok: true,
    userId: user.userId,
    plan: user.plan,
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
