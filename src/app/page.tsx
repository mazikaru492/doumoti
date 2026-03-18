import HeroSection from "@/components/HeroSection";
import GenreSection from "@/components/GenreSection";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { type Video } from "@/lib/video-model";
import { type VideoCatalogRow } from "@/types/database";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("videos")
    .select(
      "id,title,description,thumbnail_url,duration_seconds,minimum_required_tier,created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <section className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            動画を読み込めませんでした
          </h1>
          <p className="text-zinc-400">
            データベースへの接続で問題が発生しました。時間をおいて再試行してください。
          </p>
        </div>
      </section>
    );
  }

  const allVideos: Video[] = ((data ?? []) as VideoCatalogRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    thumbnail_url: row.thumbnail_url || "",
    duration_seconds: row.duration_seconds,
    minimum_required_tier: row.minimum_required_tier,
    created_at: row.created_at,
  }));

  if (allVideos.length === 0) {
    return (
      <section className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            現在動画を準備中です
          </h1>
          <p className="text-zinc-400">
            新しい作品を順次追加しています。しばらくしてからもう一度ご確認ください。
          </p>
        </div>
      </section>
    );
  }

  const [heroVideo, ...remainingVideos] = allVideos;

  const recentlyAdded = remainingVideos.slice(0, 10);

  const normalVideos = allVideos.filter(
    (video) => video.minimum_required_tier === "NORMAL",
  );
  const generalVideos = allVideos.filter(
    (video) => video.minimum_required_tier === "GENERAL",
  );
  const vipVideos = allVideos.filter(
    (video) => video.minimum_required_tier === "VIP",
  );

  return (
    <main className="min-h-screen bg-black">
      {/* ヒーローバナー */}
      <HeroSection video={heroVideo} />

      {/* カルーセルセクション - ヒーローセクションに重なる */}
      <div className="relative z-10 -mt-32 sm:-mt-40 pb-20 space-y-2">
        {/* 最近追加された作品 */}
        <GenreSection genre="最近追加された作品" videos={recentlyAdded} />

        {/* 無料で視聴可能 */}
        {normalVideos.length > 0 && (
          <GenreSection
            id="normal"
            genre="無料で視聴可能"
            videos={normalVideos}
          />
        )}

        {/* General限定 */}
        {generalVideos.length > 0 && (
          <GenreSection
            id="general"
            genre="Generalプラン限定"
            videos={generalVideos}
          />
        )}

        {/* VIP限定 */}
        {vipVideos.length > 0 && (
          <GenreSection id="vip" genre="VIPプラン限定" videos={vipVideos} />
        )}

        {/* 全作品 */}
        <GenreSection genre="すべての作品" videos={allVideos} />
      </div>
    </main>
  );
}
