-- VillaTrack pilot: run once in Supabase > SQL Editor.
-- 1) Change the email below to yours. Admins can set up the project and add people.
create table if not exists public.vt_admins (email text primary key);
insert into public.vt_admins (email) values ('CHANGE_ME@example.com') on conflict do nothing;

create table if not exists public.vt_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, name text, created_at timestamptz default now()
);
create table if not exists public.vt_docs (
  col text not null, id text not null, data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(), updated_by uuid,
  primary key (col, id)
);

create or replace function public.vt_is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from vt_admins where lower(email) = lower(auth.jwt() ->> 'email'))
$$;
create or replace function public.vt_is_member() returns boolean language sql stable security definer set search_path = public as $$
  select vt_is_admin() or exists (select 1 from vt_docs where col = 'members' and id = auth.uid()::text)
$$;
grant execute on function public.vt_is_admin(), public.vt_is_member() to authenticated;

alter table public.vt_admins enable row level security;
alter table public.vt_profiles enable row level security;
alter table public.vt_docs enable row level security;

drop policy if exists "profiles: signed-in read" on public.vt_profiles;
create policy "profiles: signed-in read" on public.vt_profiles for select to authenticated using (public.vt_is_member());
drop policy if exists "profiles: own row" on public.vt_profiles;
create policy "profiles: own row" on public.vt_profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "docs: members read" on public.vt_docs;
create policy "docs: members read" on public.vt_docs for select to authenticated using (vt_is_member());
drop policy if exists "docs: members write" on public.vt_docs;
create policy "docs: members write" on public.vt_docs for insert to authenticated with check (vt_is_member() and (col <> 'members' or vt_is_admin()));
drop policy if exists "docs: members update" on public.vt_docs;
create policy "docs: members update" on public.vt_docs for update to authenticated using (vt_is_member() and (col <> 'members' or vt_is_admin())) with check (vt_is_member() and (col <> 'members' or vt_is_admin()));
drop policy if exists "docs: admin delete" on public.vt_docs;
create policy "docs: admin delete" on public.vt_docs for delete to authenticated using (vt_is_member() and (col <> 'members' or vt_is_admin()));

-- live updates
alter table public.vt_docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.vt_docs;
exception when duplicate_object then null; end $$;

-- photos (public links with random names)
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do nothing;
drop policy if exists "photos: members upload" on storage.objects;
create policy "photos: members upload" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.vt_is_member());
