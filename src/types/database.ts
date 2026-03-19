export type SubscriptionTier = "NORMAL" | "GENERAL" | "VIP";

export interface VideoRow {
  id: string;
  title: string;
  description: string;
  video_source_url: string;
  thumbnail_url: string;
  duration_seconds: number;
  minimum_required_tier: SubscriptionTier;
  created_at: string;
  info_hash?: string | null;
}

export type VideoCatalogRow = Pick<
  VideoRow,
  | "id"
  | "title"
  | "description"
  | "thumbnail_url"
  | "duration_seconds"
  | "minimum_required_tier"
  | "created_at"
>;

export interface ProfileRow {
  id: string;
  subscription_tier: SubscriptionTier;
  stripe_customer_id: string | null;
  created_at: string;
}

export interface StripeEventRow {
  id: number;
  event_id: string;
  processed_at: string;
}

export interface NoteRow {
  id: number;
  title: string;
}

export interface Database {
  public: {
    Tables: {
      videos: {
        Row: VideoRow;
      };
      profiles: {
        Row: ProfileRow;
      };
      stripe_events: {
        Row: StripeEventRow;
      };
      notes: {
        Row: NoteRow;
      };
    };
  };
}
