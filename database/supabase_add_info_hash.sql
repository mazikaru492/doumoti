-- Add unique info_hash column for robust torrent deduplication.
-- Run in Supabase SQL Editor.

ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS info_hash TEXT;

ALTER TABLE public.videos
DROP CONSTRAINT IF EXISTS videos_info_hash_format_check;

ALTER TABLE public.videos
ADD CONSTRAINT videos_info_hash_format_check
CHECK (
  info_hash IS NULL
  OR info_hash ~* '^[a-f0-9]{40}$'
);

CREATE UNIQUE INDEX IF NOT EXISTS videos_info_hash_unique_idx
ON public.videos (info_hash)
WHERE info_hash IS NOT NULL;
