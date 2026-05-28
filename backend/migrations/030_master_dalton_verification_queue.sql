-- Manual Dalton verification: premium users await master approval (no auto-verify on is_pro).

DROP TRIGGER IF EXISTS subscription_state_sync_dalton_verified ON public.subscription_state;

CREATE OR REPLACE FUNCTION public.list_premium_awaiting_dalton_verification()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  is_pro boolean,
  premium_updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    s.is_pro,
    s.updated_at AS premium_updated_at
  FROM public.profiles p
  INNER JOIN public.subscription_state s ON s.user_id = p.id
  WHERE s.is_pro IS TRUE
    AND COALESCE(p.dalton_verified, false) IS NOT TRUE
    AND EXISTS (
      SELECT 1
      FROM public.profiles m
      WHERE m.id = auth.uid()
        AND m.master_control = 'yes'
    )
  ORDER BY s.updated_at DESC NULLS LAST, p.display_name ASC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.master_grant_dalton_verified(
  target_user_id uuid,
  pin text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
  IF NOT EXISTS (
    SELECT 1
    FROM public.subscription_state s
    WHERE s.user_id = target_user_id
      AND s.is_pro IS TRUE
  ) THEN
    RAISE EXCEPTION 'user_not_premium';
  END IF;
  UPDATE public.profiles
  SET dalton_verified = true
  WHERE id = target_user_id
    AND (dalton_verified IS DISTINCT FROM true);
  RETURN FOUND;
END;
$fn$;

REVOKE ALL ON FUNCTION public.list_premium_awaiting_dalton_verification() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.master_grant_dalton_verified(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_premium_awaiting_dalton_verification() TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_grant_dalton_verified(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_premium_awaiting_dalton_verification() TO service_role;
GRANT EXECUTE ON FUNCTION public.master_grant_dalton_verified(uuid, text) TO service_role;
