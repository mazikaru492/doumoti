"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/utils/supabase/client";

type AuthMode = "signin" | "signup";

function validateInput(email: string, password: string): string | null {
  if (!email.includes("@")) {
    return "メールアドレスの形式が正しくありません。";
  }

  if (password.length < 8) {
    return "パスワードは8文字以上で入力してください。";
  }

  return null;
}

function explainAuthError(message: string): string {
  const lowered = message.toLowerCase();

  if (lowered.includes("invalid login credentials")) {
    return "メールアドレスまたはパスワードが正しくありません。";
  }

  if (
    lowered.includes("already registered") ||
    lowered.includes("already been registered") ||
    lowered.includes("user already registered")
  ) {
    return "このメールアドレスはすでに登録されています。ログインをお試しください。";
  }

  if (lowered.includes("password should be at least")) {
    return "パスワードは8文字以上で入力してください。";
  }

  if (lowered.includes("email rate limit") || lowered.includes("rate limit")) {
    return "メール送信が一時的に制限されています。1分ほど待ってから再送してください。";
  }

  if (
    lowered.includes("redirect") &&
    (lowered.includes("not allowed") || lowered.includes("invalid"))
  ) {
    return "認証リダイレクトURLが許可されていません。管理者にURL設定の確認を依頼してください。";
  }

  return "認証処理に失敗しました。時間をおいて再試行してください。";
}

function explainQueryError(
  code: string | null,
  reason: string | null,
): string | null {
  if (!code) {
    return null;
  }

  if (code === "auth_code_missing") {
    return "確認リンクが不完全です。メール本文のURLを最初から開き直してください。";
  }

  if (code === "auth_otp_type_invalid") {
    return "確認リンクの種類を判別できませんでした。新しい確認メールを再送してください。";
  }

  if (code === "auth_callback_failed") {
    if (reason) {
      return `確認リンクの処理に失敗しました: ${reason}`;
    }
    return "確認リンクの処理に失敗しました。リンクの有効期限切れの可能性があります。";
  }

  if (code === "supabase_env_missing") {
    return "サーバー側の認証設定が不足しています。管理者に連絡してください。";
  }

  return "認証フローでエラーが発生しました。";
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const posterSeeds = [121, 344, 888, 220, 777, 503, 901, 612, 452];

  const nextPath = useMemo(() => {
    const next = searchParams.get("next");
    return next && next.startsWith("/") ? next : "/mypage";
  }, [searchParams]);

  const callbackError = useMemo(() => {
    return explainQueryError(
      searchParams.get("error"),
      searchParams.get("reason"),
    );
  }, [searchParams]);

  const [mode, setMode] = useState<AuthMode>(() => {
    return searchParams.get("mode") === "signup" ? "signup" : "signin";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tabIndex = mode === "signin" ? 0 : 1;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validation = validateInput(email, password);
    if (validation) {
      setError(validation);
      return;
    }

    setPending(true);
    const supabase = getSupabaseBrowserClient();

    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(explainAuthError(signInError.message));
          return;
        }

        router.replace(nextPath);
        router.refresh();
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(explainAuthError(signUpError.message));
        return;
      }

      if (!data.user) {
        setError(
          "アカウント作成に失敗しました。時間をおいて再試行してください。",
        );
        return;
      }

      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(explainAuthError(signInError.message));
          return;
        }
      }

      router.push(nextPath);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#08090c] text-foreground">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-[1440px] lg:grid-cols-2">
        <div className="relative flex items-center justify-center px-6 py-14 sm:px-10 lg:px-14">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(255,84,59,0.2),transparent_42%),radial-gradient(circle_at_80%_80%,rgba(145,52,255,0.14),transparent_40%),linear-gradient(180deg,#090b10_0%,#0d1018_55%,#0a0b11_100%)]"
          />

          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-black/55 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <p className="mb-3 text-xs uppercase tracking-[0.28em] text-red-300/85">
              Doumoti Access
            </p>
            <h1 className="mb-1 text-3xl font-semibold leading-tight text-white">
              {mode === "signin" ? "ログイン" : "新規登録"}
            </h1>
            <p className="mb-6 text-sm text-zinc-400">
              {mode === "signin"
                ? "アカウントにログインして視聴を再開"
                : "新しいアカウントを作成して今すぐ視聴開始"}
            </p>

            {callbackError ? (
              <p className="mb-4 rounded-lg border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {callbackError}
              </p>
            ) : null}

            <div className="relative mb-6 grid grid-cols-2 rounded-xl border border-white/10 bg-white/5 p-1 text-sm">
              <span
                aria-hidden
                className="absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-lg bg-red-600 shadow-[0_8px_24px_rgba(229,9,20,0.35)] transition-transform duration-300"
                style={{ transform: `translateX(${tabIndex * 100}%)` }}
              />
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                }}
                className={`relative z-10 rounded-lg px-3 py-2 transition-colors ${
                  mode === "signin" ? "text-white" : "text-zinc-300"
                }`}
              >
                ログイン
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
                className={`relative z-10 rounded-lg px-3 py-2 transition-colors ${
                  mode === "signup" ? "text-white" : "text-zinc-300"
                }`}
              >
                新規登録
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-sm text-zinc-200">
                メールアドレス
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value.trim())}
                  className="mt-2 w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/40"
                  placeholder="you@example.com"
                />
              </label>

              <label className="block text-sm text-zinc-200">
                パスワード
                <input
                  required
                  type="password"
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/40"
                  placeholder="8文字以上"
                />
              </label>

              {error ? (
                <p className="rounded-lg border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                  {error}
                </p>
              ) : null}

              <button
                disabled={pending}
                type="submit"
                className="mt-2 w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending
                  ? mode === "signin"
                    ? "ログイン中..."
                    : "アカウントを作成しています..."
                  : mode === "signin"
                    ? "ログインする"
                    : "アカウントを作成する"}
              </button>
            </form>

            <p className="mt-6 text-xs text-zinc-400">
              認証に成功すると {nextPath} に移動します。
              <br />
              Supabase RLSにより、ユーザー権限に応じたデータのみ取得されます。
            </p>

            <div className="mt-5 text-right">
              <Link
                href="/"
                className="text-xs text-zinc-300 underline-offset-4 hover:underline"
              >
                トップページへ戻る
              </Link>
            </div>
          </div>
        </div>

        <aside className="relative hidden overflow-hidden lg:block">
          <div className="absolute inset-0 grid grid-cols-3 gap-2 p-2">
            {posterSeeds.map((seed) => (
              <div
                key={seed}
                className="rounded-xl bg-cover bg-center"
                style={{
                  backgroundImage: `url(https://picsum.photos/seed/login-${seed}/420/720)`,
                }}
              />
            ))}
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(5,6,10,0.75),rgba(5,6,10,0.15)),linear-gradient(180deg,rgba(3,4,8,0.15),rgba(3,4,8,0.75))]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(255,68,43,0.35),transparent_45%),radial-gradient(circle_at_20%_90%,rgba(74,116,255,0.25),transparent_40%)]" />

          <div className="absolute bottom-8 left-8 right-8 rounded-2xl border border-white/20 bg-black/45 p-6 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.28em] text-red-300/80">
              Stream Securely
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              映画館級の体験を、どこでも。
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-200/80">
              最新の収集パイプラインで更新されたタイトルを、プランに応じた安全な再生フローで配信します。
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
