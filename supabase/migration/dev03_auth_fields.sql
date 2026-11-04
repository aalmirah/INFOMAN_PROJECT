-- DEV03: profile status flags and secure first-password completion.
--
-- Review health_check.sql output and the live Auth triggers before applying.
-- This script is additive and does not change existing profile rows except
-- that the new columns receive their documented defaults.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.clear_password_change_flag_after_auth_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password
     AND COALESCE(NEW.encrypted_password, '') <> '' THEN
    UPDATE public.profiles
    SET must_change_password = false
    WHERE id = NEW.id
      AND must_change_password = true;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.clear_password_change_flag_after_auth_update()
  FROM PUBLIC, anon, authenticated;

DO $trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'auth.users'::pg_catalog.regclass
      AND tgname = 'hope_clear_password_change_flag'
      AND NOT tgisinternal
  ) THEN
    EXECUTE $sql$
      CREATE TRIGGER hope_clear_password_change_flag
        AFTER UPDATE OF encrypted_password ON auth.users
        FOR EACH ROW
        WHEN (OLD.encrypted_password IS DISTINCT FROM NEW.encrypted_password)
        EXECUTE FUNCTION public.clear_password_change_flag_after_auth_update()
    $sql$;
  END IF;
END;
$trigger$;
