// ============================================================
// モックデータレイヤー
// 実際のバックエンドAPIが構築されるまで、フロントエンドの開発に使用する
// 動画URLは公開されているテスト用ストリーミングソースを使用
// ============================================================

export interface Video {
  id: string;
  title: string;
  description: string;
  /** 海外サーバー上の動画ファイルURL (HLS or MP4) */
  videoUrl: string;
  /** サムネイル画像URL */
  thumbnailUrl: string;
  /** 動画の長さ（秒） */
  duration: number;
  /** ジャンルタグ */
  genre: string;
  /** 再生回数 */
  views: number;
  /** 公開日 (ISO 8601) */
  publishedAt: string;
  /** 評価 (0-5) */
  rating: number;
  /** エピソード番号（シリーズの場合） */
  episode?: number;
  /** シーズン番号 */
  season?: number;
}

// テスト再生用の公開HLS/MP4ストリーミングURL
const TEST_STREAMS = {
  bigBuckBunny:
    "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  sintel:
    "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8",
  tearsOfSteel:
    "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
  elephantDream:
    "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  mp4Sample:
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
};

/**
 * ダミーサムネイル生成
 * picsum.photos を使い、動画ごとにユニークな画像を返す
 */
const thumb = (seed: number): string =>
  `https://picsum.photos/seed/${seed}/640/360`;

export const videos: Video[] = [
  {
    id: "1",
    title: "Big Buck Bunny",
    description:
      "巨大なウサギ「Big Buck Bunny」が自然の中で繰り広げるコミカルなアドベンチャー。オープンソースの3Dアニメーション映画。",
    videoUrl: TEST_STREAMS.bigBuckBunny,
    thumbnailUrl: thumb(101),
    duration: 596,
    genre: "アクション",
    views: 1_520_000,
    publishedAt: "2025-01-15T00:00:00Z",
    rating: 4.5,
    episode: 1,
    season: 1,
  },
  {
    id: "2",
    title: "Sintel",
    description:
      "ドラゴンとの絆を描くファンタジーアニメーション。Blender Foundationによるオープンムービープロジェクト。",
    videoUrl: TEST_STREAMS.sintel,
    thumbnailUrl: thumb(202),
    duration: 888,
    genre: "ファンタジー",
    views: 980_000,
    publishedAt: "2025-02-20T00:00:00Z",
    rating: 4.8,
    episode: 1,
    season: 1,
  },
  {
    id: "3",
    title: "Tears of Steel",
    description:
      "SF実写映画とVFXを融合させた短編作品。未来のアムステルダムを舞台にした感動ドラマ。",
    videoUrl: TEST_STREAMS.tearsOfSteel,
    thumbnailUrl: thumb(303),
    duration: 734,
    genre: "SF",
    views: 750_000,
    publishedAt: "2025-03-10T00:00:00Z",
    rating: 4.2,
    episode: 1,
    season: 1,
  },
  {
    id: "4",
    title: "コスモバトラー",
    description:
      "宇宙を舞台にした壮大なバトルアニメーション。未知の惑星で繰り広げられる冒険と友情の物語。",
    videoUrl: TEST_STREAMS.bigBuckBunny,
    thumbnailUrl: thumb(404),
    duration: 1440,
    genre: "アクション",
    views: 2_100_000,
    publishedAt: "2025-04-05T00:00:00Z",
    rating: 4.7,
    episode: 2,
    season: 1,
  },
  {
    id: "5",
    title: "魔法少女リリカ",
    description:
      "平凡な少女が魔法の力に目覚め、世界を救うために立ち上がる。心温まるファンタジーストーリー。",
    videoUrl: TEST_STREAMS.sintel,
    thumbnailUrl: thumb(505),
    duration: 1320,
    genre: "ファンタジー",
    views: 1_800_000,
    publishedAt: "2025-05-12T00:00:00Z",
    rating: 4.6,
    episode: 1,
    season: 1,
  },
  {
    id: "6",
    title: "サイバーパンク2099",
    description:
      "電脳都市を舞台にしたハードボイルドSFアニメーション。テクノロジーと人間性の狭間で葛藤するサイバー刑事の物語。",
    videoUrl: TEST_STREAMS.tearsOfSteel,
    thumbnailUrl: thumb(606),
    duration: 1560,
    genre: "SF",
    views: 3_200_000,
    publishedAt: "2025-06-18T00:00:00Z",
    rating: 4.9,
    episode: 3,
    season: 1,
  },
  {
    id: "7",
    title: "桜の約束",
    description:
      "桜咲く街で出会った二人の青春ラブコメディ。笑いと涙の高校生活を丁寧に描く。",
    videoUrl: TEST_STREAMS.mp4Sample,
    thumbnailUrl: thumb(707),
    duration: 1380,
    genre: "ロマンス",
    views: 1_400_000,
    publishedAt: "2025-07-22T00:00:00Z",
    rating: 4.3,
    episode: 1,
    season: 1,
  },
  {
    id: "8",
    title: "闇の執行者",
    description:
      "闇に潜む正義の執行者が、犯罪組織に立ち向かうダークアクション。目の離せない展開が続く。",
    videoUrl: TEST_STREAMS.bigBuckBunny,
    thumbnailUrl: thumb(808),
    duration: 1500,
    genre: "アクション",
    views: 2_800_000,
    publishedAt: "2025-08-30T00:00:00Z",
    rating: 4.4,
    episode: 4,
    season: 1,
  },
  {
    id: "9",
    title: "異世界食堂",
    description:
      "異世界に通じる不思議な食堂を舞台にしたグルメファンタジー。毎回登場する異世界の常連客と料理人の交流物語。",
    videoUrl: TEST_STREAMS.sintel,
    thumbnailUrl: thumb(909),
    duration: 1260,
    genre: "ファンタジー",
    views: 1_600_000,
    publishedAt: "2025-09-14T00:00:00Z",
    rating: 4.5,
    episode: 2,
    season: 1,
  },
  {
    id: "10",
    title: "量子フロンティア",
    description:
      "量子コンピュータが世界を変えた未来で、天才科学者が挑む宇宙の謎。知的好奇心を刺激する本格SFアニメーション。",
    videoUrl: TEST_STREAMS.tearsOfSteel,
    thumbnailUrl: thumb(1010),
    duration: 1680,
    genre: "SF",
    views: 950_000,
    publishedAt: "2025-10-01T00:00:00Z",
    rating: 4.1,
    episode: 1,
    season: 1,
  },
  {
    id: "11",
    title: "スプリングタイム",
    description:
      "春の訪れと共に始まる新生活。田舎町で新しい生活を始めるヒロインが見つける、小さな幸せの物語。",
    videoUrl: TEST_STREAMS.mp4Sample,
    thumbnailUrl: thumb(1111),
    duration: 1350,
    genre: "ロマンス",
    views: 1_100_000,
    publishedAt: "2025-11-08T00:00:00Z",
    rating: 4.0,
    episode: 2,
    season: 1,
  },
  {
    id: "12",
    title: "デモンスレイヤー外伝",
    description:
      "人気作品のスピンオフ。知られざるサイドキャラクターの過去と、彼らが鬼殺の道を選んだ理由を描く。",
    videoUrl: TEST_STREAMS.bigBuckBunny,
    thumbnailUrl: thumb(1212),
    duration: 1440,
    genre: "アクション",
    views: 4_500_000,
    publishedAt: "2025-12-25T00:00:00Z",
    rating: 4.9,
    episode: 5,
    season: 2,
  },
];

// ============================================================
// データアクセスヘルパー
// ============================================================

/** 全動画リストを返す */
export function getVideos(): Video[] {
  return videos;
}

/** IDから動画を取得する。存在しない場合は undefined */
export function getVideoById(id: string): Video | undefined {
  return videos.find((v) => v.id === id);
}

/** 指定ジャンルの動画リストを返す */
export function getVideosByGenre(genre: string): Video[] {
  return videos.filter((v) => v.genre === genre);
}

/** ユニークなジャンル一覧を取得する */
export function getGenres(): string[] {
  return [...new Set(videos.map((v) => v.genre))];
}

/** 再生時間を "MM:SS" 形式にフォーマットする */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** 再生回数を人間が読みやすい形にフォーマットする (例: 1.5M, 200K) */
export function formatViews(views: number): string {
  if (views >= 1_000_000) {
    return `${(views / 1_000_000).toFixed(1)}M`;
  }
  if (views >= 1_000) {
    return `${(views / 1_000).toFixed(0)}K`;
  }
  return views.toString();
}

/** ISO 日付文字列を "YYYY/MM/DD" にフォーマットする */
export function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  const yyyy = d.getFullYear();
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}
