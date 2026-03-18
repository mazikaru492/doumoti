import Link from "next/link";
import Image from "next/image";
import { Play } from "lucide-react";
import { type Video, formatDuration } from "@/lib/video-model";

interface VideoCardProps {
  video: Video;
}

export default function VideoCard({ video }: VideoCardProps) {
  const thumbnailSrc = video.thumbnail_url?.trim() || null;

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
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300">
            <Play className="w-6 h-6 text-black fill-black ml-0.5" />
          </div>
        </div>

        {/* 再生時間バッジ */}
        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-medium px-1.5 py-0.5 rounded">
          {formatDuration(video.duration_seconds)}
        </div>
      </div>

      {/* メタ情報 - シンプルに */}
      <div className="p-2 bg-zinc-900 group-hover:bg-zinc-800 transition-colors">
        <h3 className="text-white font-medium text-sm line-clamp-1">
          {video.title}
        </h3>
        <p className="text-zinc-400 text-xs mt-0.5 line-clamp-1">
          {video.description}
        </p>
      </div>
    </Link>
  );
}
