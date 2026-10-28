-- Run once in Supabase: SQL Editor > New query > paste > Run
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) <= 80),
  email text not null check (char_length(email) <= 120),
  area text, stage text,
  live text check (char_length(live) <= 80),
  lang text
);
alter table public.waitlist enable row level security;
-- Visitors can add themselves but cannot read anyone's entry.
create policy "anyone can join" on public.waitlist
  for insert to anon with check (true);
-- You read entries in the Supabase dashboard (Table Editor), which bypasses these rules.
