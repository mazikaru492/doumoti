-- Persist fixed preview windows for Normal plan users.
-- Run once in Supabase SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.preview_windows (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL,
  window_ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, video_id),
  CHECK (window_ends_at > window_started_at)
);

CREATE INDEX IF NOT EXISTS idx_preview_windows_user_video
  ON public.preview_windows(user_id, video_id);

COMMIT;
