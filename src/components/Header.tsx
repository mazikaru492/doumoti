"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Menu, X, UserRound } from "lucide-react";

/**
 * Header — Netflixライクなグローバルナビゲーション
 */
export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loadingPlanUserId, setLoadingPlanUserId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "/", label: "ホーム" },
    { href: "/#action", label: "アクション" },
    { href: "/#fantasy", label: "ファンタジー" },
    { href: "/#sf", label: "SF" },
    { href: "/#romance", label: "ロマンス" },
  ];

  const plans = [
    { userId: "demo-normal", plan: "normal", label: "Normal (無料)" },
    { userId: "demo-general", plan: "general", label: "General (1600円/月)" },
    { userId: "demo-vip", plan: "vip", label: "VIP (2600円/月)" },
  ] as const;

  const loginPlan = async (userId: string, plan: string) => {
    setLoadingPlanUserId(userId);
    try {
      const response = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, plan }),
      });

      if (!response.ok) {
        return;
      }

      window.location.reload();
    } finally {
      setLoadingPlanUserId(null);
    }
  };

  const planButtonStyles: Record<(typeof plans)[number]["plan"], string> = {
    normal:
      "border border-white/45 bg-transparent text-white hover:border-white hover:bg-white/[0.08]",
    general:
      "border border-white/28 bg-white/[0.04] text-[#e9e9e9] hover:border-white/55 hover:bg-white/[0.12]",
    vip: "border border-[#8f1e56] bg-[#8f1e56] text-white hover:bg-[#a72666] hover:border-[#a72666] shadow-[0_6px_18px_rgba(143,30,86,0.45)]",
  };

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
                <span className="hidden text-[24px] font-bold leading-none tracking-[-0.01em] text-[#d54a89] sm:block">
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
              <div className="group hidden h-10 items-center rounded-full border border-white/16 bg-[#0e0e0e] pl-3 pr-4 transition-all duration-300 hover:border-white/35 focus-within:border-white/60 sm:flex">
                <Search
                  className="h-4 w-4 shrink-0 text-white/70"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  placeholder="タイトルで検索..."
                  aria-label="タイトルで検索"
                  className="ml-2 w-0 bg-transparent text-sm font-medium text-white placeholder:text-[#b3b3b3] opacity-90 outline-none transition-all duration-300 group-hover:w-36 group-focus-within:w-56"
                />
              </div>

              <div className="hidden items-center gap-2 lg:flex">
                {plans.map((demo) => (
                  <button
                    key={demo.userId}
                    onClick={() => loginPlan(demo.userId, demo.plan)}
                    disabled={loadingPlanUserId !== null}
                    className={`h-9 rounded-full px-3 text-[12px] font-semibold tracking-[0.01em] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${planButtonStyles[demo.plan]}`}
                    type="button"
                    aria-label={`${demo.label}に切り替え`}
                  >
                    {loadingPlanUserId === demo.userId
                      ? "切替中..."
                      : demo.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                aria-label="プロフィール"
                className="hidden h-9 w-9 items-center justify-center overflow-hidden rounded-md border border-white/22 bg-gradient-to-br from-[#2a2a2a] to-[#171717] text-white shadow-[0_4px_12px_rgba(0,0,0,0.45)] transition-all duration-200 hover:border-white/45 hover:brightness-110 sm:flex"
              >
                <UserRound className="h-4.5 w-4.5" />
              </button>

              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-1 text-white md:hidden"
                aria-label="メニュー"
                type="button"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
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

      {isMobileMenuOpen && (
        <div className="border-b border-white/15 bg-[#101010] md:hidden">
          <nav
            className="flex flex-col gap-1 p-4"
            aria-label="モバイルメニュー"
          >
            {navLinks.map((link, index) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm tracking-wide transition-colors ${
                  index === 0
                    ? "font-bold text-white"
                    : "font-medium text-white/90 hover:bg-white/10 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}

            <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/20 bg-[#141414] px-3 py-2">
              <Search className="h-4 w-4 text-white/65" aria-hidden="true" />
              <input
                type="search"
                placeholder="タイトルで検索..."
                aria-label="タイトルで検索"
                className="w-full bg-transparent text-sm font-medium text-white placeholder:text-[#b3b3b3] outline-none"
              />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2">
              {plans.map((demo) => (
                <button
                  key={demo.userId}
                  onClick={() => loginPlan(demo.userId, demo.plan)}
                  disabled={loadingPlanUserId !== null}
                  className={`rounded-lg px-3 py-2 text-left text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${planButtonStyles[demo.plan]}`}
                  type="button"
                  aria-label={`${demo.label}に切り替え`}
                >
                  {loadingPlanUserId === demo.userId ? "切替中..." : demo.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              aria-label="プロフィール"
              className="mt-2 flex h-10 w-10 items-center justify-center rounded-md border border-white/22 bg-gradient-to-br from-[#2a2a2a] to-[#171717] text-white"
            >
              <UserRound className="h-5 w-5" />
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
