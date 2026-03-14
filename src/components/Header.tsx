"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Menu, X, CircleUserRound } from "lucide-react";

/**
 * Header — Netflixライクなグローバルナビゲーション
 */
export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loadingPlanUserId, setLoadingPlanUserId] = useState<string | null>(null);

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
      "bg-transparent border border-white/45 text-white hover:border-white hover:bg-white/[0.06]",
    general:
      "bg-white/[0.08] border border-white/25 text-white hover:bg-white/[0.14] hover:border-white/45",
    vip: "bg-[#ff2a7f] border border-[#ff2a7f] text-white hover:bg-[#ff3d8d] shadow-[0_0_16px_rgba(255,42,127,0.25)]",
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`relative border-b transition-colors duration-300 ${
          isScrolled
            ? "border-white/15 bg-[#000000]/95"
            : "border-white/10 bg-[#141414]/95"
        }`}
      >
        <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8">
          <div className="flex h-full items-center justify-between gap-6">
            <div className="flex min-w-0 items-center gap-8">
              <Link
                href="/"
                className="flex shrink-0 items-center gap-3"
                aria-label="Doumoti ホーム"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-[#cf4cff] to-[#ff2a7f]">
                  <span className="text-sm font-bold text-white">D</span>
                </div>
                <span className="hidden text-xl font-semibold tracking-tight text-[#ff66a6] sm:block">
                  Doumoti
                </span>
              </Link>

              <nav
                aria-label="メインナビゲーション"
                className="hidden items-center gap-6 md:flex"
              >
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="relative whitespace-nowrap text-[15px] font-semibold tracking-wide text-white/90 transition-colors hover:text-white after:absolute after:-bottom-[6px] after:left-0 after:h-[2px] after:w-0 after:bg-[#ff2a7f] after:transition-all hover:after:w-full"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <div className="group hidden items-center rounded-full border border-white/20 bg-[#111111] px-3 py-1.5 transition-all focus-within:border-white/50 sm:flex">
                <Search className="h-4 w-4 text-white/70" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="タイトルで検索..."
                  aria-label="タイトルで検索"
                  className="ml-2 w-36 bg-transparent text-sm text-white placeholder:text-white/45 outline-none transition-all duration-200 group-focus-within:w-52"
                />
              </div>

              <div className="hidden items-center gap-2 lg:flex">
                {plans.map((demo) => (
                  <button
                    key={demo.userId}
                    onClick={() => loginPlan(demo.userId, demo.plan)}
                    disabled={loadingPlanUserId !== null}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-60 ${planButtonStyles[demo.plan]}`}
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
                className="hidden h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-[#1b1b1b] text-white/90 transition-colors hover:border-white/45 hover:text-white sm:flex"
              >
                <CircleUserRound className="h-5 w-5" />
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
          className="pointer-events-none absolute inset-x-0 top-full h-10 bg-gradient-to-b from-black/65 to-transparent"
        />
      </div>

      {isMobileMenuOpen && (
        <div className="border-b border-white/15 bg-[#0f0f0f] md:hidden">
          <nav className="flex flex-col gap-1 p-4" aria-label="モバイルメニュー">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
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
                className="w-full bg-transparent text-sm text-white placeholder:text-white/45 outline-none"
              />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2">
              {plans.map((demo) => (
                <button
                  key={demo.userId}
                  onClick={() => loginPlan(demo.userId, demo.plan)}
                  disabled={loadingPlanUserId !== null}
                  className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60 ${planButtonStyles[demo.plan]}`}
                  type="button"
                  aria-label={`${demo.label}に切り替え`}
                >
                  {loadingPlanUserId === demo.userId ? "切替中..." : demo.label}
                </button>
              ))}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
