-- Ensure PostgREST exposes verify_master_pin (fixes REST 404 when grants/schema cache drift).

create or replace function public.verify_master_pin(pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  h text;
  expected text;
begin
  if auth.uid() is null then
    return false;
  end if;
  if not exists (select 1 from profiles where id = auth.uid() and master_control = 'yes') then
    return false;
  end if;
  select master_pin_hash into h from profiles where id = auth.uid();
  if h is null or pin is null or length(trim(pin)) <> 6 then
    return false;
  end if;
  expected := encode(
    digest(trim(pin) || auth.uid()::text || 'dalton_master_v1', 'sha256'),
    'hex'
  );
  return h = expected;
end;
$fn$;

revoke all on function public.verify_master_pin(text) from public;
grant execute on function public.verify_master_pin(text) to authenticated;
grant execute on function public.verify_master_pin(text) to service_role;

notify pgrst, 'reload schema';
