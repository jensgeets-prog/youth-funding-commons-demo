var e=`-- Partners: a member applies to support another member's call with money, knowledge,
-- operations, network or in-kind help; the owning funder accepts or declines. Accepted
-- partners show on the call to every member, which turns the call into a shared
-- project. Builds on cofund_interests (B5): an interest is an application, pending until
-- the owner decides. Same access model: definer RPCs with explicit checks, no grants on
-- the table.

create type public.partner_status as enum ('pending', 'accepted', 'declined');

alter table public.cofund_interests
  add column support text[] not null default '{money}'
    check (cardinality(support) between 1 and 5
           and support <@ array['money', 'knowledge', 'operations', 'network', 'inkind']),
  add column status public.partner_status not null default 'pending',
  add column reply text not null default '' check (length(reply) <= 1000),
  add column decided_by uuid references auth.users (id) on delete set null,
  add column decided_at timestamptz;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('comment', 'reply', 'mention', 'interest', 'partner_accepted', 'partner_declined'));

-- Accepted partners are visible to every member who can see the call; amount, note and
-- reply of an application marked owner-only stay with the two funders and the federation.
create or replace function public.call_interests(p_call uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'funder_id', i.funder_id, 'funder_name', f.name,
      'amount_min', case when v.full then i.amount_min end,
      'amount_max', case when v.full then i.amount_max end,
      'note', case when v.full then i.note else '' end,
      'visibility', i.visibility, 'updated_at', i.updated_at,
      'support', to_jsonb(i.support), 'status', i.status,
      'reply', case when v.full then i.reply else '' end,
      'by', public.member_label(i.user_id),
      'mine', public.funder_role(i.funder_id) is not null,
      'can_decide', public.can_edit_call(public.call_funder(p_call)))
    order by i.status = 'accepted' desc, i.updated_at desc), '[]'::jsonb)
  from public.cofund_interests i
  join public.funders f on f.id = i.funder_id
  cross join lateral (select i.visibility = 'members'
      or public.funder_role(i.funder_id) is not null
      or public.funder_role(public.call_funder(p_call)) is not null
      or coalesce(public.is_federation_admin(), false) as full) v
  where i.call_id = p_call and i.withdrawn_at is null and public.can_see_call(p_call)
    and (v.full or i.status = 'accepted');
$$;

-- Applying again after a decline or a withdrawal reopens the application, and so does
-- changing the terms of an accepted one: the owner approves what members see. A
-- reopened application loses the old decision. The owner is notified only when there
-- is something to decide.
create function public.interest_reopens(o public.cofund_interests, n public.cofund_interests)
returns boolean language sql immutable set search_path = '' as $$
  select o.withdrawn_at is not null or o.status = 'declined'
      or (o.status = 'accepted' and (o.amount_min, o.amount_max, o.note, o.support)
                                    is distinct from (n.amount_min, n.amount_max, n.note, n.support));
$$;
revoke execute on function public.interest_reopens(public.cofund_interests, public.cofund_interests)
  from public, anon, authenticated;

create or replace function public.save_interest(p_call uuid, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_funder uuid := nullif(p ->> 'funder_id', '')::uuid;
  v_owner uuid := public.call_funder(p_call);
  v_support text[] := coalesce(
    (select array_agg(distinct x) from jsonb_array_elements_text(
       case when jsonb_typeof(p -> 'support') = 'array' then p -> 'support' else '[]' end) x),
    '{money}');
  v_status public.partner_status;
begin
  if v_owner is null then
    raise exception 'Call not found' using errcode = '42501';
  end if;
  if v_funder is null then
    select m.funder_id into v_funder from public.memberships m
    where m.user_id = auth.uid() and m.funder_id is not null order by m.created_at limit 1;
  end if;
  if v_funder is null or public.funder_role(v_funder) is null then
    raise exception 'Only a member fund can express interest' using errcode = '42501';
  end if;
  if v_funder = v_owner then
    raise exception 'This is your own call' using errcode = '22023';
  end if;
  insert into public.cofund_interests as ci (call_id, funder_id, user_id, amount_min, amount_max,
    note, visibility, support)
  values (p_call, v_funder, auth.uid(), nullif(p ->> 'amount_min', '')::bigint,
          nullif(p ->> 'amount_max', '')::bigint, coalesce(left(btrim(p ->> 'note'), 1000), ''),
          coalesce(nullif(p ->> 'visibility', ''), 'owner')::public.interest_visibility, v_support)
  on conflict (call_id, funder_id) do update set
    user_id = excluded.user_id, amount_min = excluded.amount_min, amount_max = excluded.amount_max,
    note = excluded.note, visibility = excluded.visibility, support = excluded.support,
    status = case when public.interest_reopens(ci, excluded)
               then 'pending'::public.partner_status else ci.status end,
    reply = case when public.interest_reopens(ci, excluded) then '' else ci.reply end,
    decided_by = case when public.interest_reopens(ci, excluded) then null else ci.decided_by end,
    decided_at = case when public.interest_reopens(ci, excluded) then null else ci.decided_at end,
    updated_at = now(), withdrawn_at = null
  returning ci.status into v_status;
  if v_status = 'pending' then
    perform public.notify(public.funder_people(v_owner), 'interest', p_call);
  end if;
end;
$$;

-- The owning funder's directors and managers (or the federation) accept or decline.
create function public.decide_partner(p_id uuid, p_accept boolean, p_reply text default '')
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_call uuid;
  v_funder uuid;
begin
  select call_id, funder_id into v_call, v_funder
  from public.cofund_interests where id = p_id and withdrawn_at is null;
  if not found or not public.can_edit_call(public.call_funder(v_call)) then
    raise exception 'Application not found or not your call' using errcode = '42501';
  end if;
  update public.cofund_interests set
    status = case when p_accept then 'accepted' else 'declined' end::public.partner_status,
    reply = coalesce(left(btrim(p_reply), 1000), ''), decided_by = auth.uid(), decided_at = now()
  where id = p_id;
  perform public.notify(public.funder_people(v_funder),
    case when p_accept then 'partner_accepted' else 'partner_declined' end, v_call);
end;
$$;

revoke execute on function public.decide_partner(uuid, boolean, text) from public, anon;
grant execute on function public.decide_partner(uuid, boolean, text) to authenticated;
`;export{e as default};