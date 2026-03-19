import Link from "next/link";

/**
 * Footer — サイトフッター
 * サイト情報、ナビゲーションリンク、著作権表示
 */
export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    {
      title: "サービス",
      links: [
        { label: "利用規約", href: "#" },
        { label: "プライバシーポリシー", href: "#" },
        { label: "お問い合わせ", href: "#" },
      ],
    },
    {
      title: "コンテンツ",
      links: [
        { label: "新着", href: "#" },
        { label: "人気", href: "#" },
        { label: "ランキング", href: "#" },
      ],
    },
    {
      title: "ジャンル",
      links: [
        { label: "アクション", href: "#" },
        { label: "ファンタジー", href: "#" },
        { label: "SF", href: "#" },
      ],
    },
  ];

  return (
    <footer className="bg-surface border-t border-border/30 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {/* ブランド */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="text-white font-bold text-sm">D</span>
              </div>
              <span className="text-lg font-bold gradient-text">Doumoti</span>
            </Link>
            <p className="text-muted text-xs leading-relaxed">
              厳選されたアニメーション作品を
              <br />
              いつでも、どこからでもストリーミング。
            </p>
          </div>

          {/* リンクカラム */}
          {footerLinks.map((section) => (
            <div key={section.title}>
              <h4 className="text-foreground font-semibold text-sm mb-3">
                {section.title}
              </h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-muted text-xs hover:text-primary-light transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* 著作権表示 */}
        <div className="border-t border-border/30 mt-6 sm:mt-8 pt-4 sm:pt-6 text-center">
          <p className="text-muted text-xs">
            &copy; {currentYear} Doumoti. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
