-- REVIEW ONLY: do not execute without separate approval and isolated QA.
--
-- Prerequisites:
-- * Review and separately approve the status and profile-link FK proposals.
--   Both the existing Auth FK and new profile FK must be validated and RESTRICT.
-- * Reconcile existing linked accounts separately; this creates no ERP rows
--   and does not backfill or repair existing links.
--   New-account provisioning and reconciliation are not yet implemented;
--   this draft alone is not a complete DEV07 rollout.
-- * Review actual profile, role, app_user and Auth triggers and integrations.
--   ERP access must remain fail-closed for unlinked or inconsistent accounts.
-- * Confirm how Auth soft deletion works and prevent it for linked accounts
--   before rollout. The FKs protect hard DELETE, not an Auth soft-delete UPDATE.
-- * The creating role owns both SECURITY DEFINER functions. It must already
--   have table SELECT on profiles, app_user and role; table UPDATE on app_user;
--   and UPDATE on at least one column of profiles and role for row locks.
--   RLS must not apply to it on those tables. No existing grants are changed.
--   The executing role also needs USAGE/CREATE in public and TRIGGER on both tables.
--   If these privileges are later lost, covered profile updates fail closed,
--   including updates of unlinked profiles.
--
-- Locking: BEFORE STATEMENT triggers serialize profile and role updates with
-- advisory transaction lock (174545, 7), before either takes row locks. Rights
-- save uses the same lock before profile/ERP/role locks. Provisioning locks the
-- Auth row first, then takes this lock before profile/ERP/role locks; this
-- matches Auth password updates that trigger profile synchronization.
-- These operations require READ COMMITTED so a statement waiting for the lock
-- does not use a transaction snapshot from before another writer committed.
-- All reconciliation and other writers that take these row locks explicitly
-- must follow the same ordering. Transactions must be short: even updates to
-- unlinked profiles or roles wait on the shared lock until transaction end.
-- Writers that lock rows before using the protocol, or interact with other
-- tables in a conflicting order, can still deadlock. PostgreSQL aborts one
-- transaction; existing application flows do not automatically retry.
--
-- No profile INSERT or DELETE trigger is installed. Provisioning is separate:
-- initialize a linked ERP row from the locked, current profile and role in one
-- transaction; never rely on app_user's Active default. An unlinked profile is
-- deliberately left unprovisioned. The profile FK prevents deleting a linked
-- profile, and the existing Auth FK prevents hard-deleting its Auth user.
-- On cleanup failure, retain Auth, profile, ERP and history; report the error
-- for UUID-based recovery, not a blind delete or repeat registration.
--
-- Password recovery: the Auth password update, profile flag update and this
-- trigger are one DB transaction. A sync exception rolls all three back.
-- Correct the cause, then retry setup for the existing account using its valid
-- session or a fresh recovery link. Do not clear the flag or activate ERP by
-- hand. For a timeout/unknown outcome, verify committed profile and ERP state
-- and authenticate through the normal flow before deciding whether to retry.
-- A reset when must_change_password is already false does not fire this sync.
--
-- Isolated QA (no production accounts; record no passwords or hashes):
-- 1. Hard-delete linked Auth and profile separately: both fail; all rows,
--    flags and permission/audit history remain unchanged.
-- 2. Test profile-validation and magic-link cleanup, plus Admin-created
--    cleanup, for unlinked accounts: Auth/profile cleanup succeeds and no ERP
--    history is deleted. For linked accounts, cleanup fails and is reported.
-- 3. Race profile deletion with provisioning: either linking succeeds and
--    deletion fails, or deletion succeeds and linking fails; never an orphan.
-- 4. Inject a sync error during first password setup for an approved linked
--    user: Auth reports failure; compare the old/new hash for equality without
--    displaying it; profile and ERP flags stay true and ERP remains Inactive.
-- 5. Fix the cause and retry that same account: setup succeeds, both flags
--    become false and ERP becomes Active only if all eligibility checks pass.
-- 6. Simulate an ambiguous timeout after a committed password update: inspect
--    state, sign in normally, and do not clear flags or repeat registration.
--    Also reset a user whose flag is already false and verify normal behavior.
-- 7. Deactivate/reactivate a role: role_id and permissions do not change;
--    eligible profiles become Inactive/Active, while blocked, password-pending,
--    pending and rejected profiles retain their appropriate non-effective state.
-- 8. Rename a role with linked accounts: the update fails; role name, IDs,
--    statuses and permissions remain unchanged. Test an unlinked role separately.
-- 9. On an unrelated profile update with a mismatched ERP role, reject and
--    preserve role_id; explicitly change a profile role and verify only that
--    change maps to an active role. Missing/inactive new roles must fail.
--    With a test UPDATE OF role_id trigger, verify unrelated profile updates
--    do not target the ERP role_id column.
-- 10. Race role deactivation with profile role/eligibility changes and
--     provisioning. Committed rows must agree; deadlocks/serialization failures
--     roll back completely and are retried as whole operations.
-- 11. Test a non-bypass/insufficient-privilege function owner in isolation:
--     installation or synchronization must fail, never silently skip a link.
-- 12. Verify DEV02-DEV06 registration, approval, password setup/reset, user
--     edits, block/unblock and last-Superadmin protection remain functional.
--     Verify Auth soft-delete behavior separately before allowing rollout.
--
-- Rollback: disable dependent rights/ERP access first. Removing the triggers
-- stops future synchronization and can leave links stale. Review and reconcile
-- current rows before any forward repair; do not delete ERP rows or history.
-- Removing the profile FK later permits profile deletion while ERP rows remain.

BEGIN;

DO $preflight$
DECLARE
  v_app_column smallint;
  v_profile_column smallint;
  v_auth_column smallint;
BEGIN
  SELECT attnum INTO v_app_column FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.app_user'::pg_catalog.regclass
      AND attname = 'auth_user_id' AND NOT attisdropped;
  SELECT attnum INTO v_profile_column FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.profiles'::pg_catalog.regclass
      AND attname = 'id' AND NOT attisdropped;
  SELECT attnum INTO v_auth_column FROM pg_catalog.pg_attribute
    WHERE attrelid = 'auth.users'::pg_catalog.regclass
      AND attname = 'id' AND NOT attisdropped;
  IF v_app_column IS NULL OR v_profile_column IS NULL OR v_auth_column IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint AS c
    WHERE c.conrelid = 'public.app_user'::pg_catalog.regclass
      AND c.confrelid = 'public.profiles'::pg_catalog.regclass
      AND c.conname = 'dev07_app_user_profile_fkey'
      AND c.contype = 'f' AND c.convalidated
      AND c.confdeltype = 'r' AND c.confupdtype = 'r'
      AND c.conkey = ARRAY[v_app_column]::smallint[]
      AND c.confkey = ARRAY[v_profile_column]::smallint[]
  ) THEN
    RAISE EXCEPTION 'Validated profile RESTRICT FK is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint AS c
    WHERE c.conrelid = 'public.app_user'::pg_catalog.regclass
      AND c.confrelid = 'auth.users'::pg_catalog.regclass
      AND c.conname = 'app_user_auth_user_id_fkey'
      AND c.contype = 'f' AND c.convalidated AND c.confdeltype = 'r'
      AND c.conkey = ARRAY[v_app_column]::smallint[]
      AND c.confkey = ARRAY[v_auth_column]::smallint[]
  ) THEN
    RAISE EXCEPTION 'Validated Auth RESTRICT FK is required';
  END IF;
END;
$preflight$;

CREATE FUNCTION public.dev07_lock_account_sync()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = ''
AS $function$
BEGIN
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Profile and role updates require READ COMMITTED isolation';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(174545, 7);
  RETURN NULL;
END;
$function$;

CREATE FUNCTION public.dev07_sync_linked_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $function$
DECLARE
  v_user public.app_user%ROWTYPE;
  v_old_role_name text;
  v_new_role_name text;
  v_current_role_name text;
  v_role_id bigint;
  v_role_status text;
  v_status text;
  v_email text;
BEGIN
  IF pg_catalog.row_security_active('public.profiles'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.app_user'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.role'::pg_catalog.regclass)
     OR NOT pg_catalog.has_table_privilege('public.profiles', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('public.app_user', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('public.app_user', 'UPDATE')
     OR NOT pg_catalog.has_table_privilege('public.role', 'SELECT')
     OR NOT pg_catalog.has_any_column_privilege('public.profiles', 'UPDATE')
     OR NOT pg_catalog.has_any_column_privilege('public.role', 'UPDATE') THEN
    RAISE EXCEPTION 'Synchronization owner lacks full access or RLS bypass';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    IF EXISTS (
      SELECT 1 FROM public.app_user
      WHERE auth_user_id IN (OLD.id, NEW.id)
    ) THEN
      RAISE EXCEPTION 'Cannot change a profile ID linked to an ERP account';
    END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO v_user FROM public.app_user
    WHERE auth_user_id = NEW.id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.first_name IS NULL OR pg_catalog.btrim(NEW.first_name) = ''
     OR NEW.last_name IS NULL OR pg_catalog.btrim(NEW.last_name) = ''
     OR NEW.email IS NULL OR pg_catalog.btrim(NEW.email) = '' THEN
    RAISE EXCEPTION 'Linked profile requires first name, last name and email';
  END IF;

  v_old_role_name := CASE OLD.role
    WHEN 'user' THEN 'User'
    WHEN 'admin' THEN 'Admin'
    WHEN 'superadmin' THEN 'Superadmin'
    ELSE NULL
  END;
  v_new_role_name := CASE NEW.role
    WHEN 'user' THEN 'User'
    WHEN 'admin' THEN 'Admin'
    WHEN 'superadmin' THEN 'Superadmin'
    ELSE NULL
  END;
  IF v_old_role_name IS NULL OR v_new_role_name IS NULL THEN
    RAISE EXCEPTION 'Profile role cannot be mapped to an ERP role';
  END IF;

  SELECT name, status INTO v_current_role_name, v_role_status
    FROM public.role WHERE role_id = v_user.role_id FOR SHARE;
  IF NOT FOUND OR v_current_role_name IS DISTINCT FROM v_old_role_name THEN
    RAISE EXCEPTION 'Linked ERP role does not match the previous profile role';
  END IF;
  v_role_id := v_user.role_id;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    SELECT role_id, status INTO v_role_id, v_role_status
      FROM public.role WHERE name = v_new_role_name AND status = 'Active'
      FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'New profile role has no active ERP role';
    END IF;
  END IF;

  v_status := CASE NEW.approval_status
    WHEN 'pending' THEN 'Pending'
    WHEN 'rejected' THEN 'Rejected'
    WHEN 'approved' THEN CASE
      WHEN NEW.is_active AND NOT NEW.is_blocked AND NOT NEW.must_change_password
           AND v_role_status = 'Active' THEN 'Active'
      ELSE 'Inactive'
    END
    ELSE NULL
  END;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Profile approval status cannot be mapped';
  END IF;
  v_email := pg_catalog.lower(pg_catalog.btrim(NEW.email));

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    UPDATE public.app_user AS u
      SET first_name = NEW.first_name,
          last_name = NEW.last_name,
          email = v_email,
          role_id = v_role_id,
          status = v_status,
          is_blocked = NEW.is_blocked,
          must_set_password = NEW.must_change_password
      WHERE u.user_id = v_user.user_id;
  ELSE
    UPDATE public.app_user AS u
      SET first_name = NEW.first_name,
          last_name = NEW.last_name,
          email = v_email,
          status = v_status,
          is_blocked = NEW.is_blocked,
          must_set_password = NEW.must_change_password
      WHERE u.user_id = v_user.user_id
        AND (
          u.first_name IS DISTINCT FROM NEW.first_name
          OR u.last_name IS DISTINCT FROM NEW.last_name
          OR u.email IS DISTINCT FROM v_email
          OR u.status IS DISTINCT FROM v_status
          OR u.is_blocked IS DISTINCT FROM NEW.is_blocked
          OR u.must_set_password IS DISTINCT FROM NEW.must_change_password
        );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE FUNCTION public.dev07_sync_linked_role_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_user public.app_user%ROWTYPE;
  v_expected_role_name text;
  v_status text;
BEGIN
  IF pg_catalog.row_security_active('public.profiles'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.app_user'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.role'::pg_catalog.regclass)
     OR NOT pg_catalog.has_table_privilege('public.profiles', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('public.app_user', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('public.app_user', 'UPDATE')
     OR NOT pg_catalog.has_table_privilege('public.role', 'SELECT')
     OR NOT pg_catalog.has_any_column_privilege('public.profiles', 'UPDATE')
     OR NOT pg_catalog.has_any_column_privilege('public.role', 'UPDATE') THEN
    RAISE EXCEPTION 'Synchronization owner lacks full access or RLS bypass';
  END IF;

  IF NEW.name IS DISTINCT FROM OLD.name AND EXISTS (
    SELECT 1 FROM public.app_user
    WHERE role_id = NEW.role_id AND auth_user_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot rename an ERP role used by linked accounts';
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  FOR v_profile IN
    SELECT p.* FROM public.profiles AS p
    JOIN public.app_user AS u ON u.auth_user_id = p.id
    WHERE u.role_id = NEW.role_id
    ORDER BY p.id FOR UPDATE OF p
  LOOP
    SELECT * INTO v_user FROM public.app_user
      WHERE auth_user_id = v_profile.id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Linked ERP account disappeared during role synchronization';
    END IF;
    IF v_user.role_id IS DISTINCT FROM NEW.role_id THEN
      CONTINUE;
    END IF;

    v_expected_role_name := CASE v_profile.role
      WHEN 'user' THEN 'User'
      WHEN 'admin' THEN 'Admin'
      WHEN 'superadmin' THEN 'Superadmin'
      ELSE NULL
    END;
    IF v_expected_role_name IS NULL OR NEW.name IS DISTINCT FROM v_expected_role_name
       OR v_user.is_blocked IS DISTINCT FROM v_profile.is_blocked
       OR v_user.must_set_password IS DISTINCT FROM v_profile.must_change_password THEN
      RAISE EXCEPTION 'Linked ERP account and profile require reconciliation';
    END IF;

    v_status := CASE v_profile.approval_status
      WHEN 'pending' THEN 'Pending'
      WHEN 'rejected' THEN 'Rejected'
      WHEN 'approved' THEN CASE
        WHEN v_profile.is_active AND NOT v_profile.is_blocked
             AND NOT v_profile.must_change_password AND NEW.status = 'Active'
          THEN 'Active'
        ELSE 'Inactive'
      END
      ELSE NULL
    END;
    IF v_status IS NULL THEN
      RAISE EXCEPTION 'Profile approval status cannot be mapped';
    END IF;
    UPDATE public.app_user SET status = v_status
      WHERE user_id = v_user.user_id AND status IS DISTINCT FROM v_status;
  END LOOP;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.dev07_lock_account_sync()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.dev07_sync_linked_profile()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.dev07_sync_linked_role_status()
  FROM PUBLIC, anon, authenticated, service_role;

DO $owner_check$
BEGIN
  IF pg_catalog.row_security_active('public.profiles'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.app_user'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.role'::pg_catalog.regclass)
     OR NOT pg_catalog.has_table_privilege('public.profiles', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('public.app_user', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('public.app_user', 'UPDATE')
     OR NOT pg_catalog.has_table_privilege('public.role', 'SELECT')
     OR NOT pg_catalog.has_any_column_privilege('public.profiles', 'UPDATE')
     OR NOT pg_catalog.has_any_column_privilege('public.role', 'UPDATE')
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_proc AS p
       WHERE p.oid IN (
         'public.dev07_lock_account_sync()'::pg_catalog.regprocedure,
         'public.dev07_sync_linked_profile()'::pg_catalog.regprocedure,
         'public.dev07_sync_linked_role_status()'::pg_catalog.regprocedure
       ) AND pg_catalog.pg_get_userbyid(p.proowner) <> CURRENT_USER
     )
     OR pg_catalog.has_function_privilege('anon', 'public.dev07_lock_account_sync()', 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', 'public.dev07_lock_account_sync()', 'EXECUTE')
     OR pg_catalog.has_function_privilege('service_role', 'public.dev07_lock_account_sync()', 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', 'public.dev07_sync_linked_profile()', 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', 'public.dev07_sync_linked_profile()', 'EXECUTE')
     OR pg_catalog.has_function_privilege('service_role', 'public.dev07_sync_linked_profile()', 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', 'public.dev07_sync_linked_role_status()', 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', 'public.dev07_sync_linked_role_status()', 'EXECUTE')
     OR pg_catalog.has_function_privilege('service_role', 'public.dev07_sync_linked_role_status()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Synchronization owner or function privileges are unsafe';
  END IF;
END;
$owner_check$;

CREATE TRIGGER dev07_lock_profiles_before_update
  BEFORE UPDATE ON public.profiles
  FOR EACH STATEMENT EXECUTE FUNCTION public.dev07_lock_account_sync();

CREATE TRIGGER dev07_lock_roles_before_update
  BEFORE UPDATE ON public.role
  FOR EACH STATEMENT EXECUTE FUNCTION public.dev07_lock_account_sync();

CREATE TRIGGER dev07_sync_profile_update
  AFTER UPDATE OF id, first_name, last_name, email, role, approval_status,
                  is_active, is_blocked, must_change_password
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.dev07_sync_linked_profile();

CREATE TRIGGER dev07_sync_role_update
  AFTER UPDATE OF name, status ON public.role
  FOR EACH ROW EXECUTE FUNCTION public.dev07_sync_linked_role_status();

DO $verify_lock_triggers$
BEGIN
  IF (SELECT pg_catalog.count(*) FROM pg_catalog.pg_trigger AS t
      WHERE NOT t.tgisinternal AND t.tgenabled = 'O' AND t.tgtype = 18
        AND t.tgfoid = 'public.dev07_lock_account_sync()'::pg_catalog.regprocedure
        AND ((t.tgrelid = 'public.profiles'::pg_catalog.regclass
              AND t.tgname = 'dev07_lock_profiles_before_update')
          OR (t.tgrelid = 'public.role'::pg_catalog.regclass
              AND t.tgname = 'dev07_lock_roles_before_update'))) <> 2 THEN
    RAISE EXCEPTION 'Synchronization coordination triggers are missing or invalid';
  END IF;
END;
$verify_lock_triggers$;

COMMIT;

-- After separately approved installation, verify the actual function owners
-- and settings; do not assume the installer was postgres:
-- SELECT p.oid::regprocedure, pg_get_userbyid(p.proowner) AS owner,
--        p.prosecdef, p.proconfig
-- FROM pg_catalog.pg_proc AS p
-- WHERE p.oid IN ('public.dev07_sync_linked_profile()'::regprocedure,
--                 'public.dev07_sync_linked_role_status()'::regprocedure);
