-- Early-access sign-ups from the landing page. Run once in the villatrack Supabase project.
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) <= 80),
  email text not null check (char_length(email) <= 120),
  stage text check (char_length(stage) <= 40),
  lang text check (char_length(lang) <= 5)
);
alter table public.waitlist enable row level security;
drop policy if exists "anyone can join" on public.waitlist;
create policy "anyone can join" on public.waitlist for insert to anon, authenticated with check (true);
grant insert on public.waitlist to anon, authenticated;
