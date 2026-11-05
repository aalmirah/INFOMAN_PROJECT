-- DEV06: allow a 'rejected' registration status so a Superadmin can reject a
-- pending account without deleting it. The rejected user is shown a clear
-- message on their next sign-in (or immediately if they are waiting on the
-- register page) instead of a generic "invalid email or password".
--
-- Apply this BEFORE deploying the app code that writes 'rejected'.
-- The inline CHECK created in profile.sql is auto-named profiles_approval_status_check.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_approval_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_approval_status_check
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));
