import HeroSection from "@/components/HeroSection";
import GenreSection from "@/components/GenreSection";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { type Video } from "@/lib/video-model";
import { type VideoCatalogRow } from "@/types/database";

type Tier = "NORMAL" | "GENERAL" | "VIP";

function canAccessTier(userTier: Tier | null, requiredTier: Tier): boolean {
  if (!userTier) return requiredTier === "NORMAL";

  const tierOrder: Record<Tier, number> = {
    NORMAL: 0,
    GENERAL: 1,
    VIP: 2,
  };

  return tierOrder[userTier] >= tierOrder[requiredTier];
}

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();

  // ユーザー認証情報を取得
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userTier: Tier | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .maybeSingle();

    const tier = profile?.subscription_tier;
    if (tier === "NORMAL" || tier === "GENERAL" || tier === "VIP") {
      userTier = tier;
    }
  }

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

  // ユーザーがアクセスできる動画でヒーローを選択
  const accessibleVideos = allVideos.filter((video) =>
    canAccessTier(userTier, video.minimum_required_tier)
  );
  const heroVideo = accessibleVideos[0] || allVideos[0];

  const recentlyAdded = allVideos.slice(0, 10);

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

      {/* カルーセルセクション */}
      <div className="relative z-10 -mt-32 sm:-mt-40 pb-20 space-y-2">
        {/* 最近追加された作品 */}
        <GenreSection
          genre="最近追加された作品"
          videos={recentlyAdded}
          userTier={userTier}
        />

        {/* 無料で視聴可能 */}
        {normalVideos.length > 0 && (
          <GenreSection
            id="normal"
            genre="無料で視聴"
            videos={normalVideos}
            userTier={userTier}
          />
        )}

        {/* General限定 */}
        {generalVideos.length > 0 && (
          <GenreSection
            id="general"
            genre="Generalプラン"
            videos={generalVideos}
            userTier={userTier}
            requiresUpgrade={!canAccessTier(userTier, "GENERAL")}
          />
        )}

        {/* VIP限定 */}
        {vipVideos.length > 0 && (
          <GenreSection
            id="vip"
            genre="VIPプラン"
            videos={vipVideos}
            userTier={userTier}
            requiresUpgrade={!canAccessTier(userTier, "VIP")}
          />
        )}

        {/* 全作品 */}
        <GenreSection genre="すべての作品" videos={allVideos} userTier={userTier} />
      </div>
    </main>
  );
}
