import Link from "next/link";
import Image from "next/image";
import { Play, Clock } from "lucide-react";
import { type Video, formatDuration, formatTierLabel } from "@/lib/video-model";

interface VideoCardProps {
  video: Video;
}

/**
 * VideoCard — 動画サムネイルカード
 *
 * ホバー時にスケールアップ + グロー効果
 * サムネイル上に再生時間オーバーレイ + 再生アイコン
 */
export default function VideoCard({ video }: VideoCardProps) {
  return (
    <Link
      href={`/video/${video.id}`}
      className="block group card-glow rounded-xl overflow-hidden bg-surface border border-border/50"
    >
      {/* サムネイル */}
      <div className="relative aspect-video overflow-hidden">
        <Image
          src={video.thumbnail_url}
          alt={video.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />

        {/* 再生アイコンオーバーレイ */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-primary/80 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 backdrop-blur-sm">
            <Play className="w-5 h-5 text-white ml-0.5" />
          </div>
        </div>

        {/* 再生時間バッジ */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/80 text-white text-xs font-mono px-2 py-0.5 rounded-md backdrop-blur-sm">
          <Clock className="w-3 h-3" />
          {formatDuration(video.duration_seconds)}
        </div>

        {/* プランバッジ */}
        <div className="absolute top-2 left-2 bg-primary/80 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm font-medium">
          {formatTierLabel(video.minimum_required_tier)}
        </div>
      </div>

      {/* メタ情報 */}
      <div className="p-3">
        <h3 className="text-foreground font-semibold text-sm line-clamp-1 group-hover:text-primary-light transition-colors">
          {video.title}
        </h3>
        <p className="text-muted text-xs mt-1 line-clamp-2 leading-relaxed">
          {video.description}
        </p>
        <div className="flex items-center justify-between mt-2 text-xs text-muted">
          <span>{formatTierLabel(video.minimum_required_tier)}</span>
          <span>{formatDuration(video.duration_seconds)}</span>
        </div>
      </div>
    </Link>
  );
}
