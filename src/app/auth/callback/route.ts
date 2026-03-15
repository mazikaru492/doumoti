import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

function sanitizeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/")) {
    return "/";
  }
  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const otpType = requestUrl.searchParams.get("type");
  const nextPath = sanitizeNextPath(requestUrl.searchParams.get("next"));

  const redirectUrl = new URL(nextPath, requestUrl.origin);

  if (!code && !tokenHash) {
    const errorUrl = new URL("/login", requestUrl.origin);
    errorUrl.searchParams.set("error", "auth_code_missing");
    return NextResponse.redirect(errorUrl);
  }

  const response = NextResponse.redirect(redirectUrl);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const errorUrl = new URL("/login", requestUrl.origin);
    errorUrl.searchParams.set("error", "supabase_env_missing");
    return NextResponse.redirect(errorUrl);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });

  let error: { message: string } | null = null;

  if (code) {
    const exchangeResult = await supabase.auth.exchangeCodeForSession(code);
    error = exchangeResult.error;
  } else if (tokenHash) {
    const supportedOtpTypes: EmailOtpType[] = [
      "signup",
      "magiclink",
      "recovery",
      "email",
      "email_change",
    ];

    if (!otpType || !supportedOtpTypes.includes(otpType as EmailOtpType)) {
      const errorUrl = new URL("/login", requestUrl.origin);
      errorUrl.searchParams.set("error", "auth_otp_type_invalid");
      return NextResponse.redirect(errorUrl);
    }

    const verifyResult = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as EmailOtpType,
    });
    error = verifyResult.error;
  }

  if (error) {
    const errorUrl = new URL("/login", requestUrl.origin);
    errorUrl.searchParams.set("error", "auth_callback_failed");
    errorUrl.searchParams.set("reason", error.message);
    return NextResponse.redirect(errorUrl);
  }

  return response;
}
