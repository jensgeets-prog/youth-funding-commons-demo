var e=`-- The app's whole data API. Every read and write goes through these functions so the
-- same calls work against Supabase (supabase.rpc) and the in-browser demo (PGlite).
-- All are security invoker, so RLS decides what each caller gets, except the small
-- definer helpers that reveal personal data to federation members only and the
-- admin functions that check the role themselves.

-- ---------- personal data, members only ----------

create function public.user_email(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select u.email from auth.users u where u.id = p_user and public.is_member();
$$;

create function public.call_contact(p_call uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', c.contact_name, 'email', c.contact_email)
  from public.calls c
  where c.id = p_call and public.is_member();
$$;

-- ---------- reads ----------

-- Everything the board views need, for every call the caller may see. Filtering,
-- sorting and derived states (closing soon, stale) happen client-side.
-- ponytail: one payload for all calls; fine to a few thousand calls, then page server-side.
create function public.board() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'funder_id', c.funder_id, 'funder_name', f.name,
    'title', c.title, 'summary', c.summary, 'problem', c.problem,
    'target_description', c.target_description, 'image_url', c.image_url,
    'language', c.language, 'status', c.status, 'beneficiary', c.beneficiary,
    'opens_at', c.opens_at, 'deadline_at', c.deadline_at, 'decision_at', c.decision_at,
    'amount_min', c.amount_min, 'amount_max', c.amount_max, 'grants_count', c.grants_count,
    'cofunding_allowed', c.cofunding_allowed, 'age_min', c.age_min, 'age_max', c.age_max,
    'apply_url', c.apply_url, 'custom', c.custom, 'planned_public', c.planned_public,
    'is_sample', c.is_sample, 'updated_at', c.updated_at,
    'terms', coalesce(
      (select jsonb_agg(t.term_id order by t.term_id) from public.call_terms t where t.call_id = c.id),
      '[]'::jsonb)
  ) order by c.deadline_at nulls last, c.title), '[]'::jsonb)
  from public.calls c
  join public.funders f on f.id = c.funder_id;
$$;

create function public.call_detail(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'funder_id', c.funder_id, 'title', c.title, 'summary', c.summary,
    'problem', c.problem, 'target_description', c.target_description, 'image_url', c.image_url,
    'language', c.language, 'status', c.status, 'beneficiary', c.beneficiary,
    'opens_at', c.opens_at, 'deadline_at', c.deadline_at, 'decision_at', c.decision_at,
    'project_start', c.project_start, 'project_end', c.project_end,
    'amount_min', c.amount_min, 'amount_max', c.amount_max, 'grants_count', c.grants_count,
    'tranches', c.tranches, 'cofunding_allowed', c.cofunding_allowed,
    'age_min', c.age_min, 'age_max', c.age_max,
    'eligibility', c.eligibility, 'criteria', c.criteria, 'custom', c.custom,
    'apply_url', c.apply_url, 'contact_language', c.contact_language,
    'planned_public', c.planned_public, 'is_sample', c.is_sample, 'updated_at', c.updated_at,
    'contact', public.call_contact(c.id),
    'funder', (select jsonb_build_object('id', f.id, 'name', f.name, 'website', f.website,
                 'intake_url', f.intake_url) from public.funders f where f.id = c.funder_id),
    'terms', coalesce((select jsonb_agg(t.term_id order by t.term_id)
                       from public.call_terms t where t.call_id = c.id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object(
                  'from', h.from_status, 'to', h.to_status, 'reason', h.reason,
                  'at', h.changed_at, 'by', public.user_email(h.changed_by))
                  order by h.changed_at desc, h.id desc)
                from public.call_status_history h where h.call_id = c.id), '[]'::jsonb),
    'can_edit', public.can_edit_call(c.funder_id),
    'can_set_status', public.can_set_status(c.funder_id)
  )
  from public.calls c
  where c.id = p_id;
$$;

create function public.taxonomy() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'terms', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'kind', t.kind, 'label_nl', t.label_nl, 'label_fr', t.label_fr,
        'parent_id', t.parent_id, 'sdgs', to_jsonb(t.sdgs), 'synonyms', to_jsonb(t.synonyms),
        'status', t.status, 'mine', t.proposed_by = auth.uid(), 'merged_into', t.merged_into)
        order by t.kind, t.sort, t.label_nl)
      from public.terms t), '[]'::jsonb),
    'funders', coalesce((select jsonb_agg(jsonb_build_object(
        'id', f.id, 'name', f.name, 'kind', f.kind, 'website', f.website,
        'intake_url', f.intake_url, 'is_member', f.is_member) order by f.name)
      from public.funders f), '[]'::jsonb),
    'custom_fields', coalesce((select jsonb_agg(to_jsonb(cf) - 'created_at' order by cf.sort, cf.key)
      from public.custom_fields cf), '[]'::jsonb)
  );
$$;

create function public.me() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object(
        'funder_id', m.funder_id, 'funder_name', f.name, 'role', m.role) order by f.name nulls first)
      from public.memberships m left join public.funders f on f.id = m.funder_id
      where m.user_id = auth.uid()), '[]'::jsonb)
  );
$$;

-- ---------- writes ----------

create function public.set_call_status(p_id uuid, p_status public.call_status, p_reason text default null)
returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('app.status_reason', coalesce(btrim(p_reason), ''), true);
  update public.calls set status = p_status where id = p_id;
  if not found then
    raise exception 'Call not found or you may not change it' using errcode = '42501';
  end if;
end;
$$;

-- Creates (no id) or updates a call and replaces its terms. Status is set on create
-- only; afterwards it changes through set_call_status so every change is logged.
create function public.save_call(p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.calls := jsonb_populate_record(null::public.calls, p);
  v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  if v_id is null then
    insert into public.calls (
      funder_id, title, summary, problem, target_description, image_url, language, status,
      beneficiary, opens_at, deadline_at, decision_at, project_start, project_end, amount_min,
      amount_max, grants_count, tranches, cofunding_allowed, age_min, age_max, eligibility,
      criteria, custom, apply_url, contact_name, contact_email, contact_language, planned_public
    ) values (
      r.funder_id, r.title, coalesce(r.summary, ''), coalesce(r.problem, ''),
      coalesce(r.target_description, ''), r.image_url, coalesce(r.language, 'nl'),
      coalesce(r.status, 'planned'), r.beneficiary, r.opens_at, r.deadline_at, r.decision_at,
      r.project_start, r.project_end, r.amount_min, r.amount_max, r.grants_count, r.tranches,
      r.cofunding_allowed, r.age_min, r.age_max, coalesce(r.eligibility, '[]'),
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
      amount_max = r.amount_max, grants_count = r.grants_count, tranches = r.tranches,
      cofunding_allowed = r.cofunding_allowed, age_min = r.age_min, age_max = r.age_max,
      eligibility = coalesce(r.eligibility, '[]'), criteria = coalesce(r.criteria, '[]'),
      custom = coalesce(r.custom, '{}'), apply_url = r.apply_url, contact_name = r.contact_name,
      contact_email = r.contact_email, contact_language = r.contact_language,
      planned_public = coalesce(r.planned_public, false)
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

-- A funder proposes a term it cannot find. It is usable on the proposer's calls at
-- once and becomes a shared facet only after the federation approves it.
create function public.propose_term(p jsonb) returns text
language plpgsql set search_path = '' as $$
declare
  v_kind public.term_kind := (p ->> 'kind')::public.term_kind;
  v_id text := v_kind::text || ':x_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
begin
  if v_kind = 'region' then
    raise exception 'Regions follow NIS codes; ask the federation to add one' using errcode = '22023';
  end if;
  insert into public.terms (id, kind, label_nl, label_fr, parent_id, synonyms, status, proposed_by)
  values (
    v_id, v_kind, btrim(p ->> 'label_nl'), coalesce(nullif(btrim(p ->> 'label_fr'), ''), btrim(p ->> 'label_nl')),
    nullif(p ->> 'parent_id', ''),
    coalesce(array(select btrim(s) from jsonb_array_elements_text(p -> 'synonyms') s where btrim(s) <> ''), '{}'),
    'proposed', auth.uid()
  );
  return v_id;
end;
$$;

-- ---------- federation admin ----------

-- approve: the term becomes a shared facet (labels/parent may be corrected).
-- merge:   calls move to p_target; the proposal's labels become synonyms there.
-- reject:  the term is removed from calls and retired.
create function public.review_term(p_id text, p_action text, p_target text default null, p jsonb default '{}')
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
      select array_agg(distinct s) from unnest(synonyms || t.synonyms || array[t.label_nl, t.label_fr]) s
    ) where id = p_target;
    update public.terms set status = 'retired', merged_into = p_target where id = p_id;
  elsif p_action = 'reject' then
    delete from public.call_terms where term_id = p_id;
    update public.terms set status = 'retired' where id = p_id;
  else
    raise exception 'Unknown action %', p_action using errcode = '22023';
  end if;
end;
$$;

create function public.admin_members() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_federation_admin() then
    raise exception 'Federation admins only' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', m.id, 'email', u.email, 'role', m.role, 'funder_id', m.funder_id,
      'funder_name', f.name) order by f.name nulls first, u.email)
    from public.memberships m
    join auth.users u on u.id = m.user_id
    left join public.funders f on f.id = m.funder_id), '[]'::jsonb);
end;
$$;

-- People sign in once (magic link) before an admin can give them a role; signing in
-- without a membership grants nothing beyond the public board.
create function public.grant_membership(p_email text, p_funder uuid, p_role public.member_role)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
begin
  if not public.is_federation_admin() then
    raise exception 'Federation admins only' using errcode = '42501';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'No account for %. Ask them to sign in once first.', p_email using errcode = 'P0002';
  end if;
  insert into public.memberships (user_id, funder_id, role)
  values (v_user, case when p_role = 'federation_admin' then null else p_funder end, p_role)
  on conflict (user_id, funder_id) do update set role = excluded.role;
end;
$$;

create function public.revoke_membership(p_id uuid) returns void
language plpgsql set search_path = '' as $$
begin
  delete from public.memberships where id = p_id;
  if not found then
    raise exception 'Membership not found or you may not change it' using errcode = '42501';
  end if;
end;
$$;

create function public.save_funder(p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.funders := jsonb_populate_record(null::public.funders, p);
  v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  if v_id is null then
    insert into public.funders (name, kind, website, intake_url, is_member)
    values (r.name, coalesce(r.kind, 'foundation'), r.website, r.intake_url, coalesce(r.is_member, true))
    returning id into v_id;
  else
    update public.funders set name = r.name, kind = coalesce(r.kind, 'foundation'),
      website = r.website, intake_url = r.intake_url, is_member = coalesce(r.is_member, true)
    where id = v_id;
    if not found then
      raise exception 'Funder not found or you may not change it' using errcode = '42501';
    end if;
  end if;
  return v_id;
end;
$$;

create function public.save_custom_field(p jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  r public.custom_fields := jsonb_populate_record(null::public.custom_fields, p);
begin
  insert into public.custom_fields (key, label_nl, label_fr, help_nl, help_fr, type, options,
    required, filterable, show_on_card, sort, active)
  values (r.key, r.label_nl, r.label_fr, coalesce(r.help_nl, ''), coalesce(r.help_fr, ''), r.type,
    coalesce(r.options, '[]'), coalesce(r.required, false), coalesce(r.filterable, false),
    coalesce(r.show_on_card, false), coalesce(r.sort, 0), coalesce(r.active, true))
  on conflict (key) do update set label_nl = excluded.label_nl, label_fr = excluded.label_fr,
    help_nl = excluded.help_nl, help_fr = excluded.help_fr, options = excluded.options,
    required = excluded.required, filterable = excluded.filterable,
    show_on_card = excluded.show_on_card, sort = excluded.sort, active = excluded.active;
  -- The type is fixed once created: changing it would invalidate stored values.
end;
$$;

-- Deletes a field no call uses; archives one that holds data, so nothing is lost.
-- Returns 'deleted' or 'archived'.
create function public.remove_custom_field(p_key text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_federation_admin() then
    raise exception 'Federation admins only' using errcode = '42501';
  end if;
  if exists (select 1 from public.calls c where c.custom ? p_key) then
    update public.custom_fields set active = false, required = false where key = p_key;
    return 'archived';
  end if;
  delete from public.custom_fields where key = p_key;
  return 'deleted';
end;
$$;

-- ---------- function privileges ----------

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.is_member(), public.is_federation_admin(), public.funder_role(uuid),
  public.can_edit_call(uuid), public.can_set_status(uuid), public.can_propose_terms(),
  public.call_funder(uuid), public.status_transition_ok(public.call_status, public.call_status),
  public.user_email(uuid), public.call_contact(uuid),
  public.board(), public.call_detail(uuid), public.taxonomy(), public.me()
  to anon, authenticated;
grant execute on function
  public.set_call_status(uuid, public.call_status, text), public.save_call(jsonb),
  public.propose_term(jsonb), public.review_term(text, text, text, jsonb),
  public.admin_members(), public.grant_membership(text, uuid, public.member_role),
  public.revoke_membership(uuid), public.save_funder(jsonb),
  public.save_custom_field(jsonb), public.remove_custom_field(text)
  to authenticated;
`;export{e as default};