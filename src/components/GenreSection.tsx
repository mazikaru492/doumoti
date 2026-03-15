"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import VideoCard from "@/components/VideoCard";
import { type Video } from "@/lib/video-model";

interface GenreSectionProps {
  /** ジャンル名（セクションタイトル） */
  genre: string;
  /** このジャンルの動画リスト */
  videos: Video[];
  /** HTMLアンカー用ID */
  id?: string;
}

/**
 * GenreSection — ジャンル別横スクロール動画リスト
 *
 * Netflix 風の横スクロールカルーセル。
 * 左右の矢印ボタンで smooth スクロール。
 */
export default function GenreSection({ genre, videos, id }: GenreSectionProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;
    // カード幅 + gap × 2枚分スクロール
    const scrollAmount = container.clientWidth * 0.6;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (videos.length === 0) return null;

  return (
    <section id={id} className="py-6">
      {/* セクションヘッダー */}
      <div className="flex items-center justify-between mb-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">
          {genre}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll("left")}
            className="w-8 h-8 rounded-full bg-surface-light border border-border/50 flex items-center justify-center text-muted hover:text-foreground hover:border-primary/50 transition-all"
            aria-label="前へ"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-8 h-8 rounded-full bg-surface-light border border-border/50 flex items-center justify-center text-muted hover:text-foreground hover:border-primary/50 transition-all"
            aria-label="次へ"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 横スクロールカルーセル */}
      <div
        ref={scrollContainerRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 lg:px-8 pb-2 snap-x snap-mandatory"
      >
        {videos.map((video) => (
          <div
            key={video.id}
            className="shrink-0 w-[260px] sm:w-[280px] lg:w-[300px] snap-start"
          >
            <VideoCard video={video} />
          </div>
        ))}
      </div>
    </section>
  );
}
