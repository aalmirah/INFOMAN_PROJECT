-- REVIEW ONLY: do not execute without separate approval and isolated QA.
-- Existing app_user.auth_user_id -> auth.users(id) ON DELETE RESTRICT remains.
-- This additional FK requires every linked ERP account to have a profile and
-- prevents deletion or identity changes of that profile while it is linked.
-- It never creates, deletes, relinks, or backfills any accounts.
--
-- Before review/application, the DB Admin must confirm the live constraints,
-- existing account links and consumers. The executing role needs ownership of
-- app_user, REFERENCES on profiles, and permission to see all relevant rows.
-- This migration takes locks on both tables while the FK is validated.
-- It intentionally fails if an orphan, duplicate FK, or conflicting name exists.
-- Once dependent synchronization is in use, rollback requires a reviewed
-- coordinated migration; dropping this FK reopens the profile-deletion race.

BEGIN;
SET LOCAL row_security = off;

DO $preflight$
DECLARE
  v_auth_column smallint;
BEGIN
  SELECT attnum INTO v_auth_column
  FROM pg_catalog.pg_attribute
  WHERE attrelid = 'public.app_user'::pg_catalog.regclass
    AND attname = 'auth_user_id' AND NOT attisdropped;
  IF v_auth_column IS NULL THEN
    RAISE EXCEPTION 'app_user.auth_user_id is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.app_user AS u
    LEFT JOIN public.profiles AS p ON p.id = u.auth_user_id
    WHERE u.auth_user_id IS NOT NULL AND p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Linked ERP accounts without profiles require review';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint AS c
    WHERE c.conrelid = 'public.app_user'::pg_catalog.regclass
      AND (
        c.conname = 'dev07_app_user_profile_fkey'
        OR (
          c.contype = 'f'
          AND c.confrelid = 'public.profiles'::pg_catalog.regclass
          AND c.conkey = ARRAY[v_auth_column]::smallint[]
        )
      )
  ) THEN
    RAISE EXCEPTION 'Profile FK or proposed constraint name already exists';
  END IF;
END;
$preflight$;

ALTER TABLE public.app_user
  ADD CONSTRAINT dev07_app_user_profile_fkey
  FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id)
  ON UPDATE RESTRICT ON DELETE RESTRICT;

COMMIT;

-- After separately approved installation, verify with:
-- SELECT conname, convalidated, pg_get_constraintdef(oid)
-- FROM pg_catalog.pg_constraint
-- WHERE conrelid = 'public.app_user'::regclass
--   AND conname IN ('app_user_auth_user_id_fkey', 'dev07_app_user_profile_fkey');
