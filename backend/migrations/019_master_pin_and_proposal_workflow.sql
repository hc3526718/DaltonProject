-- Master PIN: set only via SQL (revoke in-app set_master_pin).
-- Proposals: discuss-before-decide, optional document open, author outcome modal + notifications.

alter table public.in_app_notifications
  add column if not exists link_type text,
  add column if not exists link_id uuid;

alter table public.content_proposals
  add column if not exists discussed_at timestamptz,
  add column if not exists show_author_modal boolean not null default false,
  add column if not exists author_modal_ack_at timestamptz,
  add column if not exists followup_notes text,
  add column if not exists followup_asset_urls text[] not null default '{}',
  add column if not exists followup_submitted_at timestamptz;

revoke execute on function public.set_master_pin(text) from authenticated;

create or replace function public.master_mark_proposal_discussed(p_proposal_id uuid)
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
  set discussed_at = coalesce(discussed_at, now()), updated_at = now()
  where id = p_proposal_id and status = 'pending';
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

grant execute on function public.master_mark_proposal_discussed(uuid) to authenticated;

create or replace function public.master_open_content_proposal(p_proposal_id uuid)
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
  select * into row from public.content_proposals where id = p_proposal_id;
  if not found then
    raise exception 'not_found';
  end if;
  if coalesce(cardinality(row.attachment_urls), 0) = 0 then
    return;
  end if;
  update public.content_proposals
  set
    opened_at = coalesce(opened_at, now()),
    opened_by = coalesce(opened_by, auth.uid()),
    updated_at = now()
  where id = p_proposal_id;
end;
$$;

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
  has_attachments boolean;
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

  has_attachments := coalesce(cardinality(row.attachment_urls), 0) > 0;
  if has_attachments and row.opened_at is null then
    raise exception 'not_opened';
  end if;
  if row.discussed_at is null then
    raise exception 'not_discussed';
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

create or replace function public.ack_proposal_author_modal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.content_proposals
  set
    show_author_modal = false,
    author_modal_ack_at = now(),
    updated_at = now()
  where id = p_proposal_id
    and author_id = auth.uid();
end;
$$;

grant execute on function public.ack_proposal_author_modal(uuid) to authenticated;

create or replace function public.submit_proposal_followup(
  p_proposal_id uuid,
  p_notes text,
  p_asset_urls text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.content_proposals
  set
    followup_notes = nullif(trim(coalesce(p_notes, '')), ''),
    followup_asset_urls = coalesce(p_asset_urls, '{}'),
    followup_submitted_at = now(),
    show_author_modal = false,
    author_modal_ack_at = coalesce(author_modal_ack_at, now()),
    updated_at = now()
  where id = p_proposal_id
    and author_id = auth.uid()
    and status = 'approved';
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

grant execute on function public.submit_proposal_followup(uuid, text, text[]) to authenticated;
