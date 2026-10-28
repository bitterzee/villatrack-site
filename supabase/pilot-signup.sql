-- VillaTrack pilot: password sign-up where people choose a role, confirmed by the admin.
alter table public.vt_profiles add column if not exists requested_role text;
alter table public.vt_profiles drop constraint if exists vt_profiles_requested_role_check;
alter table public.vt_profiles add constraint vt_profiles_requested_role_check check (requested_role is null or requested_role in ('owner', 'contractor', 'inspector'));
-- the admin can clear a request when declining it
drop policy if exists "profiles: admin update" on public.vt_profiles;
create policy "profiles: admin update" on public.vt_profiles for update to authenticated using (public.vt_is_admin()) with check (public.vt_is_admin());
