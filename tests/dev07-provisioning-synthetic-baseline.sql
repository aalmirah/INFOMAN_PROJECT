-- Disposable, network-isolated test database only; never run on a project.
DO $guard$
BEGIN
  IF current_database() <> 'dev07_provision_test'
     OR current_setting('dev07.synthetic_test', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'This fixture requires the disposable DEV07 provisioning test database';
  END IF;
END;
$guard$;

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, deleted_at timestamptz);
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text, last_name text, email text, role text, approval_status text,
  is_active boolean, is_blocked boolean, must_change_password boolean
);
CREATE TABLE public.role (role_id bigint PRIMARY KEY, name text UNIQUE, status text);
CREATE TABLE public.app_user (
  user_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  first_name text NOT NULL, last_name text NOT NULL, email text NOT NULL,
  role_id bigint NOT NULL REFERENCES public.role(role_id), status text NOT NULL,
  is_blocked boolean NOT NULL, must_set_password boolean NOT NULL,
  CONSTRAINT dev07_app_user_profile_fkey FOREIGN KEY (auth_user_id)
    REFERENCES public.profiles(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE UNIQUE INDEX app_user_email_lower_uidx ON public.app_user (lower(email));
INSERT INTO public.role VALUES (1, 'User', 'Active'), (2, 'Admin', 'Active'), (3, 'Superadmin', 'Active');
INSERT INTO auth.users (id)
SELECT ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
FROM generate_series(1, 9) AS n;
INSERT INTO public.profiles
SELECT id, 'Test', 'User', id::text || '@example.invalid', 'user', 'approved',
  true, false, false
FROM auth.users;
UPDATE public.profiles SET approval_status = 'pending'
  WHERE id = '10000000-0000-4000-8000-000000000002';
UPDATE public.profiles SET approval_status = 'rejected'
  WHERE id = '10000000-0000-4000-8000-000000000003';
UPDATE public.profiles SET must_change_password = true
  WHERE id = '10000000-0000-4000-8000-000000000004';
UPDATE public.profiles SET first_name = NULL
  WHERE id = '10000000-0000-4000-8000-000000000005';
UPDATE auth.users SET deleted_at = now()
  WHERE id = '10000000-0000-4000-8000-000000000006';
UPDATE public.profiles SET email = 'legacy@example.invalid'
  WHERE id = '10000000-0000-4000-8000-000000000007';
INSERT INTO public.app_user (first_name, last_name, email, role_id, status, is_blocked, must_set_password)
VALUES ('Legacy', 'User', 'legacy@example.invalid', 1, 'Inactive', false, true);
