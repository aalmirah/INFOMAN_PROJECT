-- Disposable, network-isolated test database only; never run on a project.
DO $guard$
BEGIN
  IF current_database() <> 'dev07_provision_test'
     OR current_setting('dev07.synthetic_test', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'This fixture requires the disposable DEV07 provisioning test database';
  END IF;
END;
$guard$;

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
INSERT INTO public.module VALUES
  (1, 'CUSTOMER', 'Active'), (2, 'PRODUCT', 'Active'),
  (3, 'HR', 'Active'), (4, 'SALES', 'Active'), (5, 'REPORTS', 'Active');
INSERT INTO public.rights
SELECT n, CASE WHEN n <= 3 THEN 1 WHEN n <= 9 THEN 2 WHEN n <= 22 THEN 3
  WHEN n <= 29 THEN 4 ELSE 5 END, 'Active'
FROM generate_series(1, 36) AS n;

INSERT INTO auth.users (id) VALUES ('10000000-0000-4000-8000-000000000014');
INSERT INTO public.profiles
VALUES ('10000000-0000-4000-8000-000000000014', 'Test', 'Admin',
  'sync-admin@example.invalid', 'admin', 'approved', true, false, false);
SELECT public.dev07_provision_profile('10000000-0000-4000-8000-000000000014');
