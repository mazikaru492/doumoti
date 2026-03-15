-- Doumoti schema + RLS for Supabase
-- Paste into Supabase SQL Editor and run in one transaction-safe pass.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'subscription_tier'
  ) THEN
    CREATE TYPE public.subscription_tier AS ENUM ('NORMAL', 'GENERAL', 'VIP');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_tier public.subscription_tier NOT NULL DEFAULT 'NORMAL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  video_source_url TEXT NOT NULL,
  minimum_required_tier public.subscription_tier NOT NULL DEFAULT 'NORMAL',
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_tier ON public.profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_videos_tier ON public.videos(minimum_required_tier);

-- Optional but recommended: auto-create profile when auth.users row is created.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- -----------------------------
-- profiles RLS policies
-- -----------------------------
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- -----------------------------
-- videos RLS policy
-- -----------------------------
DROP POLICY IF EXISTS "videos_select_all_rows" ON public.videos;
CREATE POLICY "videos_select_all_rows"
ON public.videos
FOR SELECT
TO anon, authenticated
USING (true);

-- -----------------------------
-- Column-level shielding for video_source_url
-- -----------------------------
-- RLS controls rows only. To hide sensitive columns, use column-level GRANTs.
REVOKE ALL ON TABLE public.videos FROM anon, authenticated;

GRANT SELECT (
  id,
  title,
  description,
  thumbnail_url,
  minimum_required_tier,
  duration_seconds,
  created_at
)
ON public.videos
TO anon, authenticated;

-- Never grant this to anon/authenticated. Keep it server-only via service role.
REVOKE SELECT (video_source_url)
ON public.videos
FROM anon, authenticated;

COMMIT;
