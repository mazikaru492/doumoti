import HeroSection from "@/components/HeroSection";
import GenreSection from "@/components/GenreSection";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { type Video } from "@/lib/video-model";
import { type VideoCatalogRow } from "@/types/database";

/**
 * ホームページ
 *
 * - 最も評価の高い動画をヒーローバナーに表示
 * - ジャンル別にカルーセルセクションを動的生成
 */
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
      <section className="mx-auto max-w-5xl px-6 py-20 text-foreground">
        <h1 className="text-2xl font-semibold text-white">
          動画を読み込めませんでした
        </h1>
        <p className="mt-3 text-sm text-zinc-300">
          データベースへの接続で問題が発生しました。時間をおいて再試行してください。
        </p>
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
      <section className="mx-auto max-w-5xl px-6 py-20 text-foreground">
        <h1 className="text-2xl font-semibold text-white">
          現在動画を準備中です
        </h1>
        <p className="mt-3 text-sm text-zinc-300">
          新しい作品を順次追加しています。しばらくしてからもう一度ご確認ください。
        </p>
      </section>
    );
  }

  const [heroVideo, ...remainingVideos] = allVideos;
  const normalVideos = remainingVideos.filter(
    (video) => video.minimum_required_tier === "NORMAL",
  );
  const generalVideos = remainingVideos.filter(
    (video) => video.minimum_required_tier === "GENERAL",
  );
  const vipVideos = remainingVideos.filter(
    (video) => video.minimum_required_tier === "VIP",
  );

  return (
    <>
      {/* ヒーローバナー */}
      <HeroSection video={heroVideo} />

      {/* Tier別セクション */}
      <div className="space-y-4 mt-4">
        <GenreSection id="normal" genre="Normal プラン" videos={normalVideos} />
        <GenreSection
          id="general"
          genre="General プラン"
          videos={generalVideos}
        />
        <GenreSection id="vip" genre="VIP プラン" videos={vipVideos} />

        {/* 全作品セクション */}
        <GenreSection genre="すべての作品" videos={remainingVideos} />
      </div>
    </>
  );
}
