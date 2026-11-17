\set ON_ERROR_STOP on
-- Disposable, network-isolated test database only; never run on a project.
DO $guard$
BEGIN
  IF current_database() <> 'dev07_synthetic_test'
     OR current_setting('dev07.synthetic_test', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'This fixture requires the disposable DEV07 synthetic test database';
  END IF;
END;
$guard$;

DO $test$
DECLARE
  v_actor constant uuid := '11111111-1111-4111-8111-111111111111';
  v_target constant uuid := '22222222-2222-4222-8222-222222222222';
  v_admin constant uuid := '33333333-3333-4333-8333-333333333333';
  v_all bigint[] := ARRAY(SELECT generate_series(1, 36)::bigint);
  v_result integer;
  v_message text;
BEGIN
  v_result := public.dev07_save_user_permissions(v_actor, v_target, v_all, ARRAY[1]::bigint[], ARRAY[2,3]::bigint[]);
  IF v_result <> 3
     OR (SELECT status FROM public.user_permission WHERE user_id = 20 AND right_id = 1) IS DISTINCT FROM 'Inactive'
     OR (SELECT status FROM public.user_permission WHERE user_id = 20 AND right_id = 2) IS DISTINCT FROM 'Active'
     OR (SELECT status FROM public.user_permission WHERE user_id = 20 AND right_id = 3) IS DISTINCT FROM 'Active'
     OR (SELECT count(*) FROM public.audit_log) <> 3
     OR (SELECT count(*) FROM public.audit_log WHERE table_name = 'user_permission'
       AND action_by = '10' AND action_at IS NOT NULL AND (
         (record_key = '20|1' AND action = 'EDIT' AND new_values->>'permission_change' = 'REVOKE')
         OR (record_key = '20|2' AND action = 'RESTORE' AND new_values->>'permission_change' = 'GRANT')
         OR (record_key = '20|3' AND action = 'ADD' AND new_values->>'permission_change' = 'GRANT')
       )) <> 3 THEN
    RAISE EXCEPTION 'Grant, revoke, restoration, or audit failed';
  END IF;

  v_result := public.dev07_save_user_permissions(v_actor, v_target, v_all, ARRAY[2,3]::bigint[], ARRAY[2,3]::bigint[]);
  IF v_result <> 0 OR (SELECT count(*) FROM public.audit_log) <> 3 THEN
    RAISE EXCEPTION 'Unchanged permissions were modified or audited';
  END IF;

  UPDATE public.app_user SET must_set_password = true WHERE user_id IN (10, 20);
  v_result := public.dev07_save_user_permissions(v_actor, v_target, v_all, ARRAY[2,3]::bigint[], ARRAY[2,3]::bigint[]);
  IF v_result <> 0 THEN
    RAISE EXCEPTION 'ERP password flags changed rights authorization';
  END IF;
  UPDATE public.app_user SET must_set_password = false WHERE user_id IN (10, 20);

  BEGIN
    PERFORM public.dev07_save_user_permissions(v_actor, v_target, v_all, ARRAY[1]::bigint[], ARRAY[2]::bigint[]);
    RAISE EXCEPTION 'Stale selection was accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Permissions changed; reload before saving' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.dev07_save_user_permissions(v_actor, v_admin, v_all, ARRAY[]::bigint[], ARRAY[1]::bigint[]);
    RAISE EXCEPTION 'Admin could manage an Admin';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Admins may manage only User rights' THEN RAISE; END IF;
  END;

  UPDATE public.profiles SET is_blocked = NULL WHERE id = v_actor;
  BEGIN
    PERFORM public.dev07_save_user_permissions(v_actor, v_target, v_all, ARRAY[2,3]::bigint[], ARRAY[2]::bigint[]);
    RAISE EXCEPTION 'Actor with null eligibility was accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Actor is not eligible to manage rights' THEN RAISE; END IF;
  END;
  UPDATE public.profiles SET is_blocked = false WHERE id = v_actor;

  UPDATE public.profiles SET must_change_password = NULL WHERE id = v_target;
  BEGIN
    PERFORM public.dev07_save_user_permissions(v_actor, v_target, v_all, ARRAY[2,3]::bigint[], ARRAY[2]::bigint[]);
    RAISE EXCEPTION 'Target with null eligibility was accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Target is not eligible for editable rights' THEN RAISE; END IF;
  END;
  UPDATE public.profiles SET must_change_password = false WHERE id = v_target;

  UPDATE public.rights SET module_id = 1 WHERE right_id = 4;
  BEGIN
    PERFORM public.dev07_save_user_permissions(v_actor, v_target, v_all, ARRAY[2,3]::bigint[], ARRAY[2]::bigint[]);
    RAISE EXCEPTION 'Misplaced catalogue right was accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Rights catalogue changed; reload before saving' THEN RAISE; END IF;
  END;
  UPDATE public.rights SET module_id = 2 WHERE right_id = 4;

  ALTER TABLE public.audit_log ADD CONSTRAINT reject_revoke_audits CHECK (action <> 'EDIT') NOT VALID;
  BEGIN
    PERFORM public.dev07_save_user_permissions(v_actor, v_target, v_all, ARRAY[2,3]::bigint[], ARRAY[1,2]::bigint[]);
    RAISE EXCEPTION 'Failed audit was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF (SELECT status FROM public.user_permission WHERE user_id = 20 AND right_id = 1) IS DISTINCT FROM 'Inactive'
     OR (SELECT status FROM public.user_permission WHERE user_id = 20 AND right_id = 3) IS DISTINCT FROM 'Active'
     OR (SELECT count(*) FROM public.audit_log) <> 3 THEN
    RAISE EXCEPTION 'Permission change was not rolled back with failed audit';
  END IF;
  ALTER TABLE public.audit_log DROP CONSTRAINT reject_revoke_audits;
END;
$test$;

GRANT SELECT, UPDATE ON public.profiles, public.app_user, public.role TO dev07_rls_owner;
GRANT SELECT ON public.module, public.rights, public.user_permission TO dev07_rls_owner;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER FUNCTION public.dev07_save_user_permissions(uuid, uuid, bigint[], bigint[], bigint[]) OWNER TO dev07_rls_owner;
DO $test$
BEGIN
  BEGIN
    PERFORM public.dev07_save_user_permissions(
      '11111111-1111-4111-8111-111111111111'::uuid,
      '22222222-2222-4222-8222-222222222222'::uuid,
      ARRAY(SELECT generate_series(1, 36)::bigint), ARRAY[2,3]::bigint[], ARRAY[2]::bigint[]
    );
    RAISE EXCEPTION 'RLS-filtered function owner was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$test$;

SELECT 'Synthetic PostgreSQL tests passed' AS result;
