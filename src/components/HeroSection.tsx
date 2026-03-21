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
    <section className="relative w-full h-[65vh] sm:h-[80vh] lg:h-[85vh] min-h-[420px] sm:min-h-[500px] lg:min-h-[600px] overflow-hidden">
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
      <div className="absolute inset-0 flex items-end pb-6 sm:pb-12 lg:pb-16 sm:items-center sm:pb-0">
        <div className="w-full px-4 sm:px-8 lg:px-16">
          <div className="max-w-2xl fade-in">
            {/* Netflixロゴ風のシリーズマーク */}
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <span className="text-primary font-bold text-sm sm:text-sm tracking-widest">
                D
              </span>
              <span className="text-white/60 text-xs sm:text-sm font-medium tracking-wide uppercase">
                シリーズ
              </span>
            </div>

            {/* タイトル */}
            <h1 className="text-2xl sm:text-4xl lg:text-6xl xl:text-7xl font-black text-white mb-2 sm:mb-4 leading-tight tracking-tight drop-shadow-2xl">
              {video.title}
            </h1>

            {/* 説明文 */}
            <p className="text-white/80 text-sm sm:text-base lg:text-lg leading-relaxed mb-4 sm:mb-8 line-clamp-2 sm:line-clamp-3 max-w-xl drop-shadow-lg">
              {video.description}
            </p>

            {/* CTA ボタン - Netflix風 */}
            <div className="flex flex-row gap-2 sm:gap-3">
              <Link
                href={`/video/${video.id}`}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-white hover:bg-white/90 active:bg-white/80 text-black font-bold px-4 sm:px-8 py-3 sm:py-3 rounded-md transition-all duration-200 text-sm sm:text-lg"
              >
                <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-black" />
                再生
              </Link>
              <Link
                href={`/video/${video.id}`}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-zinc-600/70 hover:bg-zinc-600/50 active:bg-zinc-600/40 text-white font-bold px-4 sm:px-8 py-3 sm:py-3 rounded-md transition-all duration-200 text-sm sm:text-lg"
              >
                <Info className="w-5 h-5 sm:w-6 sm:h-6" />
                詳細
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
