-- Run this once in your Supabase project's SQL Editor.
-- The app only ever talks to Supabase through your Vercel serverless functions
-- using the service role key, so Row Level Security does not need to be
-- enabled on these tables — the browser never touches Supabase directly.

create table if not exists signals (
  id bigint generated always as identity primary key,
  name text not null,
  ts bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists signals_ts_idx on signals (ts desc);

create table if not exists subscriptions (
  id bigint generated always as identity primary key,
  name text not null,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
