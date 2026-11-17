-- REVIEW ONLY. Do not execute without separate approval and isolated testing.
-- The updated RPC definition was applied to MAIN (project reference
-- ijfucrcvvuwqdfwiqtzh). Do not execute this proposal on MAIN again.
-- HOPE-ERP-QA (project reference jlygmihiufrlqxzsfhpf) has an earlier RPC
-- version. Review and separate approval are required before installing the
-- updated definition there. Before QA execution, manually verify the project
-- reference in the Supabase dashboard. Database name alone is not proof.
-- This manual check does not technically prevent execution on another project.
-- The verified server must authenticate the caller before passing its UUID.
-- anon and authenticated must not execute this SECURITY DEFINER function.
-- Its owner and other privileged roles may also be able to execute it.
-- CREATE FUNCTION assigns ownership to the installer. Preflight and post-create
-- checks require that owner to have the exact access, table ownership for locks,
-- and RLS bypass needed here; runtime checks fail closed if RLS changes later.
-- Actor and target must already have linked ERP accounts with matching roles.
-- Acquire the shared advisory lock (174545, 7) before any table or row locks,
-- matching the profile-sync and provisioning proposals. The user_permission
-- table lock also serializes ordinary permission DML from non-cooperating
-- writers. The complete live write-guard definition was not supplied; review
-- any trigger-side locks before execution.
-- Lock order: advisory -> module/rights/user_permission tables -> profiles ->
-- app_user -> role rows.
-- Saving requires READ COMMITTED for fresh visibility after lock waits.
-- Only active rights in the five verified DEV07 modules are editable.
-- This transaction changes privileges only on the newly created function.
-- It does not prevent other privileged paths from bypassing this operation.
-- Isolated QA must test null eligibility values, each module count, concurrent
-- changes, inactive permission restoration, audit failure rollback, and RLS.

BEGIN;

SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

DO $preflight$
DECLARE
  v_owner oid;
  v_is_superuser boolean;
BEGIN
  SELECT oid, rolsuper INTO v_owner, v_is_superuser
  FROM pg_catalog.pg_roles
  WHERE rolname = current_user;

  IF v_owner IS NULL
     OR NOT pg_catalog.has_schema_privilege(current_user, 'public', 'USAGE')
     OR NOT pg_catalog.has_schema_privilege(current_user, 'public', 'CREATE') THEN
    RAISE EXCEPTION 'Installer must have public schema USAGE and CREATE privileges';
  END IF;

  IF NOT v_is_superuser AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS c
    WHERE c.oid IN (
      'public.module'::pg_catalog.regclass,
      'public.rights'::pg_catalog.regclass,
      'public.user_permission'::pg_catalog.regclass
    )
      AND c.relowner <> v_owner
  ) THEN
    RAISE EXCEPTION 'Function owner must own tables that the RPC locks';
  END IF;

  IF NOT pg_catalog.has_table_privilege(current_user, 'public.profiles', 'SELECT')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.profiles', 'UPDATE')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.app_user', 'SELECT')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.app_user', 'UPDATE')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.role', 'SELECT')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.role', 'UPDATE')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.module', 'SELECT')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.rights', 'SELECT')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.user_permission', 'SELECT')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.user_permission', 'INSERT')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.user_permission', 'UPDATE')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.audit_log', 'INSERT') THEN
    RAISE EXCEPTION 'Function owner lacks required table privileges';
  END IF;

  IF pg_catalog.row_security_active('public.profiles'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.app_user'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.role'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.module'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.rights'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.user_permission'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.audit_log'::pg_catalog.regclass) THEN
    RAISE EXCEPTION 'Function owner must bypass RLS on every table it uses';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_log'
      AND column_name = 'audit_id' AND data_type = 'bigint'
      AND is_nullable = 'NO' AND is_identity = 'YES'
      AND identity_generation = 'ALWAYS'
  ) THEN
    RAISE EXCEPTION 'audit_log.audit_id must be GENERATED ALWAYS AS IDENTITY';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('table_name', 30, 'NO'),
      ('action', 7, 'NO'),
      ('record_key', 60, 'YES'),
      ('action_by', 50, 'NO')
    ) AS expected(column_name, max_length, nullable)
    LEFT JOIN information_schema.columns AS actual
      ON actual.table_schema = 'public'
     AND actual.table_name = 'audit_log'
     AND actual.column_name = expected.column_name
    WHERE actual.column_name IS NULL
       OR actual.data_type <> 'character varying'
       OR actual.character_maximum_length <> expected.max_length
       OR actual.is_nullable <> expected.nullable
  ) THEN
    RAISE EXCEPTION 'audit_log column types or limits differ from verified MAIN schema';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_log'
      AND column_name = 'action_at'
      AND data_type = 'timestamp with time zone'
      AND is_nullable = 'NO' AND column_default = 'now()'
  ) THEN
    RAISE EXCEPTION 'audit_log.action_at must be NOT NULL with a now() default';
  END IF;
END;
$preflight$;

CREATE FUNCTION public.dev07_save_user_permissions(
  p_actor_auth_id uuid,
  p_target_auth_id uuid,
  p_catalogue bigint[],
  p_expected bigint[],
  p_selected bigint[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $function$
DECLARE
  v_actor_profile public.profiles%ROWTYPE;
  v_target_profile public.profiles%ROWTYPE;
  v_actor public.app_user%ROWTYPE;
  v_target public.app_user%ROWTYPE;
  v_actor_role public.role%ROWTYPE;
  v_target_role public.role%ROWTYPE;
  v_old public.user_permission%ROWTYPE;
  v_new public.user_permission%ROWTYPE;
  v_catalogue bigint[];
  v_expected bigint[];
  v_selected bigint[];
  v_current bigint[];
  v_right_id bigint;
  v_action text;
  v_change text;
  v_record_key text;
  v_old_values jsonb;
  v_changes integer := 0;
BEGIN
  IF p_actor_auth_id IS NULL OR p_target_auth_id IS NULL
     OR p_catalogue IS NULL OR p_expected IS NULL OR p_selected IS NULL THEN
    RAISE EXCEPTION 'Actor, target, catalogue, expected and selected rights are required';
  END IF;
  IF p_actor_auth_id = p_target_auth_id THEN
    RAISE EXCEPTION 'Actors cannot manage their own rights';
  END IF;
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Rights saving requires READ COMMITTED isolation';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(174545, 7);

  IF pg_catalog.row_security_active('public.profiles'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.app_user'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.role'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.module'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.rights'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.user_permission'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.audit_log'::pg_catalog.regclass) THEN
    RAISE EXCEPTION 'Function owner no longer bypasses RLS on every table it uses';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_catalog.unnest(p_catalogue) AS x(id) WHERE x.id IS NULL)
     OR EXISTS (SELECT 1 FROM pg_catalog.unnest(p_expected) AS x(id) WHERE x.id IS NULL)
     OR EXISTS (SELECT 1 FROM pg_catalog.unnest(p_selected) AS x(id) WHERE x.id IS NULL) THEN
    RAISE EXCEPTION 'Rights lists cannot contain null values';
  END IF;

  SELECT COALESCE(pg_catalog.array_agg(DISTINCT id ORDER BY id), ARRAY[]::bigint[])
    INTO v_catalogue FROM pg_catalog.unnest(p_catalogue) AS x(id);
  SELECT COALESCE(pg_catalog.array_agg(DISTINCT id ORDER BY id), ARRAY[]::bigint[])
    INTO v_expected FROM pg_catalog.unnest(p_expected) AS x(id);
  SELECT COALESCE(pg_catalog.array_agg(DISTINCT id ORDER BY id), ARRAY[]::bigint[])
    INTO v_selected FROM pg_catalog.unnest(p_selected) AS x(id);

  IF pg_catalog.cardinality(p_catalogue) <> pg_catalog.cardinality(v_catalogue)
     OR pg_catalog.cardinality(p_expected) <> pg_catalog.cardinality(v_expected)
     OR pg_catalog.cardinality(p_selected) <> pg_catalog.cardinality(v_selected) THEN
    RAISE EXCEPTION 'Rights lists cannot contain duplicates';
  END IF;

  LOCK TABLE public.module, public.rights IN SHARE MODE;
  LOCK TABLE public.user_permission IN SHARE ROW EXCLUSIVE MODE;

  PERFORM p.id FROM public.profiles AS p
    WHERE p.id IN (p_actor_auth_id, p_target_auth_id)
    ORDER BY p.id FOR UPDATE;
  SELECT * INTO v_actor_profile FROM public.profiles WHERE id = p_actor_auth_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Actor profile not found'; END IF;
  SELECT * INTO v_target_profile FROM public.profiles WHERE id = p_target_auth_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target profile not found'; END IF;

  PERFORM u.user_id FROM public.app_user AS u
    WHERE u.auth_user_id IN (p_actor_auth_id, p_target_auth_id)
    ORDER BY u.user_id FOR UPDATE;
  SELECT * INTO v_actor FROM public.app_user WHERE auth_user_id = p_actor_auth_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Actor ERP account is not linked'; END IF;
  SELECT * INTO v_target FROM public.app_user WHERE auth_user_id = p_target_auth_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target ERP account is not linked'; END IF;

  PERFORM r.role_id FROM public.role AS r
    WHERE r.role_id IN (v_actor.role_id, v_target.role_id)
    ORDER BY r.role_id FOR SHARE;
  SELECT * INTO v_actor_role FROM public.role WHERE role_id = v_actor.role_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Actor ERP role not found'; END IF;
  SELECT * INTO v_target_role FROM public.role WHERE role_id = v_target.role_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target ERP role not found'; END IF;

  IF v_actor_profile.approval_status IS DISTINCT FROM 'approved'
     OR v_actor_profile.is_active IS DISTINCT FROM true
     OR v_actor_profile.is_blocked IS DISTINCT FROM false
     OR v_actor_profile.must_change_password IS DISTINCT FROM false
     OR v_actor_profile.role IS NULL
     OR v_actor_profile.role NOT IN ('admin', 'superadmin')
     OR v_actor.status IS DISTINCT FROM 'Active'
     OR v_actor.is_blocked IS DISTINCT FROM false
     OR v_actor_role.status IS DISTINCT FROM 'Active'
     OR pg_catalog.lower(v_actor_role.name) IS DISTINCT FROM v_actor_profile.role THEN
    RAISE EXCEPTION 'Actor is not eligible to manage rights';
  END IF;

  IF v_target_profile.approval_status IS DISTINCT FROM 'approved'
     OR v_target_profile.is_active IS DISTINCT FROM true
     OR v_target_profile.is_blocked IS DISTINCT FROM false
     OR v_target_profile.must_change_password IS DISTINCT FROM false
     OR v_target_profile.role IS NULL
     OR v_target_profile.role NOT IN ('user', 'admin')
     OR v_target.status IS DISTINCT FROM 'Active'
     OR v_target.is_blocked IS DISTINCT FROM false
     OR v_target_role.status IS DISTINCT FROM 'Active'
     OR pg_catalog.lower(v_target_role.name) IS DISTINCT FROM v_target_profile.role THEN
    RAISE EXCEPTION 'Target is not eligible for editable rights';
  END IF;

  IF v_actor_profile.role = 'admin' AND v_target_profile.role <> 'user' THEN
    RAISE EXCEPTION 'Admins may manage only User rights';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('CUSTOMER', 3), ('PRODUCT', 6), ('HR', 13), ('SALES', 7), ('REPORTS', 7)
    ) AS expected(code, right_count)
    LEFT JOIN public.module AS m ON m.code = expected.code AND m.status = 'Active'
    LEFT JOIN public.rights AS r ON r.module_id = m.module_id AND r.status = 'Active'
    GROUP BY expected.code, expected.right_count
    HAVING pg_catalog.count(DISTINCT m.module_id) <> 1
      OR pg_catalog.count(r.right_id) <> expected.right_count
  ) THEN
    RAISE EXCEPTION 'Rights catalogue changed; reload before saving';
  END IF;

  SELECT COALESCE(pg_catalog.array_agg(r.right_id ORDER BY r.right_id), ARRAY[]::bigint[])
    INTO v_current
    FROM public.rights AS r
    JOIN public.module AS m ON m.module_id = r.module_id
    WHERE r.status = 'Active' AND m.status = 'Active'
      AND m.code IN ('CUSTOMER', 'PRODUCT', 'HR', 'SALES', 'REPORTS');
  IF v_current IS DISTINCT FROM v_catalogue THEN
    RAISE EXCEPTION 'Rights catalogue changed; reload before saving';
  END IF;
  IF pg_catalog.cardinality(v_catalogue) = 0 THEN
    RAISE EXCEPTION 'Rights catalogue is empty';
  END IF;
  IF NOT v_selected <@ v_catalogue OR NOT v_expected <@ v_catalogue THEN
    RAISE EXCEPTION 'Rights list includes an unavailable right';
  END IF;

  SELECT COALESCE(pg_catalog.array_agg(up.right_id ORDER BY up.right_id), ARRAY[]::bigint[])
    INTO v_current
    FROM public.user_permission AS up
    WHERE up.user_id = v_target.user_id
      AND up.status = 'Active'
      AND up.right_id = ANY(v_catalogue);
  IF v_current IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'Permissions changed; reload before saving';
  END IF;

  PERFORM pg_catalog.set_config('app.actor_user_id', v_actor.user_id::text, true);

  FOR v_right_id IN
    SELECT id FROM pg_catalog.unnest(v_catalogue) AS x(id)
    WHERE (id = ANY(v_current)) IS DISTINCT FROM (id = ANY(v_selected))
    ORDER BY id
  LOOP
    SELECT * INTO v_old
      FROM public.user_permission
      WHERE user_id = v_target.user_id AND right_id = v_right_id;

    IF v_right_id = ANY(v_selected) THEN
      v_change := 'GRANT';
      IF FOUND THEN
        v_old_values := pg_catalog.to_jsonb(v_old);
        UPDATE public.user_permission SET status = 'Active'
          WHERE user_id = v_target.user_id AND right_id = v_right_id
          RETURNING * INTO v_new;
        v_action := 'RESTORE';
      ELSE
        v_old_values := NULL;
        INSERT INTO public.user_permission (user_id, right_id, granted_by, status)
          VALUES (v_target.user_id, v_right_id, v_actor.user_id, 'Active')
          RETURNING * INTO v_new;
        v_action := 'ADD';
      END IF;
    ELSE
      IF NOT FOUND THEN RAISE EXCEPTION 'Permission to revoke was not found'; END IF;
      v_change := 'REVOKE';
      v_old_values := pg_catalog.to_jsonb(v_old);
      UPDATE public.user_permission SET status = 'Inactive'
        WHERE user_id = v_target.user_id AND right_id = v_right_id
        RETURNING * INTO v_new;
      v_action := 'EDIT';
    END IF;

    v_record_key := v_target.user_id::text || '|' || v_right_id::text;
    IF pg_catalog.char_length('user_permission') > 30
       OR pg_catalog.char_length(v_action) > 7
       OR pg_catalog.char_length(v_record_key) > 60
       OR pg_catalog.char_length(v_actor.user_id::text) > 50 THEN
      RAISE EXCEPTION 'Rights audit values exceed verified audit_log column limits';
    END IF;

    INSERT INTO public.audit_log
      (table_name, action, record_key, old_values, new_values, action_by)
    VALUES (
      'user_permission', v_action,
      v_record_key,
      v_old_values,
      pg_catalog.to_jsonb(v_new) || pg_catalog.jsonb_build_object('permission_change', v_change),
      v_actor.user_id::text
    );
    v_changes := v_changes + 1;
  END LOOP;

  RETURN v_changes;
END;
$function$;

DO $owner_check$
DECLARE
  v_installer oid;
  v_function_owner oid;
  v_security_definer boolean;
BEGIN
  SELECT oid INTO v_installer
  FROM pg_catalog.pg_roles
  WHERE rolname = current_user;

  SELECT proowner, prosecdef
    INTO v_function_owner, v_security_definer
  FROM pg_catalog.pg_proc
  WHERE oid = 'public.dev07_save_user_permissions(uuid,uuid,bigint[],bigint[],bigint[])'
    ::pg_catalog.regprocedure;

  IF v_function_owner IS DISTINCT FROM v_installer
     OR v_security_definer IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Rights RPC owner or SECURITY DEFINER setting is unexpected';
  END IF;

  IF NOT pg_catalog.has_table_privilege(current_user, 'public.profiles', 'SELECT')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.profiles', 'UPDATE')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.app_user', 'SELECT')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.app_user', 'UPDATE')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.role', 'SELECT')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.role', 'UPDATE')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.module', 'SELECT')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.rights', 'SELECT')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.user_permission', 'SELECT')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.user_permission', 'INSERT')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.user_permission', 'UPDATE')
     OR NOT pg_catalog.has_table_privilege(current_user, 'public.audit_log', 'INSERT')
     OR pg_catalog.row_security_active('public.profiles'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.app_user'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.role'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.module'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.rights'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.user_permission'::pg_catalog.regclass)
     OR pg_catalog.row_security_active('public.audit_log'::pg_catalog.regclass) THEN
    RAISE EXCEPTION 'Function owner lacks required table privileges or RLS bypass';
  END IF;
END;
$owner_check$;

REVOKE ALL ON FUNCTION public.dev07_save_user_permissions(uuid, uuid, bigint[], bigint[], bigint[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dev07_save_user_permissions(uuid, uuid, bigint[], bigint[], bigint[])
  TO service_role;

DO $check$
BEGIN
  IF pg_catalog.has_function_privilege(
       'anon', 'public.dev07_save_user_permissions(uuid,uuid,bigint[],bigint[],bigint[])', 'EXECUTE')
     OR pg_catalog.has_function_privilege(
       'authenticated', 'public.dev07_save_user_permissions(uuid,uuid,bigint[],bigint[],bigint[])', 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege(
       'service_role', 'public.dev07_save_user_permissions(uuid,uuid,bigint[],bigint[],bigint[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected function EXECUTE privileges';
  END IF;
END;
$check$;

COMMIT;
