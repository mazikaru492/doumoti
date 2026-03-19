"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import Link from "next/link";
import VideoCard from "@/components/VideoCard";
import { type Video } from "@/lib/video-model";

type Tier = "NORMAL" | "GENERAL" | "VIP";

interface GenreSectionProps {
  genre: string;
  videos: Video[];
  id?: string;
  userTier?: Tier | null;
  requiresUpgrade?: boolean;
}

function canAccessTier(
  userTier: Tier | null | undefined,
  requiredTier: Tier,
): boolean {
  if (!userTier) return requiredTier === "NORMAL";

  const tierOrder: Record<Tier, number> = {
    NORMAL: 0,
    GENERAL: 1,
    VIP: 2,
  };

  return tierOrder[userTier] >= tierOrder[requiredTier];
}

export default function GenreSection({
  genre,
  videos,
  id,
  userTier,
  requiresUpgrade = false,
}: GenreSectionProps) {
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
      <div className="flex items-center gap-2 sm:gap-3 mb-2 px-4 sm:px-8 lg:px-16">
        <h2 className="text-sm sm:text-lg lg:text-xl font-bold text-white">
          {genre}
        </h2>
        {requiresUpgrade && (
          <Link
            href="/pricing"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-light transition-colors"
          >
            <Lock className="w-3 h-3" />
            アップグレード
          </Link>
        )}
        <ChevronRight className="w-3 sm:w-4 h-3 sm:h-4 text-primary opacity-0 group-hover/section:opacity-100 transition-opacity" />
      </div>

      {/* 横スクロールカルーセル */}
      <div className="relative">
        {/* 左スクロールボタン */}
        {showLeftArrow && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 bottom-0 z-20 w-10 sm:w-12 lg:w-16 bg-gradient-to-r from-black/80 to-transparent flex items-center justify-start pl-1 sm:pl-2 opacity-0 group-hover/section:opacity-100 transition-opacity"
            aria-label="前へ"
            type="button"
          >
            <ChevronLeft className="w-6 sm:w-7 lg:w-8 h-6 sm:h-7 lg:h-8 text-white" />
          </button>
        )}

        {/* 右スクロールボタン */}
        {showRightArrow && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-0 bottom-0 z-20 w-10 sm:w-12 lg:w-16 bg-gradient-to-l from-black/80 to-transparent flex items-center justify-end pr-1 sm:pr-2 opacity-0 group-hover/section:opacity-100 transition-opacity"
            aria-label="次へ"
            type="button"
          >
            <ChevronRight className="w-6 sm:w-7 lg:w-8 h-6 sm:h-7 lg:h-8 text-white" />
          </button>
        )}

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex gap-2 overflow-x-auto scrollbar-hide px-4 sm:px-8 lg:px-16 pb-4"
        >
          {videos.map((video) => {
            const isLocked = !canAccessTier(
              userTier,
              video.minimum_required_tier,
            );
            return (
              <div
                key={video.id}
                className="shrink-0 w-[160px] sm:w-[200px] md:w-[220px] lg:w-[260px]"
              >
                <VideoCard video={video} isLocked={isLocked} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
