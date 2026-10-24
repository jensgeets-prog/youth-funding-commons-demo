var e=`-- SDG targets on calls: optional, chosen by the funder from the 169 UN targets. The
-- goals a call serves still follow from its themes; targets say precisely what it
-- contributes to, and matching compares them.
--
-- board() and call_detail() are wrapped instead of rewritten: the previous versions
-- are renamed to *_base and the new ones add the targets, so this migration does not
-- repeat (and risk drifting from) their long bodies.

-- The SDG reference is readable by members (it was only reachable through an RPC).
create policy sdg_goals_read on public.sdg_goals for select using (public.is_member());
create policy sdg_targets_read on public.sdg_targets for select using (public.is_member());
grant select on public.sdg_goals, public.sdg_targets to authenticated;

create table public.call_sdg_targets (
  call_id uuid not null references public.calls (id) on delete cascade,
  target text not null references public.sdg_targets (code),
  primary key (call_id, target)
);
alter table public.call_sdg_targets enable row level security;
create policy call_sdg_targets_read on public.call_sdg_targets for select
  using (public.can_see_call(call_id));
create policy call_sdg_targets_write on public.call_sdg_targets for all
  using (public.can_edit_call(public.call_funder(call_id)))
  with check (public.can_edit_call(public.call_funder(call_id)));
grant select, insert, delete on public.call_sdg_targets to authenticated;

-- Replaces the call's targets; unknown codes are ignored. Called by the editor right
-- after save_call.
create function public.save_call_sdg_targets(p_call uuid, p_codes text[]) returns void
language plpgsql set search_path = '' as $$
begin
  if not public.can_edit_call(public.call_funder(p_call)) then
    raise exception 'Call not found or you may not change it' using errcode = '42501';
  end if;
  delete from public.call_sdg_targets where call_id = p_call;
  insert into public.call_sdg_targets (call_id, target)
  select p_call, s.code from public.sdg_targets s where s.code = any (p_codes);
end;
$$;
revoke execute on function public.save_call_sdg_targets(uuid, text[]) from public, anon;
grant execute on function public.save_call_sdg_targets(uuid, text[]) to authenticated;

create function public.call_targets(p_call uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(x.target order by s.sort), '[]'::jsonb)
  from public.call_sdg_targets x join public.sdg_targets s on s.code = x.target
  where x.call_id = p_call;
$$;

alter function public.call_detail(uuid) rename to call_detail_base;
create function public.call_detail(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select d || jsonb_build_object('sdg_targets', public.call_targets(p_id))
  from (select public.call_detail_base(p_id) d) x
  where d is not null;
$$;

alter function public.board() rename to board_base;
create function public.board() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(e || jsonb_build_object(
           'sdg_targets', public.call_targets((e ->> 'id')::uuid))), '[]'::jsonb)
  from jsonb_array_elements(public.board_base()) e;
$$;

revoke execute on function public.call_detail(uuid), public.board(), public.call_targets(uuid)
  from public, anon;
grant execute on function public.call_detail(uuid), public.board(), public.call_targets(uuid)
  to authenticated;

-- A call made from a template keeps the template's targets.
create function public.calls_copy_targets() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.call_sdg_targets (call_id, target)
  select new.id, target from public.call_sdg_targets where call_id = new.template_of;
  return null;
end;
$$;
create trigger calls_copy_targets after insert on public.calls
  for each row when (new.template_of is not null) execute function public.calls_copy_targets();
`;export{e as default};