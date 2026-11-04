-- Replace the existing public.handle_new_auth_user() function.
-- Keep the existing auth.users trigger named on_auth_user_created.
-- Do not create a second auth.users trigger.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
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
  IF NEW.email IS NULL OR pg_catalog.btrim(NEW.email) = '' THEN
    RAISE EXCEPTION 'Cannot create profile without an Auth user email.';
  END IF;

  full_name := COALESCE(
    NULLIF(pg_catalog.btrim(user_metadata ->> 'full_name'), ''),
    NULLIF(pg_catalog.btrim(user_metadata ->> 'name'), '')
  );

  first_name := COALESCE(
    NULLIF(pg_catalog.btrim(user_metadata ->> 'first_name'), ''),
    NULLIF(pg_catalog.btrim(user_metadata ->> 'given_name'), ''),
    NULLIF(pg_catalog.split_part(COALESCE(full_name, ''), ' ', 1), '')
  );

  last_name := COALESCE(
    NULLIF(pg_catalog.btrim(user_metadata ->> 'last_name'), ''),
    NULLIF(pg_catalog.btrim(user_metadata ->> 'family_name'), ''),
    NULLIF(
      pg_catalog.btrim(
        pg_catalog.regexp_replace(COALESCE(full_name, ''), '^[^ ]+[ ]*', '')
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
