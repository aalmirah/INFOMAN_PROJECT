-- Disposable, network-isolated test database only; never run on a project.
DO $test$
DECLARE
  v_id constant uuid := '10000000-0000-4000-8000-000000000010';
  v_message text;
BEGIN
  IF current_database() <> 'dev07_provision_test'
     OR current_setting('dev07.synthetic_test', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'This fixture requires the disposable DEV07 provisioning test database';
  END IF;

  UPDATE public.profiles SET first_name = 'Updated', is_blocked = true WHERE id = v_id;
  IF NOT EXISTS (SELECT 1 FROM public.app_user
      WHERE auth_user_id = v_id AND first_name = 'Updated'
        AND is_blocked AND status = 'Inactive') THEN
    RAISE EXCEPTION 'Profile change or blocking was not synchronized';
  END IF;
  UPDATE public.profiles SET is_blocked = false, must_change_password = true WHERE id = v_id;
  IF NOT EXISTS (SELECT 1 FROM public.app_user
      WHERE auth_user_id = v_id AND NOT is_blocked AND must_set_password AND status = 'Inactive') THEN
    RAISE EXCEPTION 'Password-pending status was not synchronized';
  END IF;
  UPDATE public.profiles SET must_change_password = false, approval_status = 'pending' WHERE id = v_id;
  IF (SELECT status FROM public.app_user WHERE auth_user_id = v_id) <> 'Pending' THEN
    RAISE EXCEPTION 'Pending status was not synchronized';
  END IF;
  UPDATE public.profiles SET approval_status = 'rejected' WHERE id = v_id;
  IF (SELECT status FROM public.app_user WHERE auth_user_id = v_id) <> 'Rejected' THEN
    RAISE EXCEPTION 'Rejected status was not synchronized';
  END IF;
  UPDATE public.profiles SET approval_status = 'approved', role = 'admin' WHERE id = v_id;
  IF NOT EXISTS (SELECT 1 FROM public.app_user u JOIN public.role r ON r.role_id = u.role_id
      WHERE u.auth_user_id = v_id AND u.status = 'Active' AND r.name = 'Admin') THEN
    RAISE EXCEPTION 'Profile role change was not synchronized';
  END IF;
  UPDATE public.profiles SET role = 'user' WHERE id = v_id;

  UPDATE public.role SET status = 'Inactive' WHERE name = 'User';
  IF (SELECT status FROM public.app_user WHERE auth_user_id = v_id) <> 'Inactive'
     OR (SELECT status FROM public.app_user
         WHERE auth_user_id = '10000000-0000-4000-8000-000000000002') <> 'Pending' THEN
    RAISE EXCEPTION 'Role deactivation did not preserve lifecycle statuses';
  END IF;
  UPDATE public.role SET status = 'Active' WHERE name = 'User';
  IF (SELECT status FROM public.app_user WHERE auth_user_id = v_id) <> 'Active' THEN
    RAISE EXCEPTION 'Role reactivation was not synchronized';
  END IF;
  BEGIN
    UPDATE public.role SET name = 'Renamed' WHERE name = 'User';
    RAISE EXCEPTION 'Role rename with linked accounts was accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Cannot rename an ERP role used by linked accounts' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.profiles SET first_name = NULL WHERE id = v_id;
    RAISE EXCEPTION 'Incomplete linked profile was accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Linked profile requires first name, last name and email' THEN RAISE; END IF;
  END;
  IF (SELECT first_name FROM public.profiles WHERE id = v_id) <> 'Updated' THEN
    RAISE EXCEPTION 'Invalid profile change was not rolled back';
  END IF;
  BEGIN
    UPDATE public.profiles SET first_name = 'Changed'
      WHERE id = '10000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Mismatched ERP role was accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Linked ERP role does not match the previous profile role' THEN RAISE; END IF;
  END;
END;
$test$;

GRANT SELECT, UPDATE ON public.profiles TO service_role;
SET ROLE service_role;
UPDATE public.profiles SET first_name = 'Service Update'
WHERE id = '10000000-0000-4000-8000-000000000010';
RESET ROLE;

DO $test$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_user
      WHERE auth_user_id = '10000000-0000-4000-8000-000000000010'
        AND first_name = 'Service Update') THEN
    RAISE EXCEPTION 'Profile synchronization failed for service_role';
  END IF;
END;
$test$;
