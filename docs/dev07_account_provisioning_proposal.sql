-- REVIEW ONLY: do not execute in a shared database.
-- This is a per-UUID provisioning proposal, not a signup trigger or backfill.
-- Install or invoke only after separately approved migrations, Auth soft-delete
-- protection, and review of the real schema, triggers, privileges and callers.
-- In particular, do not call it before registration/session setup completes:
-- a linked ERP row prevents the existing Auth cleanup from deleting that user.
-- Existing unlinked ERP rows are never matched by email or modified.
--
-- Locks: auth.users -> advisory (174545, 7) -> profiles -> existing app_user
-- -> role. The advisory lock coordinates with profile and role updates and
-- rights saves. The unique UUID key and FKs remain required. Other writers
-- that do not follow the lock contract can still cause deadlocks.
-- Provisioning requires READ COMMITTED for fresh visibility after lock waits.
-- The installer owns the SECURITY DEFINER function and needs full visibility
-- (including RLS bypass), SELECT on these tables, INSERT on app_user, sequence
-- privileges if required, and UPDATE rights needed by the row locks.
-- No application role gets EXECUTE here. Invocation policy must be reviewed.
--
-- Removing the function stops future provisioning but does not unlink, delete,
-- or repair any created account. Preserve ERP permissions and audit history.

BEGIN;
SET LOCAL row_security = off;

DO $preflight$
DECLARE
  v_auth_column smallint;
  v_auth_id smallint;
  v_profile_id smallint;
  v_role_name smallint;
BEGIN
  SELECT attnum INTO v_auth_column FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.app_user'::pg_catalog.regclass
      AND attname = 'auth_user_id' AND NOT attisdropped;
  SELECT attnum INTO v_profile_id FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.profiles'::pg_catalog.regclass
      AND attname = 'id' AND NOT attisdropped;
  SELECT attnum INTO v_auth_id FROM pg_catalog.pg_attribute
    WHERE attrelid = 'auth.users'::pg_catalog.regclass
      AND attname = 'id' AND NOT attisdropped;
  SELECT attnum INTO v_role_name FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.role'::pg_catalog.regclass
      AND attname = 'name' AND NOT attisdropped;

  IF v_auth_column IS NULL OR v_auth_id IS NULL OR v_profile_id IS NULL OR v_role_name IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_attribute
       WHERE attrelid = 'public.app_user'::pg_catalog.regclass
         AND attname = 'user_id' AND NOT attisdropped AND attidentity IN ('a', 'd')
     ) THEN
    RAISE EXCEPTION 'Verified generated app_user identity is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.app_user'::pg_catalog.regclass
      AND contype = 'u' AND convalidated AND NOT condeferrable
      AND conkey = ARRAY[v_auth_column]::smallint[]
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.app_user'::pg_catalog.regclass
      AND confrelid = 'auth.users'::pg_catalog.regclass
      AND contype = 'f' AND convalidated AND confdeltype = 'r'
      AND conkey = ARRAY[v_auth_column]::smallint[]
      AND confkey = ARRAY[v_auth_id]::smallint[]
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.app_user'::pg_catalog.regclass
      AND confrelid = 'public.profiles'::pg_catalog.regclass
      AND contype = 'f' AND convalidated AND confdeltype = 'r' AND confupdtype = 'r'
      AND conkey = ARRAY[v_auth_column]::smallint[]
      AND confkey = ARRAY[v_profile_id]::smallint[]
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.role'::pg_catalog.regclass
      AND contype = 'u' AND convalidated AND NOT condeferrable
      AND conkey = ARRAY[v_role_name]::smallint[]
  ) THEN
    RAISE EXCEPTION 'UUID uniqueness, RESTRICT FKs and unique role names are required';
  END IF;
  IF pg_catalog.row_security_active('auth.users'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.profiles'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.app_user'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.role'::pg_catalog.regclass) THEN
    RAISE EXCEPTION 'Provisioning owner must bypass RLS on all involved tables';
  END IF;
END;
$preflight$;

CREATE FUNCTION public.dev07_provision_profile(p_auth_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $function$
DECLARE
  v_auth auth.users%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_user public.app_user%ROWTYPE;
  v_role public.role%ROWTYPE;
  v_role_name text;
  v_status text;
  v_email text;
  v_user_id bigint;
BEGIN
  IF p_auth_id IS NULL THEN RAISE EXCEPTION 'Auth UUID is required'; END IF;
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Account provisioning requires READ COMMITTED isolation';
  END IF;
  IF pg_catalog.row_security_active('auth.users'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.profiles'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.app_user'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.role'::pg_catalog.regclass) THEN
    RAISE EXCEPTION 'Provisioning owner must bypass RLS on all involved tables';
  END IF;

  SELECT * INTO v_auth FROM auth.users WHERE id = p_auth_id FOR UPDATE;
  IF NOT FOUND OR v_auth.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Auth account is missing or soft-deleted';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(174545, 7);
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_auth_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile is missing'; END IF;
  SELECT * INTO v_user FROM public.app_user WHERE auth_user_id = p_auth_id FOR UPDATE;

  IF v_profile.first_name IS NULL OR pg_catalog.btrim(v_profile.first_name) = ''
     OR v_profile.last_name IS NULL OR pg_catalog.btrim(v_profile.last_name) = ''
     OR v_profile.email IS NULL OR pg_catalog.btrim(v_profile.email) = ''
     OR v_profile.is_active IS NULL OR v_profile.is_blocked IS NULL
     OR v_profile.must_change_password IS NULL THEN
    RAISE EXCEPTION 'Profile data is incomplete';
  END IF;
  v_role_name := CASE v_profile.role
    WHEN 'user' THEN 'User' WHEN 'admin' THEN 'Admin'
    WHEN 'superadmin' THEN 'Superadmin' ELSE NULL END;
  IF v_role_name IS NULL THEN RAISE EXCEPTION 'Profile role cannot be mapped'; END IF;
  SELECT * INTO v_role FROM public.role WHERE name = v_role_name FOR SHARE;
  IF NOT FOUND OR v_role.status IS DISTINCT FROM 'Active' THEN
    RAISE EXCEPTION 'Mapped ERP role is missing or inactive';
  END IF;
  v_status := CASE v_profile.approval_status
    WHEN 'pending' THEN 'Pending'
    WHEN 'rejected' THEN 'Rejected'
    WHEN 'approved' THEN CASE
      WHEN v_profile.is_active AND NOT v_profile.is_blocked
        AND NOT v_profile.must_change_password THEN 'Active'
      ELSE 'Inactive' END
    ELSE NULL END;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Profile approval status cannot be mapped'; END IF;
  v_email := pg_catalog.lower(pg_catalog.btrim(v_profile.email));

  IF v_user.user_id IS NOT NULL THEN
    IF v_user.role_id IS DISTINCT FROM v_role.role_id
       OR v_user.status IS DISTINCT FROM v_status
       OR v_user.is_blocked IS DISTINCT FROM v_profile.is_blocked
       OR v_user.must_set_password IS DISTINCT FROM v_profile.must_change_password
       OR v_user.first_name IS DISTINCT FROM v_profile.first_name
       OR v_user.last_name IS DISTINCT FROM v_profile.last_name
       OR v_user.email IS DISTINCT FROM v_email THEN
      RAISE EXCEPTION 'Existing linked ERP account requires separate reconciliation';
    END IF;
    RETURN v_user.user_id;
  END IF;

  INSERT INTO public.app_user
    (auth_user_id, first_name, last_name, email, role_id, status, is_blocked, must_set_password)
  VALUES
    (p_auth_id, v_profile.first_name, v_profile.last_name, v_email, v_role.role_id,
     v_status, v_profile.is_blocked, v_profile.must_change_password)
  RETURNING user_id INTO v_user_id;
  RETURN v_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.dev07_provision_profile(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
