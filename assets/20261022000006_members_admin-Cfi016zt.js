var e=`-- Member organisations as first-class profiles, their representatives, access requests,
-- and the feeds behind the federation's admin dashboard.

-- ---------- organisational details ----------
alter table public.funders
  add column legal_name text check (length(legal_name) <= 200),
  add column enterprise_number text check (enterprise_number ~ '^[0-9]{4}\\.?[0-9]{3}\\.?[0-9]{3}$'),
  add column description text not null default '' check (length(description) <= 2000),
  add column street text check (length(street) <= 200),
  add column postal_code text check (length(postal_code) <= 20),
  add column city text check (length(city) <= 100),
  add column country text not null default 'BE' check (country ~ '^[A-Z]{2}$'),
  add column general_email text check (general_email ~ '^[^@\\s]+@[^@\\s]+$'),
  add column phone text check (length(phone) <= 40),
  add column logo_url text check (logo_url ~ '^https://' and length(logo_url) <= 2000),
  add column member_since date;

-- Who represents a member in the federation. People need not have an account; when
-- they do, the link is by email. Personal data: members-only, editable by the
-- federation and by the member's own director or manager.
create table public.funder_contacts (
  id uuid primary key default gen_random_uuid(),
  funder_id uuid not null references public.funders (id) on delete cascade,
  name text not null check (length(name) between 2 and 120),
  job_title text check (length(job_title) <= 120),
  email text check (email ~ '^[^@\\s]+@[^@\\s]+$' and length(email) <= 254),
  phone text check (length(phone) <= 40),
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index funder_contacts_one_primary on public.funder_contacts (funder_id) where is_primary;

alter table public.funder_contacts enable row level security;
create policy funder_contacts_read on public.funder_contacts for select using (public.is_member());
create policy funder_contacts_write on public.funder_contacts for all
  using (public.can_edit_call(funder_id)) with check (public.can_edit_call(funder_id));
grant select, insert, update, delete on public.funder_contacts to authenticated;

-- Members keep their own profile current; the federation can edit every profile.
drop policy funders_admin on public.funders;
create policy funders_insert on public.funders for insert with check (public.is_federation_admin());
create policy funders_update on public.funders for update
  using (public.can_edit_call(id)) with check (public.can_edit_call(id));
create policy funders_delete on public.funders for delete using (public.is_federation_admin());

-- ---------- access requests ----------
-- Someone who signs in without a membership can ask for access; the federation decides.
create type public.request_status as enum ('pending', 'approved', 'declined');
create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organisation text not null check (length(organisation) between 2 and 200),
  job_title text check (length(job_title) <= 120),
  message text not null default '' check (length(message) <= 1000),
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index access_requests_one_pending on public.access_requests (user_id) where status = 'pending';
alter table public.access_requests enable row level security;
create policy access_requests_own on public.access_requests for select
  using (user_id = auth.uid() or public.is_federation_admin());
grant select on public.access_requests to authenticated;

create function public.request_access(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if public.is_member() then
    raise exception 'You already have access' using errcode = '22023';
  end if;
  insert into public.access_requests (user_id, organisation, job_title, message)
  values (auth.uid(), btrim(p ->> 'organisation'), nullif(btrim(p ->> 'job_title'), ''),
          coalesce(left(btrim(p ->> 'message'), 1000), ''))
  on conflict (user_id) where status = 'pending' do update
    set organisation = excluded.organisation, job_title = excluded.job_title, message = excluded.message;
end;
$$;

create function public.my_access_request() returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(r) - 'user_id' from public.access_requests r
  where r.user_id = auth.uid() order by r.created_at desc limit 1;
$$;

-- Approve grants the membership in one step; decline just closes the request.
create function public.decide_access(p_id uuid, p_approve boolean, p_funder uuid default null,
  p_role public.member_role default 'funder_manager') returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.access_requests;
begin
  if not public.is_federation_admin() then
    raise exception 'Federation admins only' using errcode = '42501';
  end if;
  select * into r from public.access_requests where id = p_id and status = 'pending';
  if not found then
    raise exception 'No pending request' using errcode = 'P0002';
  end if;
  if p_approve then
    insert into public.memberships (user_id, funder_id, role)
    values (r.user_id, case when p_role = 'federation_admin' then null else p_funder end, p_role)
    on conflict (user_id, funder_id) do update set role = excluded.role;
  end if;
  update public.access_requests
  set status = case when p_approve then 'approved'::public.request_status else 'declined' end,
      decided_at = now()
  where id = p_id;
end;
$$;

create function public.admin_requests() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_federation_admin() then
    raise exception 'Federation admins only' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'email', u.email, 'organisation', r.organisation, 'job_title', r.job_title,
      'message', r.message, 'created_at', r.created_at) order by r.created_at)
    from public.access_requests r join auth.users u on u.id = r.user_id
    where r.status = 'pending'), '[]'::jsonb);
end;
$$;

-- ---------- feeds ----------
-- Status changes across all published calls in the last p_days: launches, closures…
create function public.recent_activity(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'call_id', h.call_id, 'title', c.title, 'funder_id', c.funder_id, 'funder_name', f.name,
      'from', h.from_status, 'to', h.to_status, 'at', h.changed_at)
    order by h.changed_at desc), '[]'::jsonb)
  from public.call_status_history h
  join public.calls c on c.id = h.call_id
  join public.funders f on f.id = c.funder_id
  where public.is_member()
    and h.changed_at > now() - make_interval(days => least(greatest(p_days, 1), 365))
    and h.to_status <> 'draft'
    and public.can_see_call(c.id);
$$;

-- ---------- profiles ----------
create or replace function public.taxonomy() returns jsonb
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
        'intake_url', f.intake_url, 'is_member', f.is_member, 'city', f.city,
        'country', f.country, 'logo_url', f.logo_url) order by f.name)
      from public.funders f), '[]'::jsonb),
    'custom_fields', coalesce((select jsonb_agg(to_jsonb(cf) - 'created_at' order by cf.sort, cf.key)
      from public.custom_fields cf), '[]'::jsonb)
  );
$$;

create function public.member_profile(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select to_jsonb(f) || jsonb_build_object(
    'contacts', coalesce((select jsonb_agg(to_jsonb(k) - 'funder_id' order by k.is_primary desc, k.name)
                          from public.funder_contacts k where k.funder_id = f.id), '[]'::jsonb),
    'can_edit', public.can_edit_call(f.id))
  from public.funders f where f.id = p_id;
$$;

create function public.save_member(p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.funders := jsonb_populate_record(null::public.funders, p);
  v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  if v_id is null then
    insert into public.funders (name, kind, website, intake_url, is_member, legal_name,
      enterprise_number, description, street, postal_code, city, country, general_email, phone,
      logo_url, member_since)
    values (r.name, coalesce(r.kind, 'foundation'), r.website, r.intake_url, coalesce(r.is_member, true),
      r.legal_name, r.enterprise_number, coalesce(r.description, ''), r.street, r.postal_code, r.city,
      coalesce(r.country, 'BE'), r.general_email, r.phone, r.logo_url, coalesce(r.member_since, current_date))
    returning id into v_id;
  else
    update public.funders set name = r.name, kind = coalesce(r.kind, 'foundation'),
      website = r.website, intake_url = r.intake_url, legal_name = r.legal_name,
      enterprise_number = r.enterprise_number, description = coalesce(r.description, ''),
      street = r.street, postal_code = r.postal_code, city = r.city,
      country = coalesce(r.country, 'BE'), general_email = r.general_email, phone = r.phone,
      logo_url = r.logo_url, member_since = r.member_since
    where id = v_id;
    if not found then
      raise exception 'Member not found or you may not change it' using errcode = '42501';
    end if;
  end if;
  return v_id;
end;
$$;

create function public.save_contact(p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.funder_contacts := jsonb_populate_record(null::public.funder_contacts, p);
  v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  -- One primary representative per member: setting a new one demotes the old.
  if coalesce(r.is_primary, false) then
    update public.funder_contacts set is_primary = false
    where funder_id = r.funder_id and is_primary and id is distinct from v_id;
  end if;
  if v_id is null then
    insert into public.funder_contacts (funder_id, name, job_title, email, phone, is_primary)
    values (r.funder_id, btrim(r.name), r.job_title, r.email, r.phone, coalesce(r.is_primary, false))
    returning id into v_id;
  else
    update public.funder_contacts set name = btrim(r.name), job_title = r.job_title, email = r.email,
      phone = r.phone, is_primary = coalesce(r.is_primary, false)
    where id = v_id;
    if not found then
      raise exception 'Contact not found or you may not change it' using errcode = '42501';
    end if;
  end if;
  return v_id;
end;
$$;

create function public.delete_contact(p_id uuid) returns void
language plpgsql set search_path = '' as $$
begin
  delete from public.funder_contacts where id = p_id;
  if not found then
    raise exception 'Contact not found or you may not change it' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.request_access(jsonb), public.my_access_request(),
  public.decide_access(uuid, boolean, uuid, public.member_role), public.admin_requests(),
  public.recent_activity(integer), public.member_profile(uuid), public.save_member(jsonb),
  public.save_contact(jsonb), public.delete_contact(uuid)
  from public, anon;
grant execute on function public.request_access(jsonb), public.my_access_request(),
  public.decide_access(uuid, boolean, uuid, public.member_role), public.admin_requests(),
  public.recent_activity(integer), public.member_profile(uuid), public.save_member(jsonb),
  public.save_contact(jsonb), public.delete_contact(uuid)
  to authenticated;
`;export{e as default};