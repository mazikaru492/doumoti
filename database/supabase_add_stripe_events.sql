-- Stripe event deduplication table
-- Prevents duplicate webhook processing in serverless environment

CREATE TABLE IF NOT EXISTS stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id
  ON stripe_events(event_id);

-- Auto-cleanup old events (older than 7 days)
CREATE INDEX IF NOT EXISTS idx_stripe_events_created_at
  ON stripe_events(created_at);

-- RLS policies
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access
CREATE POLICY "Service role full access" ON stripe_events
  FOR ALL
  USING (auth.role() = 'service_role');
