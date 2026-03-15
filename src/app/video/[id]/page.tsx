import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Star, Eye, Calendar, Clock, ArrowLeft, Play } from "lucide-react";
import SecurePlaybackPanel from "@/components/SecurePlaybackPanel";
import {
  getVideoById,
  getVideosByGenre,
  getVideos,
  formatDuration,
  formatViews,
  formatDate,
} from "@/lib/data";

interface VideoPageProps {
  params: Promise<{ id: string }>;
}

/**
 * 動画詳細ページ (動的ルート)
 *
 * - VideoPlayer で動画再生
 * - メタデータ（タイトル、説明、ジャンル、再生回数等）
 * - 同ジャンルの関連動画リスト
 */
export default async function VideoPage({ params }: VideoPageProps) {
  const { id } = await params;
  const video = await getVideoById(id);

  if (!video) {
    notFound();
  }

  // 同ジャンルの関連動画（自分自身を除外）
  const relatedVideos = (await getVideosByGenre(video.genre)).filter(
    (v) => v.id !== video.id,
  );

  // 関連動画が少ない場合、他のジャンルの人気動画で補完
  const allVideos = await getVideos();
  const additionalVideos =
    relatedVideos.length < 4
      ? allVideos
          .filter(
            (v) =>
              v.id !== video.id && !relatedVideos.find((r) => r.id === v.id),
          )
          .sort((a, b) => b.views - a.views)
          .slice(0, 4 - relatedVideos.length)
      : [];

  const recommendedVideos = [...relatedVideos, ...additionalVideos];

  return (
    <div className="pt-16 min-h-screen">
      {/* プレイヤーエリア */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* 戻るボタン */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted hover:text-primary-light text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          ホームに戻る
        </Link>

        {/* BFF経由の再生パネル */}
        <SecurePlaybackPanel videoId={video.id} />
      </div>

      {/* 動画メタデータ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* 左カラム: 動画情報 */}
          <div className="flex-1">
            {/* タイトルとジャンル */}
            <div className="flex flex-wrap items-start gap-3 mb-3">
              <span className="bg-primary/20 text-primary-light text-xs font-semibold px-3 py-1 rounded-full border border-primary/30">
                {video.genre}
              </span>
              {video.season && video.episode && (
                <span className="bg-surface-light text-muted text-xs font-mono px-3 py-1 rounded-full border border-border/50">
                  S{video.season} E{video.episode}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              {video.title}
            </h1>

            {/* 統計バー */}
            <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-muted">
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="text-foreground font-medium">
                  {video.rating.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                <span>{formatViews(video.views)} 回再生</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>{formatDuration(video.duration)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(video.publishedAt)}</span>
              </div>
            </div>

            {/* 説明文 */}
            <div className="bg-surface rounded-xl border border-border/30 p-5">
              <h2 className="text-foreground font-semibold text-sm mb-2">
                あらすじ
              </h2>
              <p className="text-muted text-sm leading-relaxed">
                {video.description}
              </p>
            </div>
          </div>

          {/* 右カラム: 関連動画 */}
          <div className="lg:w-80 xl:w-96 shrink-0">
            <h2 className="text-foreground font-semibold text-lg mb-4">
              関連動画
            </h2>
            <div className="space-y-3">
              {recommendedVideos.map((related) => (
                <Link
                  key={related.id}
                  href={`/video/${related.id}`}
                  className="flex gap-3 group hover:bg-surface-light/50 rounded-lg p-2 transition-colors"
                >
                  {/* サムネイル */}
                  <div className="relative w-36 sm:w-40 shrink-0 aspect-video rounded-lg overflow-hidden">
                    <Image
                      src={related.thumbnailUrl}
                      alt={related.title}
                      fill
                      sizes="160px"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                      <Play className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                      {formatDuration(related.duration)}
                    </div>
                  </div>

                  {/* メタ */}
                  <div className="flex-1 min-w-0 py-0.5">
                    <h3 className="text-foreground text-sm font-medium line-clamp-2 group-hover:text-primary-light transition-colors">
                      {related.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted">
                      <span>{related.genre}</span>
                      <span>•</span>
                      <span>{formatViews(related.views)} 回再生</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      <span className="text-xs text-muted">
                        {related.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
