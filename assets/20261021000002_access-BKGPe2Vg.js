var e=`-- Who may see and change what. Enforced here, never only in the UI.
--
-- Visibility:  calls from opening_soon on are public; planned calls are visible to
--              federation members, or to everyone when the funder opts in.
-- Editing:     director/manager edit their own funder's calls; officers change
--              status only; the federation admin edits everything.
-- Vocabulary:  directors/managers may propose terms; only the admin activates them.
-- Contacts:    contact names/emails and member emails are readable by federation
--              members only, through definer functions (see the api migration).

-- ---------- helpers (definer: they read memberships regardless of RLS) ----------

create function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m where m.user_id = auth.uid());
$$;

create function public.is_federation_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.role = 'federation_admin'
  );
$$;

create function public.funder_role(p_funder uuid) returns public.member_role
language sql stable security definer set search_path = '' as $$
  select m.role from public.memberships m where m.user_id = auth.uid() and m.funder_id = p_funder;
$$;

create function public.can_edit_call(p_funder uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_federation_admin()
      or public.funder_role(p_funder) in ('funder_director', 'funder_manager');
$$;

create function public.can_set_status(p_funder uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_edit_call(p_funder) or public.funder_role(p_funder) = 'funder_officer';
$$;

create function public.can_propose_terms() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.role in ('federation_admin', 'funder_director', 'funder_manager')
  );
$$;

create function public.call_funder(p_call uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select c.funder_id from public.calls c where c.id = p_call;
$$;

-- Mirrors TRANSITIONS in src/lib/call-status.ts (a db test checks they agree).
create function public.status_transition_ok(p_from public.call_status, p_to public.call_status)
returns boolean language sql immutable set search_path = '' as $$
  select case p_from
    when 'planned'      then p_to in ('opening_soon', 'open', 'paused', 'cancelled')
    when 'opening_soon' then p_to in ('planned', 'open', 'paused', 'cancelled')
    when 'open'         then p_to in ('under_review', 'paused', 'cancelled')
    when 'under_review' then p_to in ('decided', 'cancelled')
    when 'paused'       then p_to in ('planned', 'opening_soon', 'open', 'cancelled')
    else false
  end;
$$;

-- Checks calls.custom against the federation's custom fields. Required fields are
-- enforced when the values are written, so adding a required field later does not
-- lock existing calls; their editors are asked for it the next time they save.
create function public.check_custom(p_custom jsonb) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  f public.custom_fields;
  v jsonb;
  k text;
  v_ok boolean;
begin
  for k in select jsonb_object_keys(p_custom) loop
    if not exists (select 1 from public.custom_fields cf where cf.key = k) then
      raise exception 'Unknown custom field "%"', k using errcode = '22023';
    end if;
  end loop;
  for f in select * from public.custom_fields cf where cf.active loop
    v := p_custom -> f.key;
    if v is null or v = 'null'::jsonb
       or (jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '')
       or (jsonb_typeof(v) = 'array' and jsonb_array_length(v) = 0) then
      if f.required then
        raise exception '"%" is required', f.label_nl using errcode = '23502';
      end if;
      continue;
    end if;
    -- Assigned first: plpgsql would end an IF condition at the CASE's first THEN.
    v_ok := case f.type
      when 'number' then jsonb_typeof(v) = 'number'
      when 'amount' then jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric >= 0
      when 'boolean' then jsonb_typeof(v) = 'boolean'
      when 'select' then jsonb_typeof(v) = 'string' and f.options ? (v #>> '{}')
      when 'multiselect' then jsonb_typeof(v) = 'array' and not exists (
        select 1 from jsonb_array_elements(v) e
        where jsonb_typeof(e) <> 'string' or not f.options ? (e #>> '{}'))
      when 'date' then jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^\\d{4}-\\d{2}-\\d{2}$'
      when 'url' then jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^https?://'
      else jsonb_typeof(v) = 'string'
    end;
    if not v_ok then
      raise exception '"%" has an invalid value', f.label_nl using errcode = '22023';
    end if;
  end loop;
end;
$$;

-- ---------- triggers ----------

create function public.calls_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ignored text[] := array['status', 'updated_at', 'updated_by'];
begin
  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status
       and not public.status_transition_ok(old.status, new.status) then
      raise exception 'Status cannot go from % to %', old.status, new.status using errcode = '22023';
    end if;
    -- Officers keep status current; they do not rewrite the call.
    if auth.uid() is not null and not public.can_edit_call(old.funder_id)
       and (to_jsonb(new) - v_ignored) is distinct from (to_jsonb(old) - v_ignored) then
      raise exception 'Officers can only change the status of a call' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'INSERT' or new.custom is distinct from old.custom then
    perform public.check_custom(new.custom);
  end if;
  if (tg_op = 'INSERT' or new.status is distinct from old.status)
     and new.status in ('paused', 'cancelled')
     and coalesce(current_setting('app.status_reason', true), '') = '' then
    raise exception 'A reason is required to pause or cancel a call' using errcode = '22023';
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger calls_before_write before insert or update on public.calls
for each row execute function public.calls_before_write();

create function public.calls_log_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.call_status_history (call_id, from_status, to_status, reason, changed_by)
    values (
      new.id,
      case when tg_op = 'UPDATE' then old.status end,
      new.status,
      nullif(current_setting('app.status_reason', true), ''),
      auth.uid()
    );
  end if;
  return null;
end;
$$;

create trigger calls_log_status after insert or update of status on public.calls
for each row execute function public.calls_log_status();

-- ---------- row level security ----------

alter table public.funders enable row level security;
alter table public.memberships enable row level security;
alter table public.terms enable row level security;
alter table public.calls enable row level security;
alter table public.call_terms enable row level security;
alter table public.call_status_history enable row level security;
alter table public.custom_fields enable row level security;

create policy funders_read on public.funders for select using (true);
create policy funders_admin on public.funders for all
  using (public.is_federation_admin()) with check (public.is_federation_admin());

-- Proposed terms are private to their proposer until the federation approves them.
create policy terms_read on public.terms for select
  using (status = 'active' or proposed_by = auth.uid() or public.is_federation_admin());
create policy terms_propose on public.terms for insert
  with check (
    public.is_federation_admin()
    or (status = 'proposed' and proposed_by = auth.uid() and public.can_propose_terms())
  );
create policy terms_admin_update on public.terms for update
  using (public.is_federation_admin()) with check (public.is_federation_admin());
create policy terms_admin_delete on public.terms for delete
  using (public.is_federation_admin());

create policy memberships_read on public.memberships for select
  using (user_id = auth.uid() or public.is_federation_admin());
create policy memberships_admin on public.memberships for all
  using (public.is_federation_admin()) with check (public.is_federation_admin());

create policy calls_read on public.calls for select
  using (status <> 'planned' or planned_public or public.is_member());
create policy calls_insert on public.calls for insert
  with check (public.can_edit_call(funder_id));
create policy calls_update on public.calls for update
  using (public.can_set_status(funder_id)) with check (public.can_set_status(funder_id));
create policy calls_delete on public.calls for delete
  using (public.can_edit_call(funder_id));

create policy call_terms_read on public.call_terms for select
  using (exists (select 1 from public.calls c where c.id = call_id));
-- Only terms the caller can see (active, or their own proposals) can be attached.
create policy call_terms_write on public.call_terms for insert
  with check (
    public.can_edit_call(public.call_funder(call_id))
    and exists (select 1 from public.terms t where t.id = term_id and t.status <> 'retired')
  );
create policy call_terms_delete on public.call_terms for delete
  using (public.can_edit_call(public.call_funder(call_id)));

create policy history_read on public.call_status_history for select
  using (exists (select 1 from public.calls c where c.id = call_id));

create policy custom_fields_read on public.custom_fields for select
  using (active or public.is_federation_admin());
create policy custom_fields_admin on public.custom_fields for all
  using (public.is_federation_admin()) with check (public.is_federation_admin());

-- ---------- table privileges ----------

revoke all on all tables in schema public from anon, authenticated;
grant select on public.funders, public.terms, public.call_terms, public.call_status_history,
  public.custom_fields to anon, authenticated;
grant select (
  id, funder_id, title, summary, problem, target_description, image_url, language, status,
  beneficiary, opens_at, deadline_at, decision_at, project_start, project_end, amount_min,
  amount_max, grants_count, tranches, cofunding_allowed, age_min, age_max, eligibility, criteria,
  custom, apply_url, contact_language, planned_public, is_sample, created_at, updated_at
) on public.calls to anon, authenticated;
grant insert, update, delete on public.calls, public.call_terms to authenticated;
grant insert, update, delete on public.funders, public.terms, public.custom_fields
  to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;
-- Visitors read their (empty) memberships through me(); RLS returns no rows for them.
grant select on public.memberships to anon;
`;export{e as default};