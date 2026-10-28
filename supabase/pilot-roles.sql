-- VillaTrack pilot: role rules enforced by the database (run after pilot-schema.sql).
-- Admin: everything. Owner, contractor, inspector: only what their role does.

create or replace function public.vt_role() returns text language sql stable security definer set search_path = public as $$
  select case
    when vt_is_admin() then 'admin'
    else (select data ->> 'role' from vt_docs where col = 'members' and id = auth.uid()::text)
  end
$$;
grant execute on function public.vt_role() to authenticated;

-- Who may read which collection: the owner's bank top-ups, exchange-rate settings and weekly money recap stay with owner and admin.
drop policy if exists "docs: members read" on public.vt_docs;
create policy "docs: members read" on public.vt_docs for select to authenticated using (
  vt_is_member() and (col not in ('funding', 'money', 'digests') or vt_role() in ('admin', 'owner'))
);

-- Who may write which collection.
create or replace function public.vt_can_write(c text) returns boolean language sql stable security definer set search_path = public as $$
  select case
    when vt_role() = 'admin' then true
    when vt_role() is null then false
    when c in ('members', 'project') then false
    when c in ('funding', 'money', 'digests') then vt_role() = 'owner'
    else true
  end
$$;
grant execute on function public.vt_can_write(text) to authenticated;

drop policy if exists "docs: members write" on public.vt_docs;
create policy "docs: members write" on public.vt_docs for insert to authenticated with check (vt_can_write(col));
drop policy if exists "docs: members update" on public.vt_docs;
create policy "docs: members update" on public.vt_docs for update to authenticated using (vt_can_write(col) and col <> 'audit') with check (vt_can_write(col) and col <> 'audit');
drop policy if exists "docs: admin delete" on public.vt_docs;
create policy "docs: admin delete" on public.vt_docs for delete to authenticated using (
  vt_can_write(col) and (vt_role() = 'admin' or col not in ('milestones', 'audit', 'logs', 'activities', 'wbs'))
);

-- Payment steps: each role can only move a step the way its job allows.
create or replace function public.vt_check_milestone() returns trigger language plpgsql security definer set search_path = public as $$
declare
  r text := vt_role();
  old_s text := coalesce(old.data ->> 'status', 'not_started');
  new_s text := coalesce(new.data ->> 'status', 'not_started');
  ctype text := (select data ->> 'contractType' from vt_docs where col = 'project' and id = 'main');
begin
  if new.col <> 'milestones' or r = 'admin' or auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    -- the app saves with upsert: an insert of an existing step becomes an update, which is checked below
    if exists (select 1 from vt_docs where col = new.col and id = new.id) then return new; end if;
    raise exception 'Only the admin can add payment steps' using errcode = '42501';
  end if;
  -- the plan itself (name, share of contract, order, rule, check type) is admin-only
  if (old.data -> 'name') is distinct from (new.data -> 'name') or (old.data -> 'pct') is distinct from (new.data -> 'pct')
     or (old.data -> 'seq') is distinct from (new.data -> 'seq') or (old.data -> 'rule') is distinct from (new.data -> 'rule')
     or (old.data -> 'form') is distinct from (new.data -> 'form') or (old.data -> 'needsInspection') is distinct from (new.data -> 'needsInspection') then
    raise exception 'Only the admin can change the payment plan' using errcode = '42501';
  end if;
  if old_s = new_s then return new; end if;
  if r = 'contractor' and new_s in ('in_progress', 'submitted', 'insp_requested') then return new; end if;
  if r = 'inspector' and new_s in ('insp_scheduled', 'inspected', 'failed') then return new; end if;
  if r = 'owner' and new_s in ('approved', 'disputed') then return new; end if;
  if r = 'owner' and new_s = 'released' and ctype = 'costplus' then return new; end if;
  raise exception 'Your role (%) can''t move this step from % to %', coalesce(r, 'none'), old_s, new_s using errcode = '42501';
end $$;
drop trigger if exists vt_check_milestone on public.vt_docs;
create trigger vt_check_milestone before insert or update on public.vt_docs for each row execute function public.vt_check_milestone();
