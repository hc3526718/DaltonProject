-- Run after roadmap_extensions.sql + follow RLS in rls_policies.sql.

create or replace function public.accept_follow_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r uuid;
  t uuid;
  st text;
begin
  select requester_id, target_id, status into r, t, st
  from public.follow_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'request not found'; end if;
  if st <> 'pending' then raise exception 'not pending'; end if;
  if t <> auth.uid() then raise exception 'forbidden'; end if;

  update public.follow_requests set status = 'accepted' where id = p_request_id;

  insert into public.follows (follower_id, followee_id)
  values (r, t)
  on conflict do nothing;
end;
$$;

create or replace function public.reject_follow_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t uuid;
  st text;
begin
  select target_id, status into t, st
  from public.follow_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'request not found'; end if;
  if st <> 'pending' then raise exception 'not pending'; end if;
  if t <> auth.uid() then raise exception 'forbidden'; end if;

  update public.follow_requests set status = 'rejected' where id = p_request_id;
end;
$$;

create or replace function public.cancel_follow_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rq uuid;
  st text;
begin
  select requester_id, status into rq, st
  from public.follow_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'request not found'; end if;
  if st <> 'pending' then raise exception 'not pending'; end if;
  if rq <> auth.uid() then raise exception 'forbidden'; end if;

  update public.follow_requests set status = 'cancelled' where id = p_request_id;
end;
$$;

revoke all on function public.accept_follow_request(uuid) from public;
revoke all on function public.reject_follow_request(uuid) from public;
revoke all on function public.cancel_follow_request(uuid) from public;
grant execute on function public.accept_follow_request(uuid) to authenticated;
grant execute on function public.reject_follow_request(uuid) to authenticated;
grant execute on function public.cancel_follow_request(uuid) to authenticated;
