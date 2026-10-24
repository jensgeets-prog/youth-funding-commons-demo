var e=`-- Beyond Belgium, rolling intake, and learning from results.
--
-- Geography: funders also fund projects, young people and partners abroad, and much
-- funding is topic-specific but not tied to a place. "Everywhere" is the root of the
-- region tree, so a place-agnostic call matches every region filter.
-- Results: once a call is decided, the funder records what came in, what was granted,
-- reach, targets vs actuals per impact metric, and lessons, so peers can learn by topic.

-- ---------- permission helpers return false, never null ----------
-- funder_role() is null without a membership, so these returned null; in RLS that
-- reads as "no", but \`if not can_edit_call(...)\` in plpgsql would let null through.
create or replace function public.can_edit_call(p_funder uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.is_federation_admin()
      or public.funder_role(p_funder) in ('funder_director', 'funder_manager'), false);
$$;

create or replace function public.can_set_status(p_funder uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.can_edit_call(p_funder) or public.funder_role(p_funder) = 'funder_officer', false);
$$;

-- ---------- geography ----------
insert into public.terms (id, kind, label_nl, label_fr, parent_id, synonyms, sort) values
  ('geo:world', 'region', 'Overal (geen geografische beperking)', 'Partout (sans limite géographique)', null,
   '{wereldwijd,internationaal,overal,mondial,international,partout,worldwide,global}', 0);
insert into public.terms (id, kind, label_nl, label_fr, parent_id, synonyms, sort) values
  ('geo:europe', 'region', 'Europa', 'Europe', 'geo:world', '{europa,europe,europees,européen}', 1),
  ('geo:africa', 'region', 'Afrika', 'Afrique', 'geo:world', '{afrika,afrique,africa}', 2),
  ('geo:asia', 'region', 'Azië en Midden-Oosten', 'Asie et Moyen-Orient', 'geo:world', '{azië,asie,asia,midden-oosten}', 3),
  ('geo:americas', 'region', 'Amerika''s', 'Amériques', 'geo:world', '{amerika,amérique,americas,latijns-amerika}', 4);
update public.terms set parent_id = 'geo:europe' where id = 'nis:be';
insert into public.terms (id, kind, label_nl, label_fr, parent_id, synonyms, sort) values
  ('geo:nl', 'region', 'Nederland', 'Pays-Bas', 'geo:europe', '{nederland,pays-bas,netherlands}', 2),
  ('geo:fr', 'region', 'Frankrijk', 'France', 'geo:europe', '{frankrijk,france}', 3),
  ('geo:lu', 'region', 'Luxemburg (land)', 'Luxembourg (pays)', 'geo:europe', '{groothertogdom}', 4),
  ('geo:de', 'region', 'Duitsland', 'Allemagne', 'geo:europe', '{duitsland,allemagne,germany}', 5),
  ('geo:cd', 'region', 'DR Congo', 'RD Congo', 'geo:africa', '{congo,kinshasa}', 1),
  ('geo:rw', 'region', 'Rwanda', 'Rwanda', 'geo:africa', '{rwanda}', 2),
  ('geo:bi', 'region', 'Burundi', 'Burundi', 'geo:africa', '{burundi}', 3),
  ('geo:ma', 'region', 'Marokko', 'Maroc', 'geo:africa', '{marokko,maroc,morocco}', 4),
  ('geo:sn', 'region', 'Senegal', 'Sénégal', 'geo:africa', '{senegal,sénégal}', 5);

-- ---------- rolling intake ----------
create type public.deadline_type as enum ('fixed', 'rolling');
alter table public.calls add column deadline_type public.deadline_type not null default 'fixed';
grant insert (deadline_type), update (deadline_type), select (deadline_type)
  on public.calls to authenticated;

-- ---------- impact metrics: target at call time, actual afterwards ----------
create table public.call_metrics (
  call_id uuid not null references public.calls (id) on delete cascade,
  term_id text not null references public.terms (id) on update cascade,
  target numeric check (target >= 0),
  actual numeric check (actual >= 0),
  unit text check (length(unit) <= 40),
  primary key (call_id, term_id)
);

-- ---------- results and lessons, one row per call ----------
create table public.call_results (
  call_id uuid primary key references public.calls (id) on delete cascade,
  applications_received integer check (applications_received >= 0),
  grants_awarded integer check (grants_awarded >= 0),
  amount_awarded bigint check (amount_awarded >= 0),
  youth_reached integer check (youth_reached >= 0),
  what_worked text not null default '' check (length(what_worked) <= 2000),
  what_to_improve text not null default '' check (length(what_to_improve) <= 2000),
  advice text not null default '' check (length(advice) <= 2000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.call_metrics enable row level security;
alter table public.call_results enable row level security;

create policy call_metrics_read on public.call_metrics for select
  using (exists (select 1 from public.calls c where c.id = call_id));
create policy call_metrics_write on public.call_metrics for all
  using (public.can_edit_call(public.call_funder(call_id)))
  with check (public.can_edit_call(public.call_funder(call_id)));
create policy call_results_read on public.call_results for select
  using (exists (select 1 from public.calls c where c.id = call_id));
create policy call_results_write on public.call_results for all
  using (public.can_edit_call(public.call_funder(call_id)))
  with check (public.can_edit_call(public.call_funder(call_id)));

grant select, insert, update, delete on public.call_metrics to authenticated;
grant select (call_id, applications_received, grants_awarded, amount_awarded, youth_reached,
  what_worked, what_to_improve, advice, updated_at) on public.call_results to authenticated;
grant insert, update, delete on public.call_results to authenticated;

create function public.call_results_touch() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;
revoke execute on function public.call_results_touch() from public, anon, authenticated;
create trigger call_results_touch before insert or update on public.call_results
for each row execute function public.call_results_touch();

-- ---------- reads ----------
create or replace function public.board() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'funder_id', c.funder_id, 'funder_name', f.name,
    'title', c.title, 'summary', c.summary, 'problem', c.problem,
    'target_description', c.target_description, 'image_url', c.image_url,
    'language', c.language, 'status', c.status, 'beneficiary', c.beneficiary,
    'opens_at', c.opens_at, 'deadline_at', c.deadline_at, 'deadline_type', c.deadline_type,
    'decision_at', c.decision_at,
    'amount_min', c.amount_min, 'amount_max', c.amount_max, 'total_budget', c.total_budget,
    'grants_count', c.grants_count, 'cofunding_allowed', c.cofunding_allowed,
    'age_min', c.age_min, 'age_max', c.age_max, 'apply_url', c.apply_url, 'custom', c.custom,
    'planned_public', c.planned_public, 'is_sample', c.is_sample, 'updated_at', c.updated_at,
    'has_results', exists (select 1 from public.call_results r where r.call_id = c.id),
    'terms', coalesce(
      (select jsonb_agg(t.term_id order by t.term_id) from public.call_terms t where t.call_id = c.id),
      '[]'::jsonb)
  ) order by c.deadline_at nulls last, c.title), '[]'::jsonb)
  from public.calls c
  join public.funders f on f.id = c.funder_id;
$$;

-- Definer so it can drop updated_by itself; members only, like every read.
create function public.call_learning(p_call uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'metrics', coalesce((select jsonb_agg(jsonb_build_object(
        'term_id', m.term_id, 'target', m.target, 'actual', m.actual, 'unit', m.unit)
        order by m.term_id) from public.call_metrics m where m.call_id = p_call), '[]'::jsonb),
    'results', (select to_jsonb(r) - 'call_id' - 'updated_by'
                from public.call_results r where r.call_id = p_call)
  )
  where public.is_member();
$$;

create or replace function public.call_detail(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'funder_id', c.funder_id, 'title', c.title, 'summary', c.summary,
    'problem', c.problem, 'target_description', c.target_description, 'image_url', c.image_url,
    'language', c.language, 'status', c.status, 'beneficiary', c.beneficiary,
    'opens_at', c.opens_at, 'deadline_at', c.deadline_at, 'deadline_type', c.deadline_type,
    'decision_at', c.decision_at, 'project_start', c.project_start, 'project_end', c.project_end,
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
  ) || public.call_learning(c.id)
  from public.calls c
  where c.id = p_id;
$$;

-- Everything the results view needs: every visible call that has results or actuals.
create function public.results() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(public.call_learning(c.id) || jsonb_build_object('call_id', c.id)), '[]'::jsonb)
  from public.calls c
  where exists (select 1 from public.call_results r where r.call_id = c.id)
     or exists (select 1 from public.call_metrics m where m.call_id = c.id and m.actual is not null);
$$;

-- ---------- writes ----------
create or replace function public.save_call(p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.calls := jsonb_populate_record(null::public.calls, p);
  v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  if v_id is null then
    insert into public.calls (
      funder_id, title, summary, problem, target_description, image_url, language, status,
      beneficiary, opens_at, deadline_at, deadline_type, decision_at, project_start, project_end,
      amount_min, amount_max, total_budget, grants_count, tranches, cofunding_allowed, age_min,
      age_max, eligibility, criteria, custom, apply_url, contact_name, contact_email,
      contact_language, planned_public
    ) values (
      r.funder_id, r.title, coalesce(r.summary, ''), coalesce(r.problem, ''),
      coalesce(r.target_description, ''), r.image_url, coalesce(r.language, 'nl'),
      coalesce(r.status, 'planned'), r.beneficiary, r.opens_at, r.deadline_at,
      coalesce(r.deadline_type, 'fixed'), r.decision_at, r.project_start, r.project_end,
      r.amount_min, r.amount_max, r.total_budget, r.grants_count, r.tranches, r.cofunding_allowed,
      r.age_min, r.age_max, coalesce(r.eligibility, '[]'), coalesce(r.criteria, '[]'),
      coalesce(r.custom, '{}'), r.apply_url, r.contact_name, r.contact_email, r.contact_language,
      coalesce(r.planned_public, false)
    ) returning id into v_id;
  else
    update public.calls set
      funder_id = r.funder_id, title = r.title, summary = coalesce(r.summary, ''),
      problem = coalesce(r.problem, ''), target_description = coalesce(r.target_description, ''),
      image_url = r.image_url, language = coalesce(r.language, 'nl'), beneficiary = r.beneficiary,
      opens_at = r.opens_at, deadline_at = r.deadline_at,
      deadline_type = coalesce(r.deadline_type, 'fixed'), decision_at = r.decision_at,
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
  -- Metric targets follow the chosen metric terms; recorded actuals are kept.
  delete from public.call_metrics m
  where m.call_id = v_id and not exists (
    select 1 from public.call_terms t join public.terms x on x.id = t.term_id
    where t.call_id = v_id and t.term_id = m.term_id and x.kind = 'metric');
  insert into public.call_metrics (call_id, term_id, target, unit)
  select v_id, e ->> 'term_id', nullif(e ->> 'target', '')::numeric, nullif(btrim(e ->> 'unit'), '')
  from jsonb_array_elements(coalesce(p -> 'metrics', '[]'::jsonb)) e
  where exists (select 1 from public.call_terms t where t.call_id = v_id and t.term_id = e ->> 'term_id')
  on conflict (call_id, term_id) do update set target = excluded.target, unit = excluded.unit;
  return v_id;
end;
$$;

-- Results, lessons and metric actuals, after (or during) the decision.
create function public.save_results(p_call uuid, p jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  r public.call_results := jsonb_populate_record(null::public.call_results, p);
begin
  if not public.can_edit_call(public.call_funder(p_call)) then
    raise exception 'Call not found or you may not change it' using errcode = '42501';
  end if;
  insert into public.call_results (call_id, applications_received, grants_awarded, amount_awarded,
    youth_reached, what_worked, what_to_improve, advice)
  values (p_call, r.applications_received, r.grants_awarded, r.amount_awarded, r.youth_reached,
    coalesce(r.what_worked, ''), coalesce(r.what_to_improve, ''), coalesce(r.advice, ''))
  on conflict (call_id) do update set
    applications_received = excluded.applications_received, grants_awarded = excluded.grants_awarded,
    amount_awarded = excluded.amount_awarded, youth_reached = excluded.youth_reached,
    what_worked = excluded.what_worked, what_to_improve = excluded.what_to_improve,
    advice = excluded.advice;
  update public.call_metrics m set actual = nullif(e ->> 'actual', '')::numeric
  from jsonb_array_elements(coalesce(p -> 'metrics', '[]'::jsonb)) e
  where m.call_id = p_call and m.term_id = e ->> 'term_id';
end;
$$;

-- A yearly programme starts from last year's call: same content, no dates, planned.
-- Definer because it copies the contact columns, which callers cannot read directly;
-- it checks the caller may edit that funder's calls first.
create function public.duplicate_call(p_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_new uuid;
begin
  if not public.can_edit_call(public.call_funder(p_id)) then
    raise exception 'Call not found or you may not change it' using errcode = '42501';
  end if;
  insert into public.calls (funder_id, title, summary, problem, target_description, image_url,
    language, status, beneficiary, deadline_type, amount_min, amount_max, total_budget,
    grants_count, tranches, cofunding_allowed, age_min, age_max, eligibility, criteria, custom,
    apply_url, contact_name, contact_email, contact_language)
  select funder_id, left(title, 190) || ' (kopie)', summary, problem, target_description, image_url,
    language, 'planned', beneficiary, deadline_type, amount_min, amount_max, total_budget,
    grants_count, tranches, cofunding_allowed, age_min, age_max, eligibility, criteria, custom,
    apply_url, contact_name, contact_email, contact_language
  from public.calls where id = p_id
  returning id into v_new;
  if v_new is null then
    raise exception 'Call not found or you may not change it' using errcode = '42501';
  end if;
  insert into public.call_terms (call_id, term_id)
  select v_new, term_id from public.call_terms where call_id = p_id;
  insert into public.call_metrics (call_id, term_id, target, unit)
  select v_new, term_id, target, unit from public.call_metrics where call_id = p_id;
  return v_new;
end;
$$;

-- "Still current": confirms the call without changing it, which clears the stale nudge.
-- Officers may do this too (status-only rule: nothing else changes).
create function public.mark_current(p_id uuid) returns void
language plpgsql set search_path = '' as $$
begin
  update public.calls set status = status where id = p_id;
  if not found then
    raise exception 'Call not found or you may not change it' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.call_learning(uuid), public.results(),
  public.save_results(uuid, jsonb), public.duplicate_call(uuid), public.mark_current(uuid)
  from public, anon;
grant execute on function public.call_learning(uuid), public.results(),
  public.save_results(uuid, jsonb), public.duplicate_call(uuid), public.mark_current(uuid)
  to authenticated;
`;export{e as default};