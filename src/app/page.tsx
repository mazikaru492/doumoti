import HeroSection from "@/components/HeroSection";
import GenreSection from "@/components/GenreSection";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { type Video } from "@/lib/video-model";

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

  const allVideos = (data ?? []) as Video[];

  if (allVideos.length === 0) {
    return (
      <section className="mx-auto max-w-5xl px-6 py-20 text-foreground">
        <h1 className="text-2xl font-semibold text-white">動画がありません</h1>
        <p className="mt-3 text-sm text-zinc-300">
          まだ動画が登録されていません。管理画面またはインポートスクリプトから追加してください。
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
