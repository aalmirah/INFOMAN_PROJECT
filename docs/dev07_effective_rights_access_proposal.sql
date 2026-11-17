-- REVIEW ONLY: do not run without explicit DB Admin approval.
-- This proposal removes direct SELECT access to the all-users rights view from
-- anon, authenticated, and PUBLIC. Removing PUBLIC access may affect other
-- roles that inherit it; identify all consumers and role memberships first.
-- Calls through SECURITY DEFINER functions or other views are not addressed.
-- The server must still authorize each caller before using service_role.

BEGIN;

REVOKE SELECT ON TABLE public.v_user_effective_rights
  FROM PUBLIC, anon, authenticated;

-- Abort the transaction if inherited or column-level grants still expose the
-- view, or if the server's service_role would lose its required access.
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.v_user_effective_rights', 'SELECT')
     OR has_any_column_privilege('anon', 'public.v_user_effective_rights', 'SELECT')
     OR has_table_privilege('authenticated', 'public.v_user_effective_rights', 'SELECT')
     OR has_any_column_privilege('authenticated', 'public.v_user_effective_rights', 'SELECT')
  THEN
    RAISE EXCEPTION 'View remains readable through inherited or column privileges; review grants before proceeding';
  END IF;

  IF NOT has_schema_privilege('service_role', 'public', 'USAGE')
     OR NOT has_table_privilege('service_role', 'public.v_user_effective_rights', 'SELECT')
  THEN
    RAISE EXCEPTION 'service_role cannot read the view; review server dependencies before proceeding';
  END IF;
END;
$$;

COMMIT;
