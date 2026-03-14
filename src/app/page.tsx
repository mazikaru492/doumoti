import HeroSection from "@/components/HeroSection";
import GenreSection from "@/components/GenreSection";
import { getVideos, getVideosByGenre, getGenres } from "@/lib/data";

/**
 * ホームページ
 *
 * - 最も評価の高い動画をヒーローバナーに表示
 * - ジャンル別にカルーセルセクションを動的生成
 */
export default function HomePage() {
  const allVideos = getVideos();
  const genres = getGenres();

  // ヒーロー動画: 評価 × 再生回数 の加重スコアで選出
  const heroVideo = allVideos.reduce((best, current) =>
    current.rating * current.views > best.rating * best.views ? current : best
  );

  // ジャンル名をHTMLアンカーIDに変換するヘルパー
  const genreToId = (genre: string): string => {
    const map: Record<string, string> = {
      アクション: "action",
      ファンタジー: "fantasy",
      SF: "sf",
      ロマンス: "romance",
    };
    return map[genre] || genre.toLowerCase();
  };

  return (
    <>
      {/* ヒーローバナー */}
      <HeroSection video={heroVideo} />

      {/* ジャンル別セクション */}
      <div className="space-y-4 mt-4">
        {genres.map((genre) => (
          <GenreSection
            key={genre}
            id={genreToId(genre)}
            genre={genre}
            videos={getVideosByGenre(genre)}
          />
        ))}

        {/* 全作品セクション */}
        <GenreSection
          genre="すべての作品"
          videos={allVideos}
        />
      </div>
    </>
  );
}
