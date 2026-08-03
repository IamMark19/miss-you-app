-- Run this once in your Supabase project's SQL Editor.
-- The app only ever talks to Supabase through your Vercel serverless functions
-- using the service role key, so Row Level Security does not need to be
-- enabled on these tables — the browser never touches Supabase directly.
--
-- If you're upgrading from the earlier version of this app, this schema
-- replaces the old one (adds pairing + chat + avatars). Drop the old
-- `signals` / `subscriptions` tables first if they exist, then run this.

create table if not exists pairs (
  id bigint generated always as identity primary key,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id bigint generated always as identity primary key,
  pair_id bigint not null references pairs(id) on delete cascade,
  name text not null,
  avatar text, -- a small compressed JPEG data URL, or null
  updated_at timestamptz not null default now(),
  unique (pair_id, name)
);

create table if not exists signals (
  id bigint generated always as identity primary key,
  pair_id bigint not null references pairs(id) on delete cascade,
  name text not null,
  kind text not null default 'miss', -- 'miss' | 'kiss'
  ts bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists signals_pair_ts_idx on signals (pair_id, ts desc);

create table if not exists messages (
  id bigint generated always as identity primary key,
  pair_id bigint not null references pairs(id) on delete cascade,
  name text not null,
  text text not null,
  ts bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_pair_ts_idx on messages (pair_id, ts desc);

create table if not exists subscriptions (
  id bigint generated always as identity primary key,
  pair_id bigint not null references pairs(id) on delete cascade,
  name text not null,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
