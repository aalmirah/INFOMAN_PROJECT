-- Disposable, network-isolated test database only; never run on a project.
DO $guard$
BEGIN
  IF current_database() <> 'dev07_provision_test'
     OR current_setting('dev07.synthetic_test', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'This fixture requires the disposable DEV07 provisioning test database';
  END IF;
END;
$guard$;

DO $test$
DECLARE
  v_id uuid;
  v_user_id bigint;
  v_message text;
BEGIN
  FOR v_id IN SELECT id FROM auth.users WHERE id::text LIKE '%000000000001'
  LOOP
    v_user_id := public.dev07_provision_profile(v_id);
    IF v_user_id <> public.dev07_provision_profile(v_id)
       OR (SELECT status FROM public.app_user WHERE user_id = v_user_id) <> 'Active' THEN
      RAISE EXCEPTION 'Eligible provisioning or idempotent retry failed';
    END IF;
  END LOOP;
  PERFORM public.dev07_provision_profile('10000000-0000-4000-8000-000000000002');
  PERFORM public.dev07_provision_profile('10000000-0000-4000-8000-000000000003');
  PERFORM public.dev07_provision_profile('10000000-0000-4000-8000-000000000004');
  IF (SELECT status FROM public.app_user WHERE auth_user_id = '10000000-0000-4000-8000-000000000002') <> 'Pending'
     OR (SELECT status FROM public.app_user WHERE auth_user_id = '10000000-0000-4000-8000-000000000003') <> 'Rejected'
     OR (SELECT status FROM public.app_user WHERE auth_user_id = '10000000-0000-4000-8000-000000000004') <> 'Inactive' THEN
    RAISE EXCEPTION 'Lifecycle mapping failed';
  END IF;

  BEGIN
    PERFORM public.dev07_provision_profile('10000000-0000-4000-8000-000000000005');
    RAISE EXCEPTION 'Incomplete profile was accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Profile data is incomplete' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.dev07_provision_profile('10000000-0000-4000-8000-000000000006');
    RAISE EXCEPTION 'Soft-deleted Auth account was accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Auth account is missing or soft-deleted' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.dev07_provision_profile('10000000-0000-4000-8000-000000000007');
    RAISE EXCEPTION 'Email conflict was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  IF NOT EXISTS (SELECT 1 FROM public.app_user WHERE email = 'legacy@example.invalid' AND auth_user_id IS NULL) THEN
    RAISE EXCEPTION 'Legacy account was incorrectly linked by email';
  END IF;

  UPDATE public.app_user SET role_id = 2 WHERE user_id = v_user_id;
  BEGIN
    PERFORM public.dev07_provision_profile('10000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Mismatched linked account was accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Existing linked ERP account requires separate reconciliation' THEN RAISE; END IF;
  END;
  IF (SELECT role_id FROM public.app_user WHERE user_id = v_user_id) <> 2 THEN
    RAISE EXCEPTION 'Existing role was silently changed';
  END IF;

  BEGIN
    DELETE FROM public.profiles WHERE id = '10000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Linked profile was deleted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    DELETE FROM auth.users WHERE id = '10000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Linked Auth account was deleted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  UPDATE public.role SET status = 'Inactive' WHERE name = 'User';
  BEGIN
    PERFORM public.dev07_provision_profile('10000000-0000-4000-8000-000000000008');
    RAISE EXCEPTION 'Inactive role was accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Mapped ERP role is missing or inactive' THEN RAISE; END IF;
  END;
  UPDATE public.role SET status = 'Active' WHERE name = 'User';
END;
$test$;

GRANT USAGE ON SCHEMA auth, public TO dev07_rls_owner;
GRANT SELECT, UPDATE ON auth.users, public.profiles, public.app_user, public.role TO dev07_rls_owner;
GRANT INSERT ON public.app_user TO dev07_rls_owner;
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
ALTER FUNCTION public.dev07_provision_profile(uuid) OWNER TO dev07_rls_owner;
DO $test$
DECLARE v_message text;
BEGIN
  BEGIN
    PERFORM public.dev07_provision_profile('10000000-0000-4000-8000-000000000008');
    RAISE EXCEPTION 'RLS-filtered function owner was accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Provisioning owner must bypass RLS on all involved tables' THEN RAISE; END IF;
  END;
END;
$test$;
ALTER FUNCTION public.dev07_provision_profile(uuid) OWNER TO postgres;
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;

SELECT 'Synthetic provisioning tests passed' AS result;
