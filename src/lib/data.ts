import "server-only";

import { createSupabaseAdminClient } from "@/utils/supabase/admin";

type SubscriptionTier = "NORMAL" | "GENERAL" | "VIP";

export interface Video {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  genre: string;
  views: number;
  publishedAt: string;
  rating: number;
  episode?: number;
  season?: number;
  minimumRequiredTier: SubscriptionTier;
}

type VideoRow = {
  id: string;
  title: string;
  description: string;
  video_source_url: string;
  thumbnail_url: string;
  duration_seconds: number;
  minimum_required_tier: SubscriptionTier;
  created_at: string;
};

function toGenreLabel(tier: SubscriptionTier): string {
  if (tier === "VIP") return "VIP";
  if (tier === "GENERAL") return "General";
  return "Normal";
}

function toAppVideo(row: VideoRow): Video {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    videoUrl: row.video_source_url,
    thumbnailUrl: row.thumbnail_url,
    duration: row.duration_seconds,
    genre: toGenreLabel(row.minimum_required_tier),
    // videosテーブルに未定義のため、表示上の既定値を使用。
    views: 0,
    publishedAt: row.created_at,
    rating: 0,
    minimumRequiredTier: row.minimum_required_tier,
  };
}

export async function getVideos(): Promise<Video[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("videos")
    .select(
      "id,title,description,video_source_url,thumbnail_url,duration_seconds,minimum_required_tier,created_at",
    )
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as VideoRow[]).map(toAppVideo);
}

export async function getVideoById(id: string): Promise<Video | undefined> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("videos")
    .select(
      "id,title,description,video_source_url,thumbnail_url,duration_seconds,minimum_required_tier,created_at",
    )
    .eq("id", id)
    .maybeSingle<VideoRow>();

  if (error || !data) {
    return undefined;
  }

  return toAppVideo(data);
}

export async function getVideosByGenre(genre: string): Promise<Video[]> {
  const videos = await getVideos();
  return videos.filter((v) => v.genre === genre);
}

export async function getGenres(): Promise<string[]> {
  const videos = await getVideos();
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
  if (views <= 0) {
    return "-";
  }
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
