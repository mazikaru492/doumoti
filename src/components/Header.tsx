"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Menu, X, UserRound, LogOut } from "lucide-react";
import { getSupabaseBrowserClient } from "@/utils/supabase/client";

/**
 * Header — Netflixライクなグローバルナビゲーション
 */
interface HeaderProps {
  authState: {
    isLoggedIn: boolean;
    email: string | null;
    subscriptionTier: "NORMAL" | "GENERAL" | "VIP" | null;
  };
}

export default function Header({ authState }: HeaderProps) {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const navLinks = [
    { href: "/", label: "ホーム" },
    { href: "/#action", label: "アクション" },
    { href: "/#fantasy", label: "ファンタジー" },
    { href: "/#sf", label: "SF" },
    { href: "/#romance", label: "ロマンス" },
  ];

  const tierLabels: Record<"NORMAL" | "GENERAL" | "VIP", string> = {
    NORMAL: "Normal",
    GENERAL: "General",
    VIP: "VIP",
  };

  const tierBadgeStyle: Record<"NORMAL" | "GENERAL" | "VIP", string> = {
    NORMAL: "border-white/25 bg-[#2a2a2a] text-[#ececec]",
    GENERAL: "border-white/30 bg-[#3a3a3a] text-white",
    VIP: "border-[#b04a7a] bg-[#8f1e56] text-white",
  };

  const tier = authState.subscriptionTier;
  const userInitial = authState.email?.[0]?.toUpperCase() ?? "U";

  async function handleLogout() {
    if (isSigningOut) {
      return;
    }
    setIsSigningOut(true);

    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.replace("/");
      router.refresh();
    } finally {
      setIsSigningOut(false);
      setIsMobileMenuOpen(false);
    }
  }

  return (
    <header
      className="fixed inset-x-0 top-0 z-50"
      style={{
        fontFamily:
          '"Noto Sans JP", "Hiragino Sans", "Yu Gothic UI", "Meiryo", sans-serif',
      }}
    >
      <div
        className={`relative border-b transition-colors duration-300 ${
          isScrolled
            ? "border-white/18 bg-[#000000]/96"
            : "border-white/10 bg-[#141414]/96"
        }`}
      >
        <div className="mx-auto h-16 w-full max-w-[1320px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-full items-center justify-between gap-8">
            <div className="flex min-w-0 items-center gap-10">
              <Link
                href="/"
                className="flex shrink-0 items-center gap-3"
                aria-label="Doumoti ホーム"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-[#c83a87] to-[#8f1e56] shadow-[0_4px_14px_rgba(143,30,86,0.55)]">
                  <span className="text-sm font-extrabold tracking-wide text-white">
                    D
                  </span>
                </div>
                <span className="text-[20px] font-bold leading-none tracking-[-0.01em] text-[#d54a89] sm:text-[24px]">
                  Doumoti
                </span>
              </Link>

              <nav
                aria-label="メインナビゲーション"
                className="hidden items-center gap-8 md:flex"
              >
                {navLinks.map((link, index) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative whitespace-nowrap text-[15px] tracking-[0.02em] transition-all duration-200 hover:brightness-110 after:absolute after:-bottom-[8px] after:left-0 after:h-[2px] after:bg-[#8f1e56] after:transition-all after:duration-200 ${
                      index === 0
                        ? "font-bold text-white after:w-full"
                        : "font-semibold text-[#e5e5e5] hover:text-white after:w-0 hover:after:w-full"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="group hidden h-10 items-center rounded-full border border-white/16 bg-[#0e0e0e] pl-3 pr-4 transition-all duration-300 hover:border-white/35 focus-within:border-white/60 md:flex">
                <Search
                  className="h-4 w-4 shrink-0 text-white/70"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  placeholder="タイトルで検索..."
                  aria-label="タイトルで検索"
                  className="ml-2 w-28 bg-transparent text-sm font-medium text-white placeholder:text-[#b3b3b3] opacity-90 outline-none transition-all duration-300 sm:w-32 group-hover:w-44 group-focus-within:w-56"
                />
              </div>

              {authState.isLoggedIn ? (
                <>
                  {tier ? (
                    <div className="hidden shrink-0 items-center gap-2 rounded-full border border-white/15 bg-[#0f0f0f] px-3 py-1.5 lg:flex">
                      <span className="whitespace-nowrap text-[11px] font-semibold tracking-wide text-white/65">
                        PLAN
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-bold ${tierBadgeStyle[tier]}`}
                      >
                        {tierLabels[tier]}
                      </span>
                    </div>
                  ) : null}

                  <div className="hidden items-center gap-2 md:flex">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border border-white/22 bg-gradient-to-br from-[#2a2a2a] to-[#171717] text-sm font-bold text-white shadow-[0_4px_12px_rgba(0,0,0,0.45)]">
                      {userInitial}
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isSigningOut}
                      className="inline-flex h-9 items-center gap-2 rounded-full border border-white/20 bg-[#161616] px-3 text-xs font-semibold text-white transition hover:border-white/45 disabled:opacity-60"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      {isSigningOut ? "ログアウト中" : "ログアウト"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="hidden items-center gap-2 md:flex">
                  <Link
                    href="/login"
                    className="inline-flex h-9 items-center rounded-full border border-white/25 bg-[#171717] px-4 text-xs font-semibold text-white transition hover:border-white/45"
                  >
                    ログイン
                  </Link>
                  <Link
                    href="/login?mode=signup"
                    className="inline-flex h-9 items-center rounded-full border border-[#8f1e56] bg-[#8f1e56] px-4 text-xs font-semibold text-white transition hover:bg-[#a72666] hover:border-[#a72666]"
                  >
                    新規登録
                  </Link>
                </div>
              )}

              <button
                type="button"
                aria-label="検索"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#111111] text-white transition-colors hover:border-white/40 md:hidden"
              >
                <Search className="h-5 w-5" />
              </button>

              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#111111] text-white transition-colors hover:border-white/40 md:hidden"
                aria-label={
                  isMobileMenuOpen ? "メニューを閉じる" : "メニューを開く"
                }
                type="button"
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-full h-[200px] bg-gradient-to-b from-black to-transparent"
        />
      </div>

      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 md:hidden ${
          isMobileMenuOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`fixed right-0 top-0 z-50 h-dvh w-[88%] max-w-[360px] border-l border-white/10 bg-[#0d0d0d] md:hidden transform transition-transform duration-300 ${
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="モバイルメニュー"
        aria-hidden={!isMobileMenuOpen}
      >
        <div className="flex h-full flex-col">
          <div className="flex min-h-16 items-center justify-between border-b border-white/10 px-4">
            <div className="flex min-h-11 items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-[#2a2a2a] to-[#171717] text-white">
                {authState.isLoggedIn ? (
                  <span className="text-base font-bold">{userInitial}</span>
                ) : (
                  <UserRound className="h-5 w-5" />
                )}
              </div>
              <div className="flex min-h-11 flex-col justify-center">
                <p className="text-[11px] font-semibold tracking-[0.08em] text-white/55">
                  {authState.isLoggedIn ? "SIGNED IN" : "GUEST"}
                </p>
                {tier ? (
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${tierBadgeStyle[tier]}`}
                  >
                    {tierLabels[tier]}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-white/70">
                    ログインしてください
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#151515] text-white"
              aria-label="メニューを閉じる"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="px-4 pb-4 pt-3" aria-label="モバイルナビゲーション">
            {navLinks.map((link, index) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`mb-1 flex min-h-11 items-center rounded-xl px-4 text-[17px] transition-colors ${
                  index === 0
                    ? "bg-white/10 font-bold text-white"
                    : "font-semibold text-white/92 hover:bg-white/10"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="mx-4 h-px bg-white/10" />

          <section className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
            <div className="mb-3 flex min-h-11 items-center rounded-lg border border-white/14 bg-[#141414] px-3">
              <Search className="h-4 w-4 text-white/65" aria-hidden="true" />
              <input
                type="search"
                placeholder="タイトルで検索..."
                aria-label="タイトルで検索"
                className="ml-2 w-full bg-transparent text-sm font-medium text-white placeholder:text-[#b3b3b3] outline-none"
              />
            </div>

            {authState.isLoggedIn ? (
              <button
                type="button"
                onClick={handleLogout}
                disabled={isSigningOut}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-[#181818] px-4 py-2 text-sm font-semibold text-white transition hover:border-white/45 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                {isSigningOut ? "ログアウト中" : "ログアウト"}
              </button>
            ) : (
              <div className="space-y-2">
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex min-h-11 items-center justify-center rounded-xl border border-white/25 bg-[#181818] px-4 py-2 text-sm font-semibold text-white"
                >
                  ログイン
                </Link>
                <Link
                  href="/login?mode=signup"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex min-h-11 items-center justify-center rounded-xl border border-[#8f1e56] bg-[#8f1e56] px-4 py-2 text-sm font-semibold text-white"
                >
                  新規登録
                </Link>
              </div>
            )}
          </section>
        </div>
      </aside>
    </header>
  );
}
