-- Add a failsafe CHECK constraint for video_source_url format.
-- Run in Supabase SQL Editor.

ALTER TABLE public.videos
DROP CONSTRAINT IF EXISTS videos_video_source_url_format_check;

ALTER TABLE public.videos
ADD CONSTRAINT videos_video_source_url_format_check
CHECK (
  char_length(btrim(video_source_url)) > 0
  AND video_source_url ~* '^https?://'
);
