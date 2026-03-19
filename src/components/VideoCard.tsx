import Link from "next/link";
import Image from "next/image";
import { Play, Lock, Crown } from "lucide-react";
import { type Video, formatDuration } from "@/lib/video-model";

interface VideoCardProps {
  video: Video;
  isLocked?: boolean;
}

export default function VideoCard({ video, isLocked = false }: VideoCardProps) {
  const thumbnailSrc = video.thumbnail_url?.trim() || null;
  const tier = video.minimum_required_tier;

  const tierLabel: Record<string, string> = {
    NORMAL: "無料",
    GENERAL: "General",
    VIP: "VIP",
  };

  const tierColor: Record<string, string> = {
    NORMAL: "bg-zinc-700",
    GENERAL: "bg-blue-600",
    VIP: "bg-gradient-to-r from-amber-500 to-yellow-400 text-black",
  };

  if (isLocked) {
    return (
      <Link
        href="/pricing"
        className="block group relative rounded-md overflow-hidden bg-zinc-900 transition-transform duration-300 hover:scale-105 hover:z-10"
      >
        {/* サムネイル (ぼかし) */}
        <div className="relative aspect-video overflow-hidden">
          {thumbnailSrc ? (
            <Image
              src={thumbnailSrc}
              alt={video.title}
              fill
              loading="lazy"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover blur-sm brightness-50"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black blur-sm" />
          )}

          {/* ロックオーバーレイ */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
            <div className="w-14 h-14 rounded-full bg-zinc-800/90 flex items-center justify-center mb-2 border border-zinc-600">
              <Lock className="w-6 h-6 text-zinc-400" />
            </div>
            <span className="text-white text-xs font-bold px-3 py-1 rounded-full bg-primary">
              {tierLabel[tier]}プランに登録
            </span>
          </div>

          {/* ティアバッジ */}
          <div
            className={`absolute top-2 left-2 text-white text-xs font-bold px-2 py-0.5 rounded ${tierColor[tier]}`}
          >
            {tier === "VIP" && <Crown className="w-3 h-3 inline mr-1" />}
            {tierLabel[tier]}
          </div>
        </div>

        {/* メタ情報 */}
        <div className="p-2 sm:p-3 bg-zinc-900 group-hover:bg-zinc-800 transition-colors">
          <h3 className="text-white font-medium text-xs sm:text-sm line-clamp-2 sm:line-clamp-1 leading-tight">
            {video.title}
          </h3>
          <p className="text-zinc-500 text-xs mt-0.5 line-clamp-1">
            アップグレードして視聴
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/video/${video.id}`}
      className="block group relative rounded-md overflow-hidden bg-zinc-900 transition-transform duration-300 hover:scale-105 hover:z-10"
    >
      {/* サムネイル */}
      <div className="relative aspect-video overflow-hidden">
        {thumbnailSrc ? (
          <Image
            src={thumbnailSrc}
            alt={video.title}
            fill
            loading="lazy"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black flex items-center justify-center p-4">
            <span className="text-white/70 text-sm font-semibold text-center line-clamp-3 leading-tight">
              {video.title}
            </span>
          </div>
        )}

        {/* ホバー時のオーバーレイ */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100">
          <div className="w-14 h-14 sm:w-12 sm:h-12 rounded-full bg-white/90 flex items-center justify-center transform sm:scale-75 group-hover:sm:scale-100 transition-transform duration-300">
            <Play className="w-6 h-6 sm:w-5 sm:h-5 text-black fill-black ml-0.5" />
          </div>
        </div>

        {/* 再生時間バッジ */}
        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-medium px-1.5 py-0.5 rounded">
          {formatDuration(video.duration_seconds)}
        </div>

        {/* ティアバッジ (NORMAL以外) */}
        {tier !== "NORMAL" && (
          <div
            className={`absolute top-2 left-2 text-white text-xs font-bold px-2 py-0.5 rounded ${tierColor[tier]}`}
          >
            {tier === "VIP" && <Crown className="w-3 h-3 inline mr-1" />}
            {tierLabel[tier]}
          </div>
        )}
      </div>

      {/* メタ情報 */}
      <div className="p-2 sm:p-3 bg-zinc-900 group-hover:bg-zinc-800 transition-colors">
        <h3 className="text-white font-medium text-xs sm:text-sm line-clamp-2 sm:line-clamp-1 leading-tight">
          {video.title}
        </h3>
        <p className="text-zinc-400 text-xs mt-0.5 line-clamp-1 hidden sm:block">
          {video.description}
        </p>
      </div>
    </Link>
  );
}
