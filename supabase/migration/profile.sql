-- DEV02: create a public.profiles row when a new Supabase Auth user is created.
-- Expected profile columns:
--   id, first_name, last_name, email, role, approval_status, created_at
-- This does not recreate or use the old users/userrights/rights tables.
--
-- Run health_check.sql first. Review any existing auth.users triggers before
-- running this script; another failing trigger can still block Auth signup.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  first_name text CHECK (char_length(btrim(first_name)) BETWEEN 1 AND 80),
  last_name text CHECK (char_length(btrim(last_name)) BETWEEN 1 AND 80),
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'user'
    CHECK (role IN ('superadmin', 'admin', 'user')),
  approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ALTER COLUMN first_name DROP NOT NULL,
  ALTER COLUMN last_name DROP NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_first_name_check,
  DROP CONSTRAINT IF EXISTS profiles_last_name_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_first_name_check
    CHECK (
      first_name IS NULL
      OR char_length(btrim(first_name)) BETWEEN 1 AND 80
    ),
  ADD CONSTRAINT profiles_last_name_check
    CHECK (
      last_name IS NULL
      OR char_length(btrim(last_name)) BETWEEN 1 AND 80
    );

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can read their own profile'
  ) THEN
    EXECUTE '
      CREATE POLICY "Users can read their own profile"
        ON public.profiles
        FOR SELECT
        TO authenticated
        USING ((SELECT auth.uid()) = id)
    ';
  END IF;
END;
$policy$;

CREATE OR REPLACE FUNCTION public.create_app_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  user_metadata jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  full_name text;
  first_name text;
  last_name text;
BEGIN
  full_name := COALESCE(
    NULLIF(pg_catalog.btrim(user_metadata ->> 'full_name'), ''),
    NULLIF(pg_catalog.btrim(user_metadata ->> 'name'), '')
  );

  first_name := COALESCE(
    NULLIF(pg_catalog.btrim(user_metadata ->> 'first_name'), ''),
    NULLIF(pg_catalog.btrim(user_metadata ->> 'given_name'), ''),
    NULLIF(pg_catalog.split_part(full_name, ' ', 1), '')
  );

  last_name := COALESCE(
    NULLIF(pg_catalog.btrim(user_metadata ->> 'last_name'), ''),
    NULLIF(pg_catalog.btrim(user_metadata ->> 'family_name'), ''),
    NULLIF(
      pg_catalog.btrim(
        pg_catalog.regexp_replace(COALESCE(full_name, ''), '^\S+\s*', '')
      ),
      ''
    )
  );

  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    role,
    approval_status,
    created_at
  )
  VALUES (
    NEW.id,
    first_name,
    last_name,
    NEW.email,
    'user',
    'pending',
    pg_catalog.now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'auth.users'::pg_catalog.regclass
      AND tgname = 'hope_create_profile_on_auth_user_created'
      AND NOT tgisinternal
  ) THEN
    EXECUTE '
      CREATE TRIGGER hope_create_profile_on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.create_app_user()
    ';
  END IF;
END;
$block$;
