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

  return "認証処理に失敗しました。時間をおいて再試行してください。";
}

function explainQueryError(code: string | null, reason: string | null): string | null {
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

  const nextPath = useMemo(() => {
    const next = searchParams.get("next");
    return next && next.startsWith("/") ? next : "/mypage";
  }, [searchParams]);

  const callbackError = useMemo(() => {
    return explainQueryError(searchParams.get("error"), searchParams.get("reason"));
  }, [searchParams]);

  const [mode, setMode] = useState<AuthMode>(() => {
    return searchParams.get("mode") === "signup" ? "signup" : "signin";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

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

      const {
        data: { session },
        error: signUpError,
      } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });

      if (signUpError) {
        setError(explainAuthError(signUpError.message));
        return;
      }

      if (!session) {
        setNotice(
          "確認メールを送信しました。メール内リンクを開いてログインを完了してください。",
        );
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="relative min-h-[calc(100vh-8rem)] overflow-hidden px-6 py-14 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(229,9,20,0.26),transparent_48%),radial-gradient(circle_at_85%_10%,rgba(255,98,0,0.14),transparent_42%),linear-gradient(180deg,#040406_0%,#0d0d14_52%,#08080b_100%)]"
      />

      <div className="relative mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-black/55 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <p className="mb-3 text-xs uppercase tracking-[0.28em] text-red-300/85">
          Doumoti Access
        </p>
        <h1 className="mb-6 text-3xl font-semibold leading-tight text-white">
          {mode === "signin" ? "ログイン" : "新規登録"}
        </h1>

        {callbackError ? (
          <p className="mb-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {callbackError}
          </p>
        ) : null}

        <div className="mb-6 grid grid-cols-2 rounded-xl border border-white/10 bg-white/5 p-1 text-sm">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
              setNotice(null);
            }}
            className={`rounded-lg px-3 py-2 transition ${
              mode === "signin"
                ? "bg-red-600 text-white"
                : "text-zinc-300 hover:bg-white/10"
            }`}
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
              setNotice(null);
            }}
            className={`rounded-lg px-3 py-2 transition ${
              mode === "signup"
                ? "bg-red-600 text-white"
                : "text-zinc-300 hover:bg-white/10"
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
            <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          {notice ? (
            <p className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {notice}
            </p>
          ) : null}

          <button
            disabled={pending}
            type="submit"
            className="mt-2 w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? "処理中..."
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
    </section>
  );
}
