"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, X, UserRound, LogOut, Crown } from "lucide-react";
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
    { href: "/pricing", label: "料金プラン" },
  ];

  const tierLabel: Record<"NORMAL" | "GENERAL" | "VIP", string> = {
    NORMAL: "無料",
    GENERAL: "General",
    VIP: "VIP",
  };

  const tierBadgeStyle: Record<"NORMAL" | "GENERAL" | "VIP", string> = {
    NORMAL: "bg-zinc-700 text-white",
    GENERAL: "bg-blue-600 text-white",
    VIP: "bg-gradient-to-r from-amber-500 to-yellow-400 text-black",
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
            ? "bg-black/95 backdrop-blur-sm"
            : "bg-gradient-to-b from-black/80 to-transparent"
        }`}
      >
        <div className="mx-auto h-16 w-full px-4 sm:px-8 lg:px-16">
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
                className="hidden items-center gap-6 md:flex"
                aria-label="メインナビゲーション"
              >
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* 右側: ユーザー情報 */}
            <div className="flex items-center gap-3">
              {authState.isLoggedIn ? (
                <>
                  {/* ティアバッジ */}
                  {tier && (
                    <Link
                      href="/pricing"
                      className={`hidden sm:flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full transition-opacity hover:opacity-80 ${tierBadgeStyle[tier]}`}
                    >
                      {tier === "VIP" && <Crown className="w-3 h-3" />}
                      {tierLabel[tier]}
                    </Link>
                  )}

                  {/* アップグレードボタン (NORMAL/GENERALユーザー向け) */}
                  {tier !== "VIP" && (
                    <Link
                      href="/pricing"
                      className="hidden lg:block text-xs font-semibold text-primary hover:text-primary-light transition-colors"
                    >
                      アップグレード
                    </Link>
                  )}

                  {/* ユーザーメニュー */}
                  <div className="group relative">
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors"
                    >
                      {userInitial}
                    </button>
                    {/* ドロップダウン */}
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-lg bg-zinc-900 border border-zinc-800 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all shadow-xl">
                      <div className="px-4 py-3 border-b border-zinc-800">
                        <p className="text-xs text-zinc-500 mb-1">ログイン中</p>
                        <p className="text-sm text-white font-medium truncate">
                          {authState.email}
                        </p>
                        {tier && (
                          <span
                            className={`inline-flex items-center gap-1 mt-2 text-xs font-bold px-2 py-0.5 rounded ${tierBadgeStyle[tier]}`}
                          >
                            {tier === "VIP" && <Crown className="w-3 h-3" />}
                            {tierLabel[tier]}プラン
                          </span>
                        )}
                      </div>
                      <Link
                        href="/pricing"
                        className="block px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                      >
                        料金プラン
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={isSigningOut}
                        className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        {isSigningOut ? "ログアウト中..." : "ログアウト"}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Link
                    href="/pricing"
                    className="hidden sm:block text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                  >
                    料金プラン
                  </Link>
                  <Link
                    href="/login"
                    className="bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2 rounded-md transition-colors"
                  >
                    ログイン
                  </Link>
                </>
              )}

              {/* モバイルメニューボタン */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="flex items-center justify-center w-10 h-10 text-white md:hidden ml-1 rounded-md hover:bg-white/10 active:bg-white/20 transition-colors"
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
        className={`fixed right-0 top-0 z-50 h-dvh w-[85%] max-w-[320px] bg-zinc-950 border-l border-zinc-800 transform transition-transform duration-300 md:hidden ${
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
                  <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center text-white font-bold">
                    {userInitial}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium truncate max-w-[150px]">
                      {authState.email}
                    </p>
                    {tier && (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${tierBadgeStyle[tier]}`}
                      >
                        {tier === "VIP" && <Crown className="w-3 h-3" />}
                        {tierLabel[tier]}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="h-10 w-10 rounded-md bg-zinc-800 flex items-center justify-center text-zinc-400">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <span className="text-zinc-400 text-sm">ゲスト</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-white p-1"
              aria-label="閉じる"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* ナビゲーション */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-3 px-4 text-white text-base font-medium rounded-lg hover:bg-zinc-900 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* フッター */}
          <div className="p-4 border-t border-zinc-800 space-y-3">
            {authState.isLoggedIn ? (
              <>
                {tier !== "VIP" && (
                  <Link
                    href="/pricing"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block w-full py-3 text-center text-black bg-gradient-to-r from-amber-500 to-yellow-400 rounded-lg font-bold"
                  >
                    <Crown className="w-4 h-4 inline mr-2" />
                    アップグレード
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isSigningOut}
                  className="w-full py-3 text-white bg-zinc-800 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-zinc-700 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  {isSigningOut ? "ログアウト中..." : "ログアウト"}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full py-3 text-center text-white bg-primary rounded-lg font-semibold hover:bg-primary-dark transition-colors"
                >
                  ログイン
                </Link>
                <Link
                  href="/login?mode=signup"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full py-3 text-center text-white bg-zinc-800 rounded-lg font-medium hover:bg-zinc-700 transition-colors"
                >
                  新規登録
                </Link>
              </>
            )}
          </div>
        </div>
      </aside>
    </header>
  );
}
