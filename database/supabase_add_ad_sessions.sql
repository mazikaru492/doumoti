-- Ad session management for serverless environment
-- Replaces in-memory Map with persistent storage

CREATE TABLE IF NOT EXISTS ad_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed BOOLEAN NOT NULL DEFAULT FALSE,
  consumed_at TIMESTAMPTZ,
  UNIQUE (user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_sessions_user_video
  ON ad_sessions(user_id, video_id);

CREATE INDEX IF NOT EXISTS idx_ad_sessions_expires
  ON ad_sessions(expires_at)
  WHERE consumed = FALSE;

-- RLS policies
ALTER TABLE ad_sessions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access" ON ad_sessions
  FOR ALL
  USING (auth.role() = 'service_role');

-- Users cannot directly access ad_sessions (handled by BFF)
CREATE POLICY "No direct user access" ON ad_sessions
  FOR ALL
  USING (FALSE);
