"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Menu, X } from "lucide-react";
import SubscriptionDebugLogin from "@/components/SubscriptionDebugLogin";

/**
 * Header — グローバルナビゲーション
 *
 * スクロール時にグラスモーフィズム背景になる
 * モバイルではハンバーガーメニューに切り替え
 */
export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "glass shadow-lg shadow-black/20"
          : "bg-gradient-to-b from-black/80 to-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* ロゴ */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <span className="text-xl font-bold gradient-text hidden sm:block">
              Doumoti
            </span>
          </Link>

          {/* デスクトップナビ */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-foreground/70 hover:text-primary-light transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-0.5 after:bg-primary after:transition-all hover:after:w-full"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* 右側: 検索 + モバイルメニュー */}
          <div className="flex items-center gap-3">
            <SubscriptionDebugLogin />

            {/* 検索バー (UIのみ) */}
            <div className="hidden sm:flex items-center bg-surface-light/50 border border-border/50 rounded-full px-3 py-1.5 gap-2 focus-within:border-primary/50 transition-colors">
              <Search className="w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="タイトルで検索..."
                className="bg-transparent text-sm text-foreground outline-none w-32 lg:w-48 placeholder:text-muted"
              />
            </div>

            {/* モバイルメニューボタン */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden text-foreground p-1"
              aria-label="メニュー"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* モバイルメニュー */}
      {isMobileMenuOpen && (
        <div className="md:hidden glass border-t border-border/30">
          <nav className="flex flex-col p-4 gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-sm text-foreground/70 hover:text-primary-light hover:bg-surface-light/50 px-3 py-2.5 rounded-lg transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {/* モバイル検索 */}
            <div className="flex items-center bg-surface-light/50 border border-border/50 rounded-lg px-3 py-2 gap-2 mt-2">
              <Search className="w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="タイトルで検索..."
                className="bg-transparent text-sm text-foreground outline-none w-full placeholder:text-muted"
              />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
