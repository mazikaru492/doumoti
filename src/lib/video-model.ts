import type { VideoRow } from "@/types/database";

export type SubscriptionTier = VideoRow["minimum_required_tier"];

export type Video = {
  id: string;
  title: string;
  description: string;
  video_source_url: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  minimum_required_tier: SubscriptionTier;
  created_at: string;
};

export function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatTierLabel(tier: SubscriptionTier): string {
  if (tier === "VIP") {
    return "VIP";
  }
  if (tier === "GENERAL") {
    return "General";
  }
  return "Normal";
}
