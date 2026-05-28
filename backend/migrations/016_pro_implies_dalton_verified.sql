-- Premium (is_pro) implies Dalton verified; verified does NOT imply premium.
-- Admins can still set profiles.dalton_verified = true without subscription_state.is_pro.

CREATE OR REPLACE FUNCTION public.subscription_state_sync_dalton_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_pro IS TRUE THEN
    UPDATE public.profiles
    SET dalton_verified = true
    WHERE id = NEW.user_id
      AND (dalton_verified IS DISTINCT FROM true);
  END IF;
  -- When is_pro becomes false, do not clear dalton_verified.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscription_state_sync_dalton_verified ON public.subscription_state;

CREATE TRIGGER subscription_state_sync_dalton_verified
  AFTER INSERT OR UPDATE OF is_pro ON public.subscription_state
  FOR EACH ROW
  WHEN (NEW.is_pro IS TRUE)
  EXECUTE FUNCTION public.subscription_state_sync_dalton_verified();

-- Backfill existing premium rows.
UPDATE public.profiles p
SET dalton_verified = true
FROM public.subscription_state s
WHERE s.user_id = p.id
  AND s.is_pro IS TRUE
  AND (p.dalton_verified IS DISTINCT FROM true);
