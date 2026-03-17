import { cookies } from "next/headers";
import { type NextRequest } from "next/server";
import { signClaims, verifyClaims } from "@/lib/security";
import { getOrCreateUser } from "@/lib/user-store";
import { type SubscriptionPlan } from "@/lib/subscription";

export const SESSION_COOKIE_NAME = "dm_session";

type SessionClaims = {
  userId: string;
};

export type AuthContext = {
  isAuthenticated: boolean;
  userId: string;
  plan: SubscriptionPlan;
};

export function createSessionToken(userId: string): string {
  return signClaims<SessionClaims>(
    { userId },
    {
      ttlSeconds: 60 * 60 * 24 * 30,
      secret: "session",
      purpose: "user-session",
    },
  );
}

export async function getAuthContextFromCookieStore(): Promise<AuthContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  return getAuthContextFromToken(token);
}

export async function getAuthContextFromRequest(
  request: NextRequest,
): Promise<AuthContext> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return getAuthContextFromToken(token);
}

async function getAuthContextFromToken(
  token: string | undefined,
): Promise<AuthContext> {
  if (!token) {
    return {
      isAuthenticated: false,
      userId: "guest",
      plan: "normal",
    };
  }

  const claims = verifyClaims<SessionClaims>(token, {
    secret: "session",
    expectedPurpose: "user-session",
  });

  if (!claims?.userId) {
    return {
      isAuthenticated: false,
      userId: "guest",
      plan: "normal",
    };
  }

  const user = await getOrCreateUser(claims.userId);
  return {
    isAuthenticated: true,
    userId: user.userId,
    plan: user.plan,
  };
}
