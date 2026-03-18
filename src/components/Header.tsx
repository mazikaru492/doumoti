"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Menu, X, UserRound, LogOut, Bell } from "lucide-react";
import { getSupabaseBrowserClient } from "@/utils/supabase/client";

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
      setIsScrolled(window.scrollY > 10);
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
    { href: "/#normal", label: "無料" },
    { href: "/#general", label: "General" },
    { href: "/#vip", label: "VIP" },
  ];

  const tierBadgeStyle: Record<"NORMAL" | "GENERAL" | "VIP", string> = {
    NORMAL: "bg-zinc-700 text-white",
    GENERAL: "bg-blue-600 text-white",
    VIP: "bg-amber-500 text-black",
  };

  const tier = authState.subscriptionTier;
  const userInitial = authState.email?.[0]?.toUpperCase() ?? "U";

  async function handleLogout() {
    if (isSigningOut) return;
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
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`transition-all duration-300 ${
          isScrolled
            ? "bg-black"
            : "bg-gradient-to-b from-black/80 to-transparent"
        }`}
      >
        <div className="mx-auto h-16 w-full px-4 sm:px-12 lg:px-16">
          <div className="flex h-full items-center justify-between gap-6">
            {/* 左側: ロゴ + ナビゲーション */}
            <div className="flex items-center gap-8">
              <Link
                href="/"
                className="flex items-center"
                aria-label="Doumoti ホーム"
              >
                <span className="text-2xl font-black text-primary tracking-tight">
                  DOUMOTI
                </span>
              </Link>

              <nav
                className="hidden items-center gap-5 md:flex"
                aria-label="メインナビゲーション"
              >
                {navLinks.map((link, index) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`text-sm transition-colors ${
                      index === 0
                        ? "font-semibold text-white"
                        : "text-zinc-300 hover:text-zinc-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* 右側: 検索 + ユーザー */}
            <div className="flex items-center gap-4">
              {/* 検索 */}
              <button
                type="button"
                aria-label="検索"
                className="text-white hover:text-zinc-300 transition-colors"
              >
                <Search className="h-5 w-5" />
              </button>

              {/* 通知 */}
              <button
                type="button"
                aria-label="通知"
                className="hidden text-white hover:text-zinc-300 transition-colors sm:block"
              >
                <Bell className="h-5 w-5" />
              </button>

              {authState.isLoggedIn ? (
                <div className="flex items-center gap-3">
                  {tier && (
                    <span
                      className={`hidden text-xs font-bold px-2 py-0.5 rounded sm:inline-block ${tierBadgeStyle[tier]}`}
                    >
                      {tier}
                    </span>
                  )}
                  <div className="group relative">
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded bg-primary text-white text-sm font-bold"
                    >
                      {userInitial}
                    </button>
                    {/* ドロップダウン */}
                    <div className="absolute right-0 top-full mt-2 w-48 rounded bg-black/95 border border-zinc-800 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                      <div className="px-3 py-2 border-b border-zinc-800">
                        <p className="text-xs text-zinc-400">ログイン中</p>
                        <p className="text-sm text-white truncate">
                          {authState.email}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={isSigningOut}
                        className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                      >
                        <LogOut className="h-4 w-4" />
                        {isSigningOut ? "ログアウト中..." : "ログアウト"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-4 py-1.5 rounded transition-colors"
                >
                  ログイン
                </Link>
              )}

              {/* モバイルメニューボタン */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-white md:hidden"
                aria-label={
                  isMobileMenuOpen ? "メニューを閉じる" : "メニューを開く"
                }
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
      </div>

      {/* モバイルメニュー オーバーレイ */}
      <div
        className={`fixed inset-0 z-40 bg-black/70 transition-opacity duration-300 md:hidden ${
          isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* モバイルメニュー */}
      <aside
        className={`fixed right-0 top-0 z-50 h-dvh w-[85%] max-w-[320px] bg-black border-l border-zinc-800 transform transition-transform duration-300 md:hidden ${
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="モバイルメニュー"
        aria-hidden={!isMobileMenuOpen}
      >
        <div className="flex flex-col h-full">
          {/* ヘッダー */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              {authState.isLoggedIn ? (
                <>
                  <div className="h-10 w-10 rounded bg-primary flex items-center justify-center text-white font-bold">
                    {userInitial}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium truncate max-w-[160px]">
                      {authState.email}
                    </p>
                    {tier && (
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded ${tierBadgeStyle[tier]}`}
                      >
                        {tier}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="h-10 w-10 rounded bg-zinc-800 flex items-center justify-center text-zinc-400">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <span className="text-zinc-400 text-sm">ゲスト</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-white"
              aria-label="閉じる"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* ナビゲーション */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-3 px-4 text-white text-base font-medium rounded hover:bg-zinc-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* フッター */}
          <div className="p-4 border-t border-zinc-800">
            {authState.isLoggedIn ? (
              <button
                type="button"
                onClick={handleLogout}
                disabled={isSigningOut}
                className="w-full py-3 text-white bg-zinc-800 rounded font-medium flex items-center justify-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                {isSigningOut ? "ログアウト中..." : "ログアウト"}
              </button>
            ) : (
              <div className="space-y-2">
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full py-3 text-center text-white bg-primary rounded font-semibold"
                >
                  ログイン
                </Link>
                <Link
                  href="/login?mode=signup"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full py-3 text-center text-white bg-zinc-800 rounded font-medium"
                >
                  新規登録
                </Link>
              </div>
            )}
          </div>
        </div>
      </aside>
    </header>
  );
}
