-- Dalton — auto-create public.profiles on signup (matches profiles.id = auth.users.id).
-- Run AFTER backend/schema.sql, then apply backend/rls_policies.sql in the Supabase SQL editor.
-- Verify: sign up a test user → Table Editor → public.profiles should contain a row with matching id.
--
-- If your Postgres version rejects EXECUTE FUNCTION, use:
--   EXECUTE PROCEDURE public.handle_new_user();
-- instead of EXECUTE FUNCTION.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, dalton_verified)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data ->> 'name'), ''),
      split_part(COALESCE(NEW.email, 'user'), '@', 1)
    ),
    CASE
      WHEN NEW.raw_user_meta_data ? 'dalton_verified'
        THEN COALESCE((NEW.raw_user_meta_data ->> 'dalton_verified')::boolean, false)
      ELSE false
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
