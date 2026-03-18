import Link from "next/link";
import Image from "next/image";
import { Play, Info } from "lucide-react";
import { type Video } from "@/lib/video-model";

interface HeroSectionProps {
  video: Video;
}

export default function HeroSection({ video }: HeroSectionProps) {
  const thumbnailSrc = video.thumbnail_url?.trim() || null;

  return (
    <section className="relative w-full h-[70vh] sm:h-[85vh] min-h-[400px] sm:min-h-[600px] overflow-hidden">
      {/* 背景画像 / フォールバック */}
      {thumbnailSrc ? (
        <Image
          src={thumbnailSrc}
          alt={video.title}
          fill
          priority
          sizes="100vw"
          className="object-cover object-top"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-black">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-bold text-white/20 tracking-wider">
              {video.title}
            </span>
          </div>
        </div>
      )}

      {/* Netflix風グラデーションオーバーレイ */}
      <div className="absolute inset-0 netflix-gradient-left" />
      <div className="absolute inset-0 netflix-gradient-bottom" />

      {/* コンテンツ */}
      <div className="absolute inset-0 flex items-end pb-16 sm:items-center sm:pb-0">
        <div className="w-full px-4 sm:px-12 lg:px-16">
          <div className="max-w-2xl fade-in">
            {/* Netflixロゴ風のシリーズマーク */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-primary font-bold text-sm tracking-widest">
                D
              </span>
              <span className="text-white/60 text-sm font-medium tracking-wide uppercase">
                シリーズ
              </span>
            </div>

            {/* タイトル */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-white mb-4 leading-none tracking-tight drop-shadow-2xl">
              {video.title}
            </h1>

            {/* 説明文 */}
            <p className="text-white/80 text-base sm:text-lg leading-relaxed mb-8 line-clamp-3 max-w-xl drop-shadow-lg">
              {video.description}
            </p>

            {/* CTA ボタン - Netflix風 */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/video/${video.id}`}
                className="inline-flex items-center gap-2 bg-white hover:bg-white/90 text-black font-bold px-6 sm:px-8 py-2.5 sm:py-3 rounded-md transition-all duration-200 text-base sm:text-lg"
              >
                <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-black" />
                再生
              </Link>
              <Link
                href={`/video/${video.id}`}
                className="inline-flex items-center gap-2 bg-gray-500/70 hover:bg-gray-500/50 text-white font-bold px-6 sm:px-8 py-2.5 sm:py-3 rounded-md transition-all duration-200 text-base sm:text-lg"
              >
                <Info className="w-6 h-6 sm:w-7 sm:h-7" />
                詳細情報
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
