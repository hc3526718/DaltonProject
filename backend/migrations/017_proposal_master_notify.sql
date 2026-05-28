-- Notify master accounts when a new content proposal is submitted (in-app row).

create or replace function public.notify_masters_new_proposal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  title_txt text;
  body_txt text;
begin
  title_txt := case new.kind
    when 'sponsor' then 'New sponsorship proposal'
    when 'event' then 'New event proposal'
    else 'New media proposal'
  end;

  body_txt := coalesce(
    nullif(trim(new.payload->>'title'), ''),
    nullif(trim(new.payload->>'brand_name'), ''),
    'A creator submitted a proposal for review.'
  );

  insert into public.in_app_notifications (user_id, title, body, read_at, created_at)
  select
    p.id,
    title_txt,
    body_txt,
    null,
    now()
  from public.profiles p
  where p.master_control = 'yes';

  return new;
end;
$$;

drop trigger if exists trg_notify_masters_new_proposal on public.content_proposals;
create trigger trg_notify_masters_new_proposal
  after insert on public.content_proposals
  for each row
  execute function public.notify_masters_new_proposal();
