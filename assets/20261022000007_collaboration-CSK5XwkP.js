var e=`-- B5: comments, @-mentions, co-funding interest and in-app notifications.
--
-- Everything here is reached through definer RPCs that check the caller themselves;
-- the tables have RLS on and no policies or grants, so nothing is readable directly
-- (author ids stay out of reach, as for status history). Visibility follows the call:
-- whoever can see a call (can_see_call) can read and join its thread.
-- Email delivery (instant / daily digest via Resend) needs a server job and is wired
-- when the Supabase project exists; notifications are stored now and shown in-app.

create table public.call_comments (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  parent_id uuid references public.call_comments (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 2000),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index call_comments_call_idx on public.call_comments (call_id, created_at);

create table public.comment_mentions (
  comment_id uuid not null references public.call_comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (comment_id, user_id)
);

create type public.interest_visibility as enum ('owner', 'members');
-- One interest per interested funder and call; withdrawing keeps the row for the record.
create table public.cofund_interests (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  funder_id uuid not null references public.funders (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  amount_min bigint check (amount_min >= 0),
  amount_max bigint check (amount_max >= 0),
  note text not null default '' check (length(note) <= 1000),
  visibility public.interest_visibility not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  unique (call_id, funder_id),
  check (amount_max is null or amount_min is null or amount_max >= amount_min)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('comment', 'reply', 'mention', 'interest')),
  call_id uuid not null references public.calls (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.call_comments enable row level security;
alter table public.comment_mentions enable row level security;
alter table public.cofund_interests enable row level security;
alter table public.notifications enable row level security;

-- ---------- helpers ----------

-- Display name of a member: email plus the member organisation they belong to.
create function public.member_label(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.is_member() and p_user is not null then jsonb_build_object(
    'email', public.user_email(p_user),
    'funder', (select f.name from public.memberships m join public.funders f on f.id = m.funder_id
               where m.user_id = p_user order by f.name limit 1))
  end;
$$;

-- Notify each user once per event; never the person who acted.
create function public.notify(p_users uuid[], p_kind text, p_call uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, call_id, actor_id)
  select distinct u, p_kind, p_call, auth.uid()
  from unnest(p_users) u
  where u is not null and u is distinct from auth.uid()
    and exists (select 1 from public.memberships m where m.user_id = u);
$$;

create function public.funder_people(p_funder uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(m.user_id), '{}') from public.memberships m where m.funder_id = p_funder;
$$;

-- ---------- comments ----------

create function public.call_comments(p_call uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'parent_id', c.parent_id,
      'body', case when c.hidden then null else c.body end,
      'hidden', c.hidden, 'created_at', c.created_at, 'edited_at', c.edited_at,
      'author', public.member_label(c.author_id),
      'mine', c.author_id = auth.uid(),
      'mentions', coalesce((select jsonb_agg(public.user_email(x.user_id))
                            from public.comment_mentions x where x.comment_id = c.id), '[]'::jsonb))
    order by c.created_at), '[]'::jsonb)
  from public.call_comments c
  where c.call_id = p_call and public.can_see_call(p_call);
$$;

create function public.add_comment(p_call uuid, p_body text, p_parent uuid default null,
  p_mentions uuid[] default '{}') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_parent_author uuid;
begin
  if not public.can_see_call(p_call) then
    raise exception 'Call not found' using errcode = '42501';
  end if;
  if p_parent is not null then
    -- Replies are one level deep and stay on the same call.
    select author_id into v_parent_author from public.call_comments
    where id = p_parent and call_id = p_call and parent_id is null;
    if not found then
      raise exception 'You can only reply to a top-level comment on this call' using errcode = '22023';
    end if;
  end if;
  if cardinality(p_mentions) > 20 then
    raise exception 'Mention at most 20 people' using errcode = '22023';
  end if;
  insert into public.call_comments (call_id, parent_id, author_id, body)
  values (p_call, p_parent, auth.uid(), btrim(p_body))
  returning id into v_id;
  insert into public.comment_mentions (comment_id, user_id)
  select v_id, u from unnest(p_mentions) u
  where exists (select 1 from public.memberships m where m.user_id = u)
  on conflict do nothing;

  perform public.notify(public.funder_people(public.call_funder(p_call)), 'comment', p_call);
  if v_parent_author is not null then
    perform public.notify(array[v_parent_author], 'reply', p_call);
  end if;
  perform public.notify(p_mentions, 'mention', p_call);
  return v_id;
end;
$$;

create function public.edit_comment(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.call_comments set body = btrim(p_body), edited_at = now()
  where id = p_id and author_id = auth.uid() and not hidden;
  if not found then
    raise exception 'Comment not found or not yours' using errcode = '42501';
  end if;
end;
$$;

create function public.delete_comment(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.call_comments where id = p_id and author_id = auth.uid();
  if not found then
    raise exception 'Comment not found or not yours' using errcode = '42501';
  end if;
end;
$$;

-- The federation hides abusive comments; the text stays for the record, out of view.
create function public.hide_comment(p_id uuid, p_hidden boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_federation_admin() then
    raise exception 'Federation admins only' using errcode = '42501';
  end if;
  update public.call_comments set hidden = p_hidden where id = p_id;
end;
$$;

-- People a member can @-mention: every member, with their organisation.
create function public.mentionable() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id) || public.member_label(m.user_id)
    order by public.user_email(m.user_id)), '[]'::jsonb)
  from (select distinct user_id from public.memberships) m
  where public.is_member();
$$;

-- ---------- co-funding interest ----------

-- Visible to the interested funder, the owning funder and the federation; to every
-- member as well when the interested funder chose 'members'.
create function public.call_interests(p_call uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'funder_id', i.funder_id, 'funder_name', f.name,
      'amount_min', i.amount_min, 'amount_max', i.amount_max, 'note', i.note,
      'visibility', i.visibility, 'updated_at', i.updated_at,
      'by', public.member_label(i.user_id),
      'mine', public.funder_role(i.funder_id) is not null)
    order by i.updated_at desc), '[]'::jsonb)
  from public.cofund_interests i
  join public.funders f on f.id = i.funder_id
  where i.call_id = p_call and i.withdrawn_at is null and public.can_see_call(p_call)
    and (i.visibility = 'members'
         or public.funder_role(i.funder_id) is not null
         or public.funder_role(public.call_funder(p_call)) is not null
         or public.is_federation_admin());
$$;

-- Records (or updates) the caller's funder's interest. A member cannot be interested
-- in co-funding its own call.
create function public.save_interest(p_call uuid, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_funder uuid := nullif(p ->> 'funder_id', '')::uuid;
  v_owner uuid := public.call_funder(p_call);
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
  insert into public.cofund_interests (call_id, funder_id, user_id, amount_min, amount_max, note, visibility)
  values (p_call, v_funder, auth.uid(), nullif(p ->> 'amount_min', '')::bigint,
          nullif(p ->> 'amount_max', '')::bigint, coalesce(left(btrim(p ->> 'note'), 1000), ''),
          coalesce(nullif(p ->> 'visibility', ''), 'owner')::public.interest_visibility)
  on conflict (call_id, funder_id) do update set
    user_id = excluded.user_id, amount_min = excluded.amount_min, amount_max = excluded.amount_max,
    note = excluded.note, visibility = excluded.visibility, updated_at = now(), withdrawn_at = null;
  perform public.notify(public.funder_people(v_owner), 'interest', p_call);
end;
$$;

create function public.withdraw_interest(p_call uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.cofund_interests set withdrawn_at = now()
  where call_id = p_call and withdrawn_at is null and public.funder_role(funder_id) is not null;
  if not found then
    raise exception 'No interest to withdraw' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------- notifications ----------

create function public.my_notifications() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id, 'kind', n.kind, 'call_id', n.call_id, 'title', c.title,
      'actor', public.member_label(n.actor_id), 'created_at', n.created_at, 'read', n.read_at is not null)
    order by n.created_at desc), '[]'::jsonb)
  from (select * from public.notifications where user_id = auth.uid()
        order by created_at desc limit 50) n
  join public.calls c on c.id = n.call_id
  where public.can_see_call(n.call_id);
$$;

create function public.mark_notifications_read() returns void
language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

-- ---------- board: activity counts per call ----------
create function public.comment_count(p_call uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.call_comments
  where call_id = p_call and not hidden and public.can_see_call(p_call);
$$;

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
    'comments', public.comment_count(c.id),
    'interests', jsonb_array_length(public.call_interests(c.id)),
    'terms', coalesce(
      (select jsonb_agg(t.term_id order by t.term_id) from public.call_terms t where t.call_id = c.id),
      '[]'::jsonb)
  ) order by c.deadline_at nulls last, c.title), '[]'::jsonb)
  from public.calls c
  join public.funders f on f.id = c.funder_id;
$$;

revoke execute on function public.member_label(uuid), public.notify(uuid[], text, uuid),
  public.funder_people(uuid) from public, anon, authenticated;
revoke execute on function public.call_comments(uuid), public.add_comment(uuid, text, uuid, uuid[]),
  public.edit_comment(uuid, text), public.delete_comment(uuid), public.hide_comment(uuid, boolean),
  public.mentionable(), public.call_interests(uuid), public.save_interest(uuid, jsonb),
  public.withdraw_interest(uuid), public.my_notifications(), public.mark_notifications_read(),
  public.comment_count(uuid)
  from public, anon;
grant execute on function public.call_comments(uuid), public.add_comment(uuid, text, uuid, uuid[]),
  public.edit_comment(uuid, text), public.delete_comment(uuid), public.hide_comment(uuid, boolean),
  public.mentionable(), public.call_interests(uuid), public.save_interest(uuid, jsonb),
  public.withdraw_interest(uuid), public.my_notifications(), public.mark_notifications_read(),
  public.comment_count(uuid)
  to authenticated;
`;export{e as default};