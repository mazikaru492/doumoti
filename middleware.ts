import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

const PROTECTED_PREFIXES = ["/mypage", "/account", "/settings"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function copyCookies(from: NextResponse, to: NextResponse): void {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
}

export async function middleware(request: NextRequest) {
  const { response, userId } = await updateSession(request);

  if (!isProtectedPath(request.nextUrl.pathname)) {
    return response;
  }

  if (userId) {
    return response;
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", request.nextUrl.pathname);

  const redirectResponse = NextResponse.redirect(loginUrl);
  copyCookies(response, redirectResponse);

  return redirectResponse;
}

export const config = {
  matcher: ["/mypage/:path*", "/account/:path*", "/settings/:path*"],
};
