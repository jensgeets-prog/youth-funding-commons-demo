var e=`-- Fixes from the independent security, GDPR and UX reviews (docs/reviews.md), and the
-- scope decision of 2026-10-22: the platform is for member funders only. Nothing is
-- public, nobody applies through it, and non-profits are not users.

-- ---------- members only ----------
-- Visitors and signed-in accounts without a membership see nothing at all.
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon;

drop policy calls_read on public.calls;
create policy calls_read on public.calls for select using (public.is_member());
drop policy funders_read on public.funders;
create policy funders_read on public.funders for select using (public.is_member());
drop policy terms_read on public.terms;
create policy terms_read on public.terms for select
  using (public.is_member()
         and (status = 'active' or proposed_by = auth.uid() or public.is_federation_admin()));
drop policy custom_fields_read on public.custom_fields;
create policy custom_fields_read on public.custom_fields for select
  using (public.is_member() and (active or public.is_federation_admin()));

-- Total budget of the call, separate from the amount per grant (amount_min/max).
alter table public.calls add column total_budget bigint check (total_budget >= 0);

-- Size limits: the whole board ships to every visitor, so no field may grow unbounded.
alter table public.calls
  add constraint calls_custom_size check (pg_column_size(custom) < 16384),
  add constraint calls_eligibility_len check (jsonb_array_length(eligibility) <= 50),
  add constraint calls_criteria_len check (jsonb_array_length(criteria) <= 50),
  add constraint calls_contact_name_len check (length(contact_name) <= 200),
  add constraint calls_contact_email_len check (length(contact_email) <= 254),
  add constraint calls_apply_url_len check (length(apply_url) <= 2000),
  add constraint calls_image_url_len check (length(image_url) <= 2000);
alter table public.call_status_history
  add constraint history_reason_len check (length(reason) <= 500);
alter table public.terms
  add constraint terms_synonyms_len check (cardinality(synonyms) <= 30);

create or replace function public.call_funder(p_call uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select c.funder_id from public.calls c where c.id = p_call and public.is_member();
$$;

-- ---------- write rules the RPCs cannot be bypassed around ----------
create or replace function public.calls_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ignored text[] := array['status', 'updated_at', 'updated_by'];
begin
  if tg_op = 'INSERT' then
    -- A call starts its life planned, announced or open; never already decided.
    if new.status not in ('planned', 'opening_soon', 'open') then
      raise exception 'A new call cannot start as %', new.status using errcode = '22023';
    end if;
  else
    if new.status is distinct from old.status
       and not public.status_transition_ok(old.status, new.status) then
      raise exception 'Status cannot go from % to %', old.status, new.status using errcode = '22023';
    end if;
    -- Moving a call to another funder would carry edit rights across funders.
    if new.funder_id is distinct from old.funder_id and auth.uid() is not null
       and not public.is_federation_admin() then
      raise exception 'Only the federation can move a call to another funder' using errcode = '42501';
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

-- Column-level write grants: id, created_at, is_sample and the audit columns are set
-- by defaults and the trigger only, also for anyone calling the REST API directly.
revoke insert, update on public.calls from authenticated;
grant insert (
  funder_id, title, summary, problem, target_description, image_url, language, status,
  beneficiary, opens_at, deadline_at, decision_at, project_start, project_end, amount_min,
  amount_max, total_budget, grants_count, tranches, cofunding_allowed, age_min, age_max,
  eligibility, criteria, custom, apply_url, contact_name, contact_email, contact_language,
  planned_public
) on public.calls to authenticated;
grant update (
  funder_id, title, summary, problem, target_description, image_url, language, status,
  beneficiary, opens_at, deadline_at, decision_at, project_start, project_end, amount_min,
  amount_max, total_budget, grants_count, tranches, cofunding_allowed, age_min, age_max,
  eligibility, criteria, custom, apply_url, contact_name, contact_email, contact_language,
  planned_public
) on public.calls to authenticated;
grant select (total_budget) on public.calls to authenticated;

-- Terms change only through propose_term / review_term, which check their callers.
revoke insert, update, delete on public.terms from authenticated;

-- ---------- personal data ----------
-- Raw user ids stay out of reach; history reaches the app through call_detail only.
revoke select on public.call_status_history from authenticated;
grant select (id, call_id, from_status, to_status, changed_at)
  on public.call_status_history to authenticated;

-- Emails resolve only for people who are (still) members, and only for members.
create or replace function public.user_email(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select u.email from auth.users u
  where u.id = p_user and public.is_member()
    and exists (select 1 from public.memberships m where m.user_id = p_user);
$$;

create function public.call_history(p_call uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'from', h.from_status, 'to', h.to_status, 'at', h.changed_at,
      'reason', h.reason, 'by', public.user_email(h.changed_by))
    order by h.changed_at desc, h.id desc), '[]'::jsonb)
  from public.call_status_history h
  where h.call_id = p_call and public.is_member();
$$;
revoke execute on function public.call_history(uuid) from public, anon;
grant execute on function public.call_history(uuid) to authenticated;

create or replace function public.call_detail(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'funder_id', c.funder_id, 'title', c.title, 'summary', c.summary,
    'problem', c.problem, 'target_description', c.target_description, 'image_url', c.image_url,
    'language', c.language, 'status', c.status, 'beneficiary', c.beneficiary,
    'opens_at', c.opens_at, 'deadline_at', c.deadline_at, 'decision_at', c.decision_at,
    'project_start', c.project_start, 'project_end', c.project_end,
    'amount_min', c.amount_min, 'amount_max', c.amount_max, 'total_budget', c.total_budget,
    'grants_count', c.grants_count, 'tranches', c.tranches,
    'cofunding_allowed', c.cofunding_allowed, 'age_min', c.age_min, 'age_max', c.age_max,
    'eligibility', c.eligibility, 'criteria', c.criteria, 'custom', c.custom,
    'apply_url', c.apply_url, 'contact_language', c.contact_language,
    'planned_public', c.planned_public, 'is_sample', c.is_sample, 'updated_at', c.updated_at,
    'contact', public.call_contact(c.id),
    'funder', (select jsonb_build_object('id', f.id, 'name', f.name, 'website', f.website,
                 'intake_url', f.intake_url) from public.funders f where f.id = c.funder_id),
    'terms', coalesce((select jsonb_agg(t.term_id order by t.term_id)
                       from public.call_terms t where t.call_id = c.id), '[]'::jsonb),
    'history', public.call_history(c.id),
    'can_edit', public.can_edit_call(c.funder_id),
    'can_set_status', public.can_set_status(c.funder_id)
  )
  from public.calls c
  where c.id = p_id;
$$;

create or replace function public.board() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'funder_id', c.funder_id, 'funder_name', f.name,
    'title', c.title, 'summary', c.summary, 'problem', c.problem,
    'target_description', c.target_description, 'image_url', c.image_url,
    'language', c.language, 'status', c.status, 'beneficiary', c.beneficiary,
    'opens_at', c.opens_at, 'deadline_at', c.deadline_at, 'decision_at', c.decision_at,
    'amount_min', c.amount_min, 'amount_max', c.amount_max, 'total_budget', c.total_budget,
    'grants_count', c.grants_count, 'cofunding_allowed', c.cofunding_allowed,
    'age_min', c.age_min, 'age_max', c.age_max, 'apply_url', c.apply_url, 'custom', c.custom,
    'planned_public', c.planned_public, 'is_sample', c.is_sample, 'updated_at', c.updated_at,
    'terms', coalesce(
      (select jsonb_agg(t.term_id order by t.term_id) from public.call_terms t where t.call_id = c.id),
      '[]'::jsonb)
  ) order by c.deadline_at nulls last, c.title), '[]'::jsonb)
  from public.calls c
  join public.funders f on f.id = c.funder_id;
$$;

-- ---------- writes ----------
create or replace function public.set_call_status(p_id uuid, p_status public.call_status, p_reason text default null)
returns void language plpgsql set search_path = '' as $$
begin
  if length(p_reason) > 500 then
    raise exception 'Keep the reason under 500 characters' using errcode = '22023';
  end if;
  perform set_config('app.status_reason', coalesce(btrim(p_reason), ''), true);
  update public.calls set status = p_status where id = p_id;
  if not found then
    raise exception 'Call not found or you may not change it' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.save_call(p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.calls := jsonb_populate_record(null::public.calls, p);
  v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  if v_id is null then
    insert into public.calls (
      funder_id, title, summary, problem, target_description, image_url, language, status,
      beneficiary, opens_at, deadline_at, decision_at, project_start, project_end, amount_min,
      amount_max, total_budget, grants_count, tranches, cofunding_allowed, age_min, age_max,
      eligibility, criteria, custom, apply_url, contact_name, contact_email, contact_language,
      planned_public
    ) values (
      r.funder_id, r.title, coalesce(r.summary, ''), coalesce(r.problem, ''),
      coalesce(r.target_description, ''), r.image_url, coalesce(r.language, 'nl'),
      coalesce(r.status, 'planned'), r.beneficiary, r.opens_at, r.deadline_at, r.decision_at,
      r.project_start, r.project_end, r.amount_min, r.amount_max, r.total_budget, r.grants_count,
      r.tranches, r.cofunding_allowed, r.age_min, r.age_max, coalesce(r.eligibility, '[]'),
      coalesce(r.criteria, '[]'), coalesce(r.custom, '{}'), r.apply_url, r.contact_name,
      r.contact_email, r.contact_language, coalesce(r.planned_public, false)
    ) returning id into v_id;
  else
    update public.calls set
      funder_id = r.funder_id, title = r.title, summary = coalesce(r.summary, ''),
      problem = coalesce(r.problem, ''), target_description = coalesce(r.target_description, ''),
      image_url = r.image_url, language = coalesce(r.language, 'nl'), beneficiary = r.beneficiary,
      opens_at = r.opens_at, deadline_at = r.deadline_at, decision_at = r.decision_at,
      project_start = r.project_start, project_end = r.project_end, amount_min = r.amount_min,
      amount_max = r.amount_max, total_budget = r.total_budget, grants_count = r.grants_count,
      tranches = r.tranches, cofunding_allowed = r.cofunding_allowed, age_min = r.age_min,
      age_max = r.age_max, eligibility = coalesce(r.eligibility, '[]'),
      criteria = coalesce(r.criteria, '[]'), custom = coalesce(r.custom, '{}'),
      apply_url = r.apply_url, contact_name = r.contact_name, contact_email = r.contact_email,
      contact_language = r.contact_language, planned_public = coalesce(r.planned_public, false)
    where id = v_id;
    if not found then
      raise exception 'Call not found or you may not change it' using errcode = '42501';
    end if;
    delete from public.call_terms where call_id = v_id;
  end if;
  insert into public.call_terms (call_id, term_id)
  select v_id, jsonb_array_elements_text(coalesce(p -> 'terms', '[]'::jsonb));
  return v_id;
end;
$$;

-- Now definer, because callers no longer hold insert rights on terms; checks its caller.
create or replace function public.propose_term(p jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_kind public.term_kind := (p ->> 'kind')::public.term_kind;
  v_id text := v_kind::text || ':x_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
  v_parent text := nullif(p ->> 'parent_id', '');
begin
  if not public.can_propose_terms() then
    raise exception 'Only funder directors and managers can propose terms' using errcode = '42501';
  end if;
  if v_kind = 'region' then
    raise exception 'Regions follow NIS codes; ask the federation to add one' using errcode = '22023';
  end if;
  if (select count(*) from public.terms where proposed_by = auth.uid() and status = 'proposed') >= 20 then
    raise exception 'You have 20 open proposals; wait for the federation to review them' using errcode = '54000';
  end if;
  if v_parent is not null and not exists (
    select 1 from public.terms where id = v_parent and kind = v_kind and status = 'active') then
    raise exception 'Unknown parent term' using errcode = '22023';
  end if;
  insert into public.terms (id, kind, label_nl, label_fr, parent_id, synonyms, status, proposed_by)
  values (
    v_id, v_kind, btrim(p ->> 'label_nl'),
    coalesce(nullif(btrim(p ->> 'label_fr'), ''), btrim(p ->> 'label_nl')), v_parent,
    coalesce(array(select left(btrim(s), 80) from jsonb_array_elements_text(p -> 'synonyms') s
                   where btrim(s) <> '' limit 20), '{}'),
    'proposed', auth.uid()
  );
  return v_id;
end;
$$;

-- Same behaviour as before, plus: the proposer's id is dropped once decided, so
-- active vocabulary carries no personal data.
create or replace function public.review_term(p_id text, p_action text, p_target text default null, p jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare
  t public.terms;
begin
  if not public.is_federation_admin() then
    raise exception 'Federation admins only' using errcode = '42501';
  end if;
  select * into t from public.terms where id = p_id and status = 'proposed';
  if not found then
    raise exception 'No proposal %', p_id using errcode = 'P0002';
  end if;
  if p_action = 'approve' then
    update public.terms set
      status = 'active',
      label_nl = coalesce(nullif(btrim(p ->> 'label_nl'), ''), label_nl),
      label_fr = coalesce(nullif(btrim(p ->> 'label_fr'), ''), label_fr),
      parent_id = coalesce(nullif(p ->> 'parent_id', ''), parent_id)
    where id = p_id;
  elsif p_action = 'merge' then
    if not exists (select 1 from public.terms where id = p_target and status = 'active' and kind = t.kind) then
      raise exception 'Merge target must be an active % term', t.kind using errcode = '22023';
    end if;
    insert into public.call_terms (call_id, term_id)
    select call_id, p_target from public.call_terms where term_id = p_id
    on conflict do nothing;
    delete from public.call_terms where term_id = p_id;
    update public.terms set synonyms = (
      select coalesce(array_agg(distinct s), '{}') from (
        select s from unnest(synonyms || t.synonyms || array[t.label_nl, t.label_fr]) s limit 30) x
    ) where id = p_target;
    update public.terms set status = 'retired', merged_into = p_target where id = p_id;
  elsif p_action = 'reject' then
    delete from public.call_terms where term_id = p_id;
    update public.terms set status = 'retired' where id = p_id;
  else
    raise exception 'Unknown action %', p_action using errcode = '22023';
  end if;
  update public.terms set proposed_by = null where id = p_id;
end;
$$;

-- ---------- the federation can never lock itself out ----------
create function public.keep_one_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'federation_admin'
     and (tg_op = 'DELETE' or new.role <> 'federation_admin')
     and (select count(*) from public.memberships where role = 'federation_admin') <= 1 then
    raise exception 'The federation needs at least one admin' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;
revoke execute on function public.keep_one_admin() from public, anon, authenticated;
create trigger memberships_keep_one_admin before update or delete on public.memberships
for each row execute function public.keep_one_admin();

-- ---------- future objects are private unless a migration grants them ----------
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
`;export{e as default};