-- Add persistent Stripe customer mapping for webhook reconciliation.
-- Run once in Supabase SQL Editor.

BEGIN;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON public.profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMIT;
