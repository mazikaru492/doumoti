import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // 外部サーバーのサムネイル画像を next/image で最適化するためのドメイン許可設定
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },

  // 海外動画サーバーからのストリーミング再生に必要な CORS ヘッダー設定
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
