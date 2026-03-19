-- Add stripe_customer_id column to profiles table
alter table profiles
add column if not exists stripe_customer_id text unique;

-- Create index for faster lookups
create index if not exists idx_profiles_stripe_customer_id
on profiles(stripe_customer_id);

-- Create stripe_events table for webhook deduplication
create table if not exists stripe_events (
  id bigint primary key generated always as identity,
  event_id text not null unique,
  processed_at timestamptz not null default now()
);

-- Create index for faster lookups
create index if not exists idx_stripe_events_event_id
on stripe_events(event_id);

-- Enable RLS on stripe_events (admin-only access)
alter table stripe_events enable row level security;

-- No public policies needed - admin client only
