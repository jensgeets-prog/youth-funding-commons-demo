var e=`-- B1 drafts and B2 types of support (docs/backlog.md). Countries (B4) follow in the
-- next migration, generated from CLDR names.

-- ---------- B1: drafts are private to their funder ----------

-- Who may see a call: drafts only their own funder's members and the federation admin.
create function public.can_see_call(p_call uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.is_member()
       and (c.status <> 'draft' or public.funder_role(c.funder_id) is not null
            or public.is_federation_admin())
    from public.calls c where c.id = p_call), false);
$$;

drop policy calls_read on public.calls;
create policy calls_read on public.calls for select
  using (public.is_member()
         and (status <> 'draft' or public.funder_role(funder_id) is not null
              or public.is_federation_admin()));

-- Definer helpers that bypass RLS must apply the same rule themselves.
create or replace function public.call_funder(p_call uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select c.funder_id from public.calls c where c.id = p_call and public.can_see_call(p_call);
$$;

create or replace function public.call_contact(p_call uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', c.contact_name, 'email', c.contact_email)
  from public.calls c where c.id = p_call and public.can_see_call(p_call);
$$;

create or replace function public.call_history(p_call uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'from', h.from_status, 'to', h.to_status, 'at', h.changed_at,
      'reason', h.reason, 'by', public.user_email(h.changed_by))
    order by h.changed_at desc, h.id desc), '[]'::jsonb)
  from public.call_status_history h
  where h.call_id = p_call and public.can_see_call(p_call);
$$;

create or replace function public.call_learning(p_call uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'metrics', coalesce((select jsonb_agg(jsonb_build_object(
        'term_id', m.term_id, 'target', m.target, 'actual', m.actual, 'unit', m.unit)
        order by m.term_id) from public.call_metrics m where m.call_id = p_call), '[]'::jsonb),
    'results', (select to_jsonb(r) - 'call_id' - 'updated_by'
                from public.call_results r where r.call_id = p_call)
  )
  where public.can_see_call(p_call);
$$;

-- Mirrors TRANSITIONS in src/lib/call-status.ts (a db test checks they agree).
create or replace function public.status_transition_ok(p_from public.call_status, p_to public.call_status)
returns boolean language sql immutable set search_path = '' as $$
  select case p_from
    when 'draft'        then p_to in ('planned', 'opening_soon', 'open', 'cancelled')
    when 'planned'      then p_to in ('opening_soon', 'open', 'paused', 'cancelled')
    when 'opening_soon' then p_to in ('planned', 'open', 'paused', 'cancelled')
    when 'open'         then p_to in ('under_review', 'paused', 'cancelled')
    when 'under_review' then p_to in ('decided', 'cancelled')
    when 'paused'       then p_to in ('planned', 'opening_soon', 'open', 'cancelled')
    else false
  end;
$$;

-- Required custom fields are enforced only once a call leaves draft: a draft may be
-- saved with just a title. Types are always checked.
create function public.check_custom(p_custom jsonb, p_require boolean) returns void
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
      if f.required and p_require then
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
revoke execute on function public.check_custom(jsonb, boolean) from public, anon, authenticated;

create or replace function public.calls_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ignored text[] := array['status', 'updated_at', 'updated_by'];
begin
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'planned', 'opening_soon', 'open') then
      raise exception 'A new call cannot start as %', new.status using errcode = '22023';
    end if;
  else
    if new.status is distinct from old.status
       and not public.status_transition_ok(old.status, new.status) then
      raise exception 'Status cannot go from % to %', old.status, new.status using errcode = '22023';
    end if;
    if new.funder_id is distinct from old.funder_id and auth.uid() is not null
       and not public.is_federation_admin() then
      raise exception 'Only the federation can move a call to another funder' using errcode = '42501';
    end if;
    if auth.uid() is not null and not public.can_edit_call(old.funder_id)
       and (to_jsonb(new) - v_ignored) is distinct from (to_jsonb(old) - v_ignored) then
      raise exception 'Officers can only change the status of a call' using errcode = '42501';
    end if;
  end if;
  -- Check custom values when they change, and in full when a draft is published.
  if tg_op = 'INSERT' or new.custom is distinct from old.custom
     or (old.status = 'draft' and new.status <> 'draft') then
    perform public.check_custom(new.custom, new.status <> 'draft');
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

-- New calls start as drafts unless the editor says otherwise; copies always do.
create or replace function public.duplicate_call(p_id uuid) returns uuid
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
    language, 'draft', beneficiary, deadline_type, amount_min, amount_max, total_budget,
    grants_count, tranches, cofunding_allowed, age_min, age_max, eligibility, criteria, custom,
    apply_url, contact_name, contact_email, contact_language
  from public.calls where id = p_id
  returning id into v_new;
  insert into public.call_terms (call_id, term_id)
  select v_new, term_id from public.call_terms where call_id = p_id;
  insert into public.call_metrics (call_id, term_id, target, unit)
  select v_new, term_id, target, unit from public.call_metrics where call_id = p_id;
  return v_new;
end;
$$;

-- ---------- B2: types of support ----------
-- Based on Candid's Philanthropy Classification System support strategies and the
-- financial / non-financial support categories of Impact Europe (venture philanthropy).
-- Five groups as parents; existing terms keep their ids and move under a group.
insert into public.terms (id, kind, label_nl, label_fr, parent_id, synonyms, sort) values
  ('res:g_core', 'resource', 'Kernfinanciering', 'Financement de base', null, '{kernfinanciering,structureel}', 1),
  ('res:g_programme', 'resource', 'Programmafinanciering', 'Financement de programme', null, '{programma,programme}', 2),
  ('res:g_youth', 'resource', 'Steun aan jongeren zelf', 'Soutien direct aux jeunes', null, '{}', 3),
  ('res:g_repayable', 'resource', 'Terugbetaalbaar of gekoppeld', 'Remboursable ou conditionné', null, '{}', 4),
  ('res:g_nonfin', 'resource', 'Niet-financiële steun', 'Soutien non financier', null, '{niet-financieel,non financier,non-financial}', 5);

update public.terms set parent_id = 'res:g_core', sort = 1 where id = 'res:operating';
update public.terms set parent_id = 'res:g_core', sort = 3, label_nl = 'Infrastructuur en materiaal',
  label_fr = 'Infrastructure et matériel', synonyms = synonyms || '{infrastructuur,gebouw,toestellen,équipement}'
  where id = 'res:investment';
update public.terms set parent_id = 'res:g_programme', sort = 1 where id = 'res:project_grant';
update public.terms set parent_id = 'res:g_programme', sort = 2 where id = 'res:multi_year';
update public.terms set parent_id = 'res:g_youth', sort = 1 where id = 'res:individual';
update public.terms set parent_id = 'res:g_repayable', sort = 1 where id = 'res:loan';
update public.terms set parent_id = 'res:g_nonfin', sort = 2 where id = 'res:coaching';
update public.terms set parent_id = 'res:g_nonfin', sort = 3 where id = 'res:network';

insert into public.terms (id, kind, label_nl, label_fr, parent_id, synonyms, sort) values
  ('res:capacity', 'resource', 'Capaciteitsopbouw', 'Renforcement des capacités', 'res:g_core',
   '{capaciteit,organisatieversterking,capacity building,renforcement}', 2),
  ('res:experimental', 'resource', 'Experimenteerruimte', 'Financement expérimental', 'res:g_programme',
   '{experiment,opstart,opstartkosten,seed,démarrage,expérimentation}', 3),
  ('res:innovation', 'resource', 'Innovatie en pilot', 'Innovation et pilote', 'res:g_programme',
   '{innovatie,pilot,proefproject,innovation,pilote}', 4),
  ('res:scaling', 'resource', 'Opschaling', 'Changement d''échelle', 'res:g_programme',
   '{opschalen,uitbreiden,scaling,essaimage}', 5),
  ('res:research', 'resource', 'Onderzoek en evaluatie', 'Recherche et évaluation', 'res:g_programme',
   '{onderzoek,evaluatie,impactmeting,recherche,évaluation,research}', 6),
  ('res:advocacy', 'resource', 'Pleitwerk en beleid', 'Plaidoyer et politique', 'res:g_programme',
   '{pleitwerk,beleidsbeïnvloeding,plaidoyer,advocacy}', 7),
  ('res:emergency', 'resource', 'Noodsteun', 'Aide d''urgence', 'res:g_programme',
   '{nood,noodhulp,crisis,urgence}', 8),
  ('res:prize', 'resource', 'Prijs of award', 'Prix', 'res:g_youth', '{prijs,award,prix,laureaat}', 2),
  ('res:matching', 'resource', 'Matching of cofinanciering', 'Cofinancement', 'res:g_repayable',
   '{matching,cofinanciering,cofinancement,challenge}', 2),
  ('res:expertise', 'resource', 'Kennis en expertise', 'Expertise', 'res:g_nonfin',
   '{kennis,expertise,pro bono,advies,conseil}', 1),
  ('res:in_kind', 'resource', 'Middelen in natura', 'Ressources en nature', 'res:g_nonfin',
   '{in natura,ruimte,lokaal,vrijwilligers,en nature,locaux}', 4),
  ('res:visibility', 'resource', 'Zichtbaarheid en communicatie', 'Visibilité', 'res:g_nonfin',
   '{zichtbaarheid,communicatie,media,visibilité}', 5);

-- "Opstartkosten" becomes part of experimental funding; its name lives on as a synonym.
insert into public.call_terms (call_id, term_id)
select call_id, 'res:experimental' from public.call_terms where term_id = 'res:startup_costs'
on conflict do nothing;
delete from public.call_terms where term_id = 'res:startup_costs';
update public.terms set status = 'retired', merged_into = 'res:experimental' where id = 'res:startup_costs';
`;export{e as default};