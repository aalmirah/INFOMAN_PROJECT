-- Read-only inspection for the DEV02 Auth-to-profile setup.
-- Run this first in the Supabase SQL Editor. It does not change the database.

SELECT
  'profiles_columns' AS check_name,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'column', column_name,
        'type', data_type,
        'nullable', is_nullable,
        'default', column_default
      )
      ORDER BY ordinal_position
    ),
    '[]'::jsonb
  ) AS details
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'

UNION ALL

SELECT
  'profiles_foreign_keys',
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'constraint', conname,
        'definition', pg_get_constraintdef(oid)
      )
    ),
    '[]'::jsonb
  )
FROM pg_constraint
WHERE conrelid = to_regclass('public.profiles')
  AND contype = 'f'

UNION ALL

SELECT
  'profiles_constraints',
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'constraint', conname,
        'type', contype,
        'definition', pg_get_constraintdef(oid)
      )
    ),
    '[]'::jsonb
  )
FROM pg_constraint
WHERE conrelid = to_regclass('public.profiles')

UNION ALL

SELECT
  'profiles_rls',
  jsonb_build_object(
    'table_exists', COALESCE(c.oid IS NOT NULL, FALSE),
    'enabled', COALESCE(c.relrowsecurity, FALSE),
    'forced', COALESCE(c.relforcerowsecurity, FALSE)
  )
FROM (SELECT to_regclass('public.profiles') AS oid) AS t
LEFT JOIN pg_class AS c ON c.oid = t.oid

UNION ALL

SELECT
  'profiles_policies',
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', policyname,
        'command', cmd,
        'roles', roles,
        'using', qual,
        'with_check', with_check
      )
    ),
    '[]'::jsonb
  )
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'

UNION ALL

SELECT
  'auth_users_triggers',
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', trigger_name,
        'enabled', tgenabled,
        'function', trigger_function,
        'function_definition', function_definition
      )
    ),
    '[]'::jsonb
  )
FROM (
  SELECT
    t.tgname AS trigger_name,
    t.tgenabled,
    t.tgfoid::regprocedure::text AS trigger_function,
    pg_get_functiondef(t.tgfoid) AS function_definition
  FROM pg_trigger AS t
  WHERE t.tgrelid = to_regclass('auth.users')
    AND NOT t.tgisinternal
) AS auth_triggers

UNION ALL

SELECT
  'database_code_references_to_legacy_access_tables',
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'kind', object_kind,
        'name', object_name
      )
    ),
    '[]'::jsonb
  )
FROM (
  SELECT
    'function' AS object_kind,
    n.nspname || '.' || p.proname AS object_name
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE p.prokind = 'f'
    AND (
      p.prosrc ~* '(^|[^a-z_])userrights([^a-z_]|$)'
      OR p.prosrc ~* '(^|[^a-z_])rights([^a-z_]|$)'
      OR p.prosrc ~* '(^|[^a-z_.])users([^a-z_]|$)'
      OR p.prosrc ~* 'public[.]users([^a-z_]|$)'
    )

  UNION ALL

  SELECT
    'policy',
    schemaname || '.' || tablename || '.' || policyname
  FROM pg_policies
  WHERE COALESCE(qual, '') ~* '(^|[^a-z_])(userrights|rights)([^a-z_]|$)'
     OR COALESCE(with_check, '') ~* '(^|[^a-z_])(userrights|rights)([^a-z_]|$)'
     OR COALESCE(qual, '') ~* '(^|[^a-z_.])users([^a-z_]|$)'
     OR COALESCE(with_check, '') ~* '(^|[^a-z_.])users([^a-z_]|$)'
     OR COALESCE(qual, '') ~* 'public[.]users([^a-z_]|$)'
     OR COALESCE(with_check, '') ~* 'public[.]users([^a-z_]|$)'
) AS legacy_references;
