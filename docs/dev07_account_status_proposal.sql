-- REVIEW ONLY: do not execute without separate approval and isolated testing.
-- Adds the agreed ERP status values without changing existing rows or defaults.
-- The existing Active default remains: provisioning must always set a status.
-- ALTER TABLE takes an exclusive lock; check dependencies and schedule first.
-- Once new statuses are used, rollback requires a reviewed forward repair.

BEGIN;

ALTER TABLE public.app_user DROP CONSTRAINT app_user_status_check;
ALTER TABLE public.app_user
  ADD CONSTRAINT app_user_status_check
  CHECK (status IN ('Pending', 'Active', 'Rejected', 'Inactive'));

COMMIT;
