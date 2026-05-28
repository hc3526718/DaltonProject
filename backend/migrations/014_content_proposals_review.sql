-- Master review workflow, sponsor monthly cap, discussion unlock on approval.

alter table public.content_proposals
  add column if not exists opened_at timestamptz,
  add column if not exists opened_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists discussion_unlocked boolean not null default false;

create or replace function public.is_master_account()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.master_control = 'yes'
  );
$$;

revoke all on function public.is_master_account() from public;
grant execute on function public.is_master_account() to authenticated;

drop policy if exists "content_proposals_select_master" on public.content_proposals;
create policy "content_proposals_select_master"
  on public.content_proposals for select
  using (auth.uid() = author_id or public.is_master_account());

create or replace function public.sponsor_proposals_this_month_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.content_proposals cp
  where cp.author_id = auth.uid()
    and cp.kind = 'sponsor'
    and cp.created_at >= date_trunc('month', now() at time zone 'utc');
$$;

grant execute on function public.sponsor_proposals_this_month_count() to authenticated;

create or replace function public.can_submit_sponsor_proposal()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sponsor_proposals_this_month_count() < 3;
$$;

grant execute on function public.can_submit_sponsor_proposal() to authenticated;

create or replace function public.enforce_sponsor_proposal_monthly_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if new.kind <> 'sponsor' then
    return new;
  end if;
  select count(*)::integer
  into n
  from public.content_proposals cp
  where cp.author_id = new.author_id
    and cp.kind = 'sponsor'
    and cp.created_at >= date_trunc('month', now() at time zone 'utc');
  if n >= 3 then
    raise exception 'sponsor_monthly_limit'
      using errcode = 'P0001',
        message = 'Maximum 3 sponsor proposals per calendar month.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sponsor_proposal_monthly_limit on public.content_proposals;
create trigger trg_sponsor_proposal_monthly_limit
  before insert on public.content_proposals
  for each row
  execute function public.enforce_sponsor_proposal_monthly_limit();

create or replace function public.master_open_content_proposal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_master_account() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.content_proposals
  set
    opened_at = coalesce(opened_at, now()),
    opened_by = coalesce(opened_by, auth.uid()),
    updated_at = now()
  where id = p_proposal_id;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

grant execute on function public.master_open_content_proposal(uuid) to authenticated;

create or replace function public.master_review_content_proposal(
  p_proposal_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.content_proposals%rowtype;
begin
  if not public.is_master_account() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid_decision';
  end if;

  select * into row from public.content_proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if row.status <> 'pending' then
    raise exception 'already_reviewed';
  end if;
  if row.opened_at is null then
    raise exception 'not_opened';
  end if;

  update public.content_proposals
  set
    status = p_decision,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    discussion_unlocked = (p_decision = 'approved' and row.kind = 'sponsor'),
    updated_at = now()
  where id = p_proposal_id;
end;
$$;

grant execute on function public.master_review_content_proposal(uuid, text) to authenticated;
