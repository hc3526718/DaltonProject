-- Instant master proposal decisions; author edit/delete while pending; DM notification deep links.

-- DM notifications: link to conversation for in-app navigation
create or replace function public.notify_recipient_on_dm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  sender_name text;
  snippet text;
begin
  select p.user_id into recipient
  from public.conversation_participants p
  where p.conversation_id = new.conversation_id
    and p.user_id <> new.sender_id
  limit 1;

  if recipient is null then
    return new;
  end if;

  select coalesce(nullif(trim(pr.display_name), ''), nullif(trim(pr.username), ''), 'Someone')
  into sender_name
  from public.profiles pr
  where pr.id = new.sender_id;

  snippet := left(trim(coalesce(new.body, '')), 120);
  if snippet = '' then
    snippet := 'Sent you a message';
  end if;

  insert into public.in_app_notifications (user_id, title, body, read_at, created_at, link_type, link_id)
  values (
    recipient,
    'New message from ' || sender_name,
    snippet,
    null,
    now(),
    'conversation',
    new.conversation_id
  );

  return new;
end;
$$;

-- One-tap approve/reject (optional document open; no discuss gate)
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
  title_txt text;
  body_txt text;
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

  update public.content_proposals
  set
    status = p_decision,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    discussion_unlocked = (p_decision = 'approved' and row.kind = 'sponsor'),
    show_author_modal = true,
    author_modal_ack_at = null,
    updated_at = now()
  where id = p_proposal_id;

  title_txt := case
    when p_decision = 'approved' then 'Proposal approved'
    else 'Proposal not approved'
  end;
  body_txt := case
    when p_decision = 'approved' then
      'Your submission was approved. Open the app to add details for your post.'
    else
      'Your submission was reviewed. Open the app to see the decision.'
  end;

  insert into public.in_app_notifications (user_id, title, body, read_at, created_at, link_type, link_id)
  values (row.author_id, title_txt, body_txt, null, now(), 'proposal_outcome', p_proposal_id);
end;
$$;

-- Authors may update or delete their own pending proposals
drop policy if exists "content_proposals_update_own_pending" on public.content_proposals;
create policy "content_proposals_update_own_pending"
  on public.content_proposals for update
  using (auth.uid() = author_id and status = 'pending')
  with check (auth.uid() = author_id and status = 'pending');

drop policy if exists "content_proposals_delete_own_pending" on public.content_proposals;
create policy "content_proposals_delete_own_pending"
  on public.content_proposals for delete
  using (auth.uid() = author_id and status = 'pending');

drop policy if exists "content_proposals_delete_master" on public.content_proposals;
create policy "content_proposals_delete_master"
  on public.content_proposals for delete
  using (public.is_master_account());
