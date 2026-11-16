-- Disposable, network-isolated test database only; never run on a project.
DO $test$
DECLARE
  v_message text;
BEGIN
  IF current_database() <> 'dev07_provision_test'
     OR current_setting('dev07.synthetic_test', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'This fixture requires the disposable DEV07 provisioning test database';
  END IF;
  BEGIN
    UPDATE auth.users SET deleted_at = now()
    WHERE id = '10000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Linked Auth account was soft-deleted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Cannot soft-delete an Auth user linked to an ERP account' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.app_user
      (auth_user_id, first_name, last_name, email, role_id, status, is_blocked, must_set_password)
    VALUES ('10000000-0000-4000-8000-000000000006', 'Test', 'User',
      'deleted@example.invalid', 1, 'Active', false, false);
    RAISE EXCEPTION 'Soft-deleted Auth account was linked';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Cannot link a soft-deleted Auth user' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.app_user SET auth_user_id = '10000000-0000-4000-8000-000000000006'
    WHERE email = 'legacy@example.invalid';
    RAISE EXCEPTION 'Soft-deleted Auth account was linked through UPDATE';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Cannot link a soft-deleted Auth user' THEN RAISE; END IF;
  END;
  UPDATE auth.users SET deleted_at = now()
  WHERE id = '10000000-0000-4000-8000-000000000008';
  DELETE FROM auth.users WHERE id = '10000000-0000-4000-8000-000000000008';
  IF has_function_privilege('anon', 'public.dev07_guard_auth_link()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.dev07_guard_auth_link()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.dev07_guard_auth_link()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.dev07_guard_auth_soft_delete()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.dev07_guard_auth_soft_delete()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.dev07_guard_auth_soft_delete()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Guard functions have unexpected EXECUTE privileges';
  END IF;
END;
$test$;

CREATE FUNCTION public.dev07_test_mutate_auth_link() RETURNS trigger
LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.email IN ('legacy@example.invalid', 'trigger-insert@example.invalid') THEN
    NEW.auth_user_id := '10000000-0000-4000-8000-000000000006';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER z_dev07_test_mutate_auth_link
BEFORE INSERT OR UPDATE ON public.app_user
FOR EACH ROW EXECUTE FUNCTION public.dev07_test_mutate_auth_link();

CREATE FUNCTION public.dev07_test_mutate_auth_deleted_at() RETURNS trigger
LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.id = '10000000-0000-4000-8000-000000000001' THEN
    NEW.deleted_at := now();
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER z_dev07_test_mutate_auth_deleted_at
BEFORE UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.dev07_test_mutate_auth_deleted_at();

DO $test$
DECLARE v_message text;
BEGIN
  BEGIN
    UPDATE auth.users SET id = id
    WHERE id = '10000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'A BEFORE trigger bypassed the soft-delete guard';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Cannot soft-delete an Auth user linked to an ERP account' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.app_user SET email = email WHERE email = 'legacy@example.invalid';
    RAISE EXCEPTION 'A BEFORE trigger bypassed the UPDATE link guard';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Cannot link a soft-deleted Auth user' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.app_user
      (first_name, last_name, email, role_id, status, is_blocked, must_set_password)
    VALUES ('Test', 'User', 'trigger-insert@example.invalid', 1, 'Active', false, false);
    RAISE EXCEPTION 'A BEFORE trigger bypassed the INSERT link guard';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Cannot link a soft-deleted Auth user' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM auth.users
      WHERE id = '10000000-0000-4000-8000-000000000001' AND deleted_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.app_user WHERE email = 'legacy@example.invalid'
       AND auth_user_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.app_user WHERE email = 'trigger-insert@example.invalid') THEN
    RAISE EXCEPTION 'A rejected trigger mutation was not rolled back';
  END IF;
END;
$test$;

DROP TRIGGER z_dev07_test_mutate_auth_link ON public.app_user;
DROP FUNCTION public.dev07_test_mutate_auth_link();
DROP TRIGGER z_dev07_test_mutate_auth_deleted_at ON auth.users;
DROP FUNCTION public.dev07_test_mutate_auth_deleted_at();

INSERT INTO auth.users (id) VALUES
  ('10000000-0000-4000-8000-000000000010'),
  ('10000000-0000-4000-8000-000000000011'),
  ('10000000-0000-4000-8000-000000000012'),
  ('10000000-0000-4000-8000-000000000013');
INSERT INTO public.profiles
SELECT id, 'Test', 'User', id::text || '@example.invalid', 'user', 'approved',
  true, false, false
FROM auth.users
WHERE id IN ('10000000-0000-4000-8000-000000000010',
             '10000000-0000-4000-8000-000000000011',
             '10000000-0000-4000-8000-000000000012',
             '10000000-0000-4000-8000-000000000013');
INSERT INTO public.app_user
  (first_name, last_name, email, role_id, status, is_blocked, must_set_password)
VALUES ('Test', 'User', 'race-update-12@example.invalid', 1, 'Active', false, false),
       ('Test', 'User', 'race-update-13@example.invalid', 1, 'Active', false, false);
