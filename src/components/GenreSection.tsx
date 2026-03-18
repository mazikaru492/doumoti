"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import VideoCard from "@/components/VideoCard";
import { type Video } from "@/lib/video-model";

interface GenreSectionProps {
  genre: string;
  videos: Video[];
  id?: string;
}

export default function GenreSection({ genre, videos, id }: GenreSectionProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    setShowLeftArrow(container.scrollLeft > 0);
    setShowRightArrow(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 10,
    );
  };

  if (videos.length === 0) return null;

  return (
    <section id={id} className="relative py-4 group/section">
      {/* セクションヘッダー */}
      <div className="flex items-center gap-2 mb-2 px-4 sm:px-12 lg:px-16">
        <h2 className="text-base sm:text-lg lg:text-xl font-bold text-white">
          {genre}
        </h2>
        <ChevronRight className="w-4 h-4 text-primary opacity-0 group-hover/section:opacity-100 transition-opacity" />
      </div>

      {/* 横スクロールカルーセル */}
      <div className="relative">
        {/* 左スクロールボタン */}
        {showLeftArrow && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 bottom-0 z-20 w-12 sm:w-16 bg-gradient-to-r from-black/80 to-transparent flex items-center justify-start pl-2 opacity-0 group-hover/section:opacity-100 transition-opacity"
            aria-label="前へ"
          >
            <ChevronLeft className="w-8 h-8 text-white" />
          </button>
        )}

        {/* 右スクロールボタン */}
        {showRightArrow && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-0 bottom-0 z-20 w-12 sm:w-16 bg-gradient-to-l from-black/80 to-transparent flex items-center justify-end pr-2 opacity-0 group-hover/section:opacity-100 transition-opacity"
            aria-label="次へ"
          >
            <ChevronRight className="w-8 h-8 text-white" />
          </button>
        )}

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex gap-2 overflow-x-auto scrollbar-hide px-4 sm:px-12 lg:px-16 pb-4"
        >
          {videos.map((video) => (
            <div
              key={video.id}
              className="shrink-0 w-[180px] sm:w-[220px] lg:w-[260px]"
            >
              <VideoCard video={video} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
