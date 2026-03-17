export type SubscriptionTier = "NORMAL" | "GENERAL" | "VIP";

export interface VideoRow {
  id: string;
  title: string;
  description: string;
  video_source_url: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  minimum_required_tier: SubscriptionTier;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      videos: {
        Row: VideoRow;
      };
    };
  };
}
