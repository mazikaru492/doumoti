import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getAuthContextFromCookieStore } from "@/lib/session";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Doumoti — 動画ストリーミング",
  description:
    "厳選されたアニメーション作品をいつでもどこからでもストリーミング。高品質な動画体験をお楽しみください。",
  keywords: ["動画", "ストリーミング", "アニメ", "Doumoti"],
  openGraph: {
    title: "Doumoti — 動画ストリーミング",
    description: "厳選されたアニメーション作品をストリーミング",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const auth = await getAuthContextFromCookieStore();

  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        <Header currentPlan={auth.plan} />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
