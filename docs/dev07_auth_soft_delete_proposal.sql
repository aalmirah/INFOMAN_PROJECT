-- REVIEW ONLY. Do not execute without separate approval.
-- Confirm the project reference in the Supabase dashboard before execution:
-- HOPE-ERP-QA: jlygmihiufrlqxzsfhpf. Database name alone is not proof.
--
-- Reject soft deletion of linked Auth accounts and reject links to already
-- soft-deleted Auth accounts. Existing accounts and privileges are not changed.
-- AFTER triggers inspect the values actually written by all BEFORE triggers.
-- Link changes and Auth soft deletion require READ COMMITTED; a transaction
-- snapshot from REPEATABLE READ or SERIALIZABLE can miss a newly linked row.
-- VOLATILE trigger queries use a fresh snapshot after any Auth row-lock wait.
-- Concurrent writers can deadlock; PostgreSQL aborts a transaction rather than
-- allowing an inconsistent link. Investigate and retry the entire aborted
-- operation only after checking its outcome.
-- The locks block writes to both tables until this transaction ends.
-- On error the transaction must be rolled back. After a successful commit,
-- removing these guards requires separate review and approval because it
-- reopens the link/soft-delete race; do not remove either trigger in isolation.
BEGIN;

LOCK TABLE auth.users IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.app_user IN SHARE ROW EXCLUSIVE MODE;

DO $preflight$
BEGIN
  IF NOT has_schema_privilege(current_user, 'public', 'CREATE')
     OR NOT has_schema_privilege(current_user, 'auth', 'USAGE')
     OR NOT has_table_privilege(current_user, 'auth.users', 'SELECT')
     OR NOT has_table_privilege(current_user, 'auth.users', 'UPDATE')
     OR NOT has_table_privilege(current_user, 'auth.users', 'TRIGGER')
     OR NOT has_table_privilege(current_user, 'public.app_user', 'SELECT')
     OR NOT has_table_privilege(current_user, 'public.app_user', 'UPDATE')
     OR NOT has_table_privilege(current_user, 'public.app_user', 'TRIGGER') THEN
    RAISE EXCEPTION 'Execution role lacks required schema or table privileges';
  END IF;
  IF row_security_active('auth.users'::regclass)
     OR row_security_active('public.app_user'::regclass) THEN
    RAISE EXCEPTION 'Execution role must have complete row visibility';
  END IF;
  IF to_regprocedure('public.dev07_guard_auth_link()') IS NOT NULL
     OR to_regprocedure('public.dev07_guard_auth_soft_delete()') IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE NOT tgisinternal
         AND ((tgrelid = 'auth.users'::regclass AND tgname = 'dev07_guard_auth_soft_delete')
           OR (tgrelid = 'public.app_user'::regclass AND tgname = 'dev07_guard_auth_link'))
     ) THEN
    RAISE EXCEPTION 'A proposed DEV07 guard function or trigger already exists';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.app_user u
    LEFT JOIN auth.users a ON a.id = u.auth_user_id
    WHERE u.auth_user_id IS NOT NULL AND (a.id IS NULL OR a.deleted_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Linked ERP account has a missing or soft-deleted Auth user';
  END IF;
END;
$preflight$;

CREATE FUNCTION public.dev07_guard_auth_link()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
SET row_security = off
AS $function$
DECLARE
  v_deleted_at timestamptz;
BEGIN
  IF NEW.auth_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.auth_user_id IS NOT DISTINCT FROM OLD.auth_user_id THEN
    RETURN NEW;
  END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Auth linking requires READ COMMITTED isolation';
  END IF;

  SELECT a.deleted_at INTO v_deleted_at
  FROM auth.users a WHERE a.id = NEW.auth_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot link a missing Auth user';
  END IF;
  IF v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot link a soft-deleted Auth user';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE FUNCTION public.dev07_guard_auth_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
SET row_security = off
AS $function$
BEGIN
  IF NEW.deleted_at IS NOT NULL
     AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    IF current_setting('transaction_isolation') <> 'read committed' THEN
      RAISE EXCEPTION 'Auth soft deletion requires READ COMMITTED isolation';
    END IF;
    IF EXISTS (SELECT 1 FROM public.app_user u WHERE u.auth_user_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot soft-delete an Auth user linked to an ERP account';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.dev07_guard_auth_link() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.dev07_guard_auth_soft_delete() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER dev07_guard_auth_link
AFTER INSERT OR UPDATE ON public.app_user
FOR EACH ROW EXECUTE FUNCTION public.dev07_guard_auth_link();

CREATE TRIGGER dev07_guard_auth_soft_delete
AFTER UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.dev07_guard_auth_soft_delete();

DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.app_user'::regclass
      AND t.tgname = 'dev07_guard_auth_link'
      AND t.tgfoid = 'public.dev07_guard_auth_link()'::regprocedure
      AND t.tgenabled = 'O' AND t.tgtype = 21
      AND cardinality(t.tgattr::smallint[]) = 0
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'auth.users'::regclass
      AND t.tgname = 'dev07_guard_auth_soft_delete'
      AND t.tgfoid = 'public.dev07_guard_auth_soft_delete()'::regprocedure
      AND t.tgenabled = 'O' AND t.tgtype = 17
      AND cardinality(t.tgattr::smallint[]) = 0
  ) OR EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid IN ('public.dev07_guard_auth_link()'::regprocedure,
                    'public.dev07_guard_auth_soft_delete()'::regprocedure)
      AND p.provolatile <> 'v'
  ) OR EXISTS (
    SELECT 1
    FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) r(role_name)
    WHERE has_function_privilege(r.role_name, 'public.dev07_guard_auth_link()', 'EXECUTE')
       OR has_function_privilege(r.role_name, 'public.dev07_guard_auth_soft_delete()', 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'DEV07 Auth guard verification failed';
  END IF;
END;
$verify$;

COMMIT;
