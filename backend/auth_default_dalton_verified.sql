-- Dalton — default dalton_verified for every new auth user + protect profiles.dalton_verified from self-service edits.
-- Run in Supabase SQL Editor AFTER backend/schema.sql + backend/handle_new_user.sql (updated insert includes dalton_verified).
--
-- 1) BEFORE INSERT on auth.users: merge raw_user_meta_data.dalton_verified = false when the key is absent
--    (covers email, Google, Apple, and API-created users).
-- 2) BEFORE UPDATE on public.profiles: users cannot change their own dalton_verified; staff/service_role can
--    (Table Editor / SQL / Edge Functions using service role bypass RLS but still hit this trigger — see note below).

CREATE OR REPLACE FUNCTION public.auth_user_set_default_dalton_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data IS NULL OR NOT (NEW.raw_user_meta_data ? 'dalton_verified') THEN
    NEW.raw_user_meta_data :=
      COALESCE(NEW.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('dalton_verified', false);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auth_user_set_default_dalton_verified ON auth.users;

CREATE TRIGGER auth_user_set_default_dalton_verified
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auth_user_set_default_dalton_verified();

-- Revert dalton_verified when the row owner (authenticated as that user) tries to change it.
-- Staff edits in Dashboard as postgres / service role typically have auth.uid() IS NULL or != OLD.id.
CREATE OR REPLACE FUNCTION public.profiles_lock_dalton_verified_for_self()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.dalton_verified IS DISTINCT FROM NEW.dalton_verified
     AND auth.uid() IS NOT NULL
     AND auth.uid() = OLD.id
  THEN
    NEW.dalton_verified := OLD.dalton_verified;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_lock_dalton_verified ON public.profiles;

CREATE TRIGGER profiles_lock_dalton_verified
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_lock_dalton_verified_for_self();
