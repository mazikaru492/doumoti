import Link from "next/link";
import Image from "next/image";
import { Play, Star, Info } from "lucide-react";
import { type Video, formatViews } from "@/lib/data";

interface HeroSectionProps {
  /** ヒーローに表示する注目動画 */
  video: Video;
}

/**
 * HeroSection — トップページのヒーローバナー
 *
 * 注目動画の大型表示。サムネイルを背景にしたグラデーションオーバーレイ。
 * 「今すぐ再生」と「詳細を見る」のCTAボタン。
 */
export default function HeroSection({ video }: HeroSectionProps) {
  return (
    <section className="relative w-full h-[70vh] min-h-[500px] max-h-[800px] overflow-hidden">
      {/* 背景画像 */}
      <Image
        src={video.thumbnailUrl}
        alt={video.title}
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

      {/* グラデーションオーバーレイ */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

      {/* コンテンツ */}
      <div className="absolute inset-0 flex items-end pb-20 sm:items-center sm:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-xl fade-in">
            {/* ジャンルバッジ */}
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-primary/20 text-primary-light text-xs font-semibold px-3 py-1 rounded-full border border-primary/30">
                {video.genre}
              </span>
              <div className="flex items-center gap-1 text-yellow-400">
                <Star className="w-4 h-4 fill-yellow-400" />
                <span className="text-sm font-medium">
                  {video.rating.toFixed(1)}
                </span>
              </div>
              <span className="text-muted text-sm">
                {formatViews(video.views)} 回再生
              </span>
            </div>

            {/* タイトル */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
              {video.title}
            </h1>

            {/* 説明文 */}
            <p className="text-white/70 text-sm sm:text-base leading-relaxed mb-6 line-clamp-3">
              {video.description}
            </p>

            {/* CTA ボタン */}
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/video/${video.id}`}
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 hover:scale-105"
              >
                <Play className="w-5 h-5" />
                今すぐ再生
              </Link>
              <Link
                href={`/video/${video.id}`}
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 backdrop-blur-sm border border-white/10"
              >
                <Info className="w-5 h-5" />
                詳細を見る
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
