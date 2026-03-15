-- Doumoti initial schema for Vercel Postgres
-- Run this once in Vercel Postgres SQL console or via migration tooling.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier') THEN
    CREATE TYPE subscription_tier AS ENUM ('NORMAL', 'GENERAL', 'VIP');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  subscription_tier subscription_tier NOT NULL DEFAULT 'NORMAL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (position('@' IN email) > 1)
);

CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  video_source_url TEXT NOT NULL,
  minimum_required_tier subscription_tier NOT NULL DEFAULT 'NORMAL',
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A fixed preview window per user x video. The window does not reset on token refresh.
CREATE TABLE IF NOT EXISTS preview_windows (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL,
  window_ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, video_id),
  CHECK (window_ends_at > window_started_at)
);

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_videos_tier_published
  ON videos(minimum_required_tier, is_published);
CREATE INDEX IF NOT EXISTS idx_preview_windows_user_video
  ON preview_windows(user_id, video_id);

-- Safe catalog projection that never exposes the source URL.
CREATE OR REPLACE VIEW video_catalog_public AS
SELECT
  id,
  title,
  description,
  thumbnail_url,
  minimum_required_tier,
  is_published,
  created_at
FROM videos
WHERE is_published = TRUE;
