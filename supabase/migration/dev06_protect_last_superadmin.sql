-- DEV06: database-level safety net so the last active Superadmin can never be
-- deleted, demoted, blocked, disabled, or un-approved, even if app code is bypassed
-- (service-role key misuse, SQL editor, a future bug, concurrent requests).
--
-- To be reviewed and applied by the DB Admin. The application already enforces
-- the same rule in its API routes; this trigger is the second layer.
--
-- Also confirm profiles keeps RLS enabled with only the SELECT grant/policy from
-- profile.sql. Do NOT add UPDATE or DELETE policies for `authenticated`; all
-- role and approval changes must go through the server routes (service role).

CREATE OR REPLACE FUNCTION public.protect_last_superadmin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  remaining integer;
  was_active_superadmin boolean;
  still_active_superadmin boolean;
BEGIN
  was_active_superadmin :=
    OLD.role = 'superadmin'
    AND OLD.approval_status = 'approved'
    AND OLD.is_active
    AND NOT OLD.is_blocked;

  IF NOT was_active_superadmin THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    still_active_superadmin :=
      NEW.role = 'superadmin'
      AND NEW.approval_status = 'approved'
      AND NEW.is_active
      AND NOT NEW.is_blocked;
    IF still_active_superadmin THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Serialize concurrent attempts so two Superadmins cannot remove each other at once.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('hope_protect_last_superadmin')
  );

  SELECT pg_catalog.count(*)
  INTO remaining
  FROM public.profiles
  WHERE id <> OLD.id
    AND role = 'superadmin'
    AND approval_status = 'approved'
    AND is_active
    AND NOT is_blocked;

  IF remaining = 0 THEN
    RAISE EXCEPTION
      'The last remaining Superadmin cannot be deleted, demoted, blocked, or disabled.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.protect_last_superadmin()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hope_protect_last_superadmin_update ON public.profiles;
CREATE TRIGGER hope_protect_last_superadmin_update
  BEFORE UPDATE OF role, approval_status, is_active, is_blocked
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_last_superadmin();

-- Also fires when auth.users is deleted, because profiles.id cascades from it.
DROP TRIGGER IF EXISTS hope_protect_last_superadmin_delete ON public.profiles;
CREATE TRIGGER hope_protect_last_superadmin_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_last_superadmin();

-- Verification (run as a test, inside a transaction you roll back):
--   BEGIN;
--   UPDATE public.profiles SET role = 'user'
--   WHERE role = 'superadmin';   -- must fail when only one active Superadmin exists
--   ROLLBACK;
