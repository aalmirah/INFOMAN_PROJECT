-- Disposable, network-isolated test database only; never run on a project.
DO $guard$
BEGIN
  IF current_database() <> 'dev07_synthetic_test'
     OR current_setting('dev07.synthetic_test', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'This fixture requires the disposable DEV07 synthetic test database';
  END IF;
END;
$guard$;

CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE ROLE dev07_rls_owner;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY, role text, approval_status text, is_active boolean,
  is_blocked boolean, must_change_password boolean
);
CREATE TABLE public.role (role_id bigint PRIMARY KEY, name text, status text);
CREATE TABLE public.app_user (
  user_id bigint PRIMARY KEY, auth_user_id uuid UNIQUE, role_id bigint,
  status text, is_blocked boolean, must_set_password boolean
);
CREATE TABLE public.module (module_id bigint PRIMARY KEY, code text, status text);
CREATE TABLE public.rights (right_id bigint PRIMARY KEY, module_id bigint, status text);
CREATE TABLE public.user_permission (
  user_id bigint, right_id bigint, granted_by bigint,
  status text, PRIMARY KEY (user_id, right_id)
);
CREATE TABLE public.audit_log (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name text, action text, record_key text, old_values jsonb,
  new_values jsonb, action_by text, action_at timestamptz DEFAULT now()
);

INSERT INTO public.role VALUES
  (1, 'Admin', 'Active'), (2, 'User', 'Active'), (3, 'Superadmin', 'Active');
INSERT INTO public.profiles VALUES
  ('11111111-1111-4111-8111-111111111111', 'admin', 'approved', true, false, false),
  ('22222222-2222-4222-8222-222222222222', 'user', 'approved', true, false, false),
  ('33333333-3333-4333-8333-333333333333', 'admin', 'approved', true, false, false);
INSERT INTO public.app_user VALUES
  (10, '11111111-1111-4111-8111-111111111111', 1, 'Active', false, false),
  (20, '22222222-2222-4222-8222-222222222222', 2, 'Active', false, false),
  (30, '33333333-3333-4333-8333-333333333333', 1, 'Active', false, false);
INSERT INTO public.module VALUES
  (1, 'CUSTOMER', 'Active'), (2, 'PRODUCT', 'Active'),
  (3, 'HR', 'Active'), (4, 'SALES', 'Active'), (5, 'REPORTS', 'Active');
INSERT INTO public.rights
SELECT n, CASE WHEN n <= 3 THEN 1 WHEN n <= 9 THEN 2 WHEN n <= 22 THEN 3
  WHEN n <= 29 THEN 4 ELSE 5 END, 'Active'
FROM generate_series(1, 36) AS n;
INSERT INTO public.user_permission VALUES (20, 1, 10, 'Active'), (20, 2, 10, 'Inactive');
