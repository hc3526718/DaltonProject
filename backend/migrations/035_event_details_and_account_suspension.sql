-- Structured event wizard fields + master account suspension tooling.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_details jsonb;

COMMENT ON COLUMN public.events.event_details IS
  'Wizard metadata: level, capacity, tags, agenda, faqs, bring, duration. Host narrative stays in description.';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_permanent boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.suspended_until IS
  'When set and in the future, account is temporarily suspended until this timestamp (UTC).';
COMMENT ON COLUMN public.profiles.suspended_permanent IS
  'When true, account is suspended indefinitely until cleared by master control.';

CREATE OR REPLACE FUNCTION public.list_master_user_accounts(p_limit integer DEFAULT 300)
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  username text,
  first_name text,
  last_name text,
  persona_role text,
  created_at timestamptz,
  suspended_until timestamptz,
  suspended_permanent boolean,
  master_control text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    u.email::text AS email,
    p.display_name,
    p.username,
    p.first_name,
    p.last_name,
    p.persona_role,
    p.created_at,
    p.suspended_until,
    p.suspended_permanent,
    p.master_control
  FROM public.profiles p
  INNER JOIN auth.users u ON u.id = p.id
  WHERE EXISTS (
    SELECT 1 FROM public.profiles m
    WHERE m.id = auth.uid() AND m.master_control = 'yes'
  )
  ORDER BY p.created_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 300), 500));
$$;

CREATE OR REPLACE FUNCTION public.master_suspend_user(
  target_user_id uuid,
  pin text,
  suspend_hours integer DEFAULT NULL,
  suspend_days integer DEFAULT NULL,
  suspend_weeks integer DEFAULT NULL,
  permanent boolean DEFAULT false,
  clear_suspension boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  until_ts timestamptz;
  total_hours integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles m
    WHERE m.id = auth.uid() AND m.master_control = 'yes'
  ) THEN
    RETURN false;
  END IF;
  IF public.verify_master_pin(pin) IS NOT TRUE THEN
    RETURN false;
  END IF;
  IF target_user_id IS NULL THEN
    RETURN false;
  END IF;
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_suspend_self';
  END IF;

  IF clear_suspension IS TRUE THEN
    UPDATE public.profiles
    SET suspended_until = NULL, suspended_permanent = false
    WHERE id = target_user_id;
    RETURN FOUND;
  END IF;

  IF permanent IS TRUE THEN
    UPDATE public.profiles
    SET suspended_permanent = true, suspended_until = NULL
    WHERE id = target_user_id;
    RETURN FOUND;
  END IF;

  total_hours := COALESCE(suspend_hours, 0)
    + COALESCE(suspend_days, 0) * 24
    + COALESCE(suspend_weeks, 0) * 24 * 7;
  IF total_hours < 1 THEN
    RAISE EXCEPTION 'invalid_suspend_duration';
  END IF;

  until_ts := now() + (total_hours || ' hours')::interval;
  UPDATE public.profiles
  SET suspended_until = until_ts, suspended_permanent = false
  WHERE id = target_user_id;
  RETURN FOUND;
END;
$fn$;

REVOKE ALL ON FUNCTION public.list_master_user_accounts(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.master_suspend_user(uuid, text, integer, integer, integer, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_master_user_accounts(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_suspend_user(uuid, text, integer, integer, integer, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_master_user_accounts(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.master_suspend_user(uuid, text, integer, integer, integer, boolean, boolean) TO service_role;
