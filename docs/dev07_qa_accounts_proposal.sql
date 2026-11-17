-- REVIEW ONLY. Do not execute without separate approval and isolated testing.
-- Intended only for HOPE-ERP-QA, project reference jlygmihiufrlqxzsfhpf.
-- Verify the project in the dashboard. The project string below is a manual
-- confirmation, not technical proof of the connected project.
--
-- Before execution, create four NEW synthetic Auth users through an approved
-- QA-only Auth workflow. Each must have a confirmed email and a usable
-- password. Record their Auth UUIDs and enter them below in the intended role
-- order after independently verifying each identity and its QA-only purpose.
-- The confirmation flag is manual, not proof that an identity is synthetic.
-- Do not match identities by email or put passwords or service keys here.
--
-- This transaction approves those four pending profiles, assigns the listed
-- QA roles, and inserts four NEW linked ERP accounts. It refuses to modify
-- existing ERP accounts. The Auth users themselves are not created here.
-- No permissions are granted and no DEV06 policies or triggers are changed.
-- The table locks block writes until this transaction ends.

BEGIN;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

DO $setup$
DECLARE
  v_confirmed_project_ref text := 'REPLACE_AFTER_MANUAL_VERIFICATION';
  v_confirmed_qa_only boolean := false;
  v_auth_ids uuid[] := ARRAY[NULL, NULL, NULL, NULL]::uuid[];
  v_profile_roles text[] := ARRAY['superadmin', 'admin', 'admin', 'user'];
  v_erp_roles text[] := ARRAY['Superadmin', 'Admin', 'Admin', 'User'];
  v_last_names text[] := ARRAY['Superadmin', 'AdminOne', 'AdminTwo', 'User'];
  v_role_id bigint;
  v_email text;
  v_count integer;
  i integer;
BEGIN
  IF v_confirmed_project_ref <> 'jlygmihiufrlqxzsfhpf' THEN
    RAISE EXCEPTION 'Manually verify the HOPE-ERP-QA project reference first';
  END IF;
  IF NOT v_confirmed_qa_only THEN
    RAISE EXCEPTION 'Manually verify that all four identities are QA-only first';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_auth_ids) AS id WHERE id IS NULL)
     OR (SELECT count(DISTINCT id) FROM unnest(v_auth_ids) AS id) <> 4 THEN
    RAISE EXCEPTION 'Supply four distinct, manually verified synthetic Auth UUIDs';
  END IF;

  LOCK TABLE auth.users, public.profiles, public.app_user, public.role
    IN SHARE ROW EXCLUSIVE MODE;
  IF pg_catalog.row_security_active('auth.users'::regclass)
     OR pg_catalog.row_security_active('public.profiles'::regclass)
     OR pg_catalog.row_security_active('public.app_user'::regclass)
     OR pg_catalog.row_security_active('public.role'::regclass) THEN
    RAISE EXCEPTION 'Execution role must have complete row visibility';
  END IF;

  FOR i IN 1..4 LOOP
    SELECT count(*) INTO v_count
    FROM auth.users a JOIN public.profiles p ON p.id = a.id
    WHERE a.id = v_auth_ids[i]
      AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until <= now())
      AND a.email_confirmed_at IS NOT NULL
      AND a.encrypted_password IS NOT NULL AND a.encrypted_password <> ''
      AND a.email IS NOT NULL AND a.email <> ''
      AND lower(p.email) = lower(a.email)
      AND p.role = 'user' AND p.approval_status = 'pending'
      AND p.is_active = true AND p.is_blocked = false
      AND p.must_change_password = false;
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'Auth user % is not a new eligible synthetic QA profile', i;
    END IF;

    SELECT count(*) INTO v_count
    FROM public.role r WHERE r.name = v_erp_roles[i] AND r.status = 'Active';
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'Expected exactly one active ERP role for fixture %', i;
    END IF;

    SELECT lower(a.email) INTO v_email FROM auth.users a WHERE a.id = v_auth_ids[i];
    IF EXISTS (
      SELECT 1 FROM public.app_user u
      WHERE u.auth_user_id = v_auth_ids[i] OR lower(u.email) = v_email
    ) THEN
      RAISE EXCEPTION 'Existing ERP account conflicts with fixture %', i;
    END IF;
  END LOOP;

  FOR i IN 1..4 LOOP
    SELECT r.role_id INTO STRICT v_role_id
    FROM public.role r WHERE r.name = v_erp_roles[i] AND r.status = 'Active';
    SELECT lower(a.email) INTO STRICT v_email FROM auth.users a WHERE a.id = v_auth_ids[i];

    UPDATE public.profiles
    SET first_name = 'DEV07 QA', last_name = v_last_names[i],
        role = v_profile_roles[i], approval_status = 'approved'
    WHERE id = v_auth_ids[i];

    INSERT INTO public.app_user
      (auth_user_id, first_name, last_name, email, role_id, status, is_blocked)
    VALUES (v_auth_ids[i], 'DEV07 QA', v_last_names[i], v_email, v_role_id, 'Active', false);
  END LOOP;

  SELECT count(*) INTO v_count
  FROM generate_subscripts(v_auth_ids, 1) AS fixture(idx)
  JOIN auth.users a ON a.id = v_auth_ids[fixture.idx]
  JOIN public.profiles p ON p.id = a.id
  JOIN public.app_user u ON u.auth_user_id = p.id
  JOIN public.role r ON r.role_id = u.role_id
  WHERE p.role = v_profile_roles[fixture.idx] AND p.approval_status = 'approved'
    AND p.is_active = true AND p.is_blocked = false AND p.must_change_password = false
    AND u.status = 'Active' AND u.is_blocked = false
    AND r.name = v_erp_roles[fixture.idx] AND r.status = 'Active';
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'QA fixture verification failed';
  END IF;
END;
$setup$;

COMMIT;
