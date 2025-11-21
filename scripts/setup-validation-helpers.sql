-- SQL script to set up helper functions for integration validation
-- This should be run in the Supabase SQL editor or via migration

-- Function to get RLS policies for a table
CREATE OR REPLACE FUNCTION get_table_policies(table_name text)
RETURNS TABLE (
  policy_name text,
  policy_command text,
  policy_permissive text,
  policy_roles text[],
  policy_qual text,
  policy_with_check text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pol.policyname::text,
    pol.cmd::text,
    pol.permissive::text,
    pol.roles,
    pol.qual::text,
    pol.with_check::text
  FROM pg_policy pol
  JOIN pg_class pc ON pol.polrelid = pc.oid
  JOIN pg_namespace pn ON pc.relnamespace = pn.oid
  WHERE pc.relname = table_name
    AND pn.nspname = 'public';
END;
$$;

-- Function to check if RLS is enabled on a table
CREATE OR REPLACE FUNCTION check_rls_enabled(table_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rls_enabled boolean;
BEGIN
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class pc
  JOIN pg_namespace pn ON pc.relnamespace = pn.oid
  WHERE pc.relname = table_name
    AND pn.nspname = 'public';
  
  RETURN COALESCE(rls_enabled, false);
END;
$$;

-- Function to get table statistics for validation
CREATE OR REPLACE FUNCTION get_table_stats(table_name text)
RETURNS TABLE (
  table_name text,
  row_count bigint,
  rls_enabled boolean,
  policy_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  row_cnt bigint;
  rls_status boolean;
  pol_cnt bigint;
BEGIN
  -- Get row count
  EXECUTE format('SELECT COUNT(*) FROM %I', table_name) INTO row_cnt;
  
  -- Check RLS status
  SELECT check_rls_enabled(table_name) INTO rls_status;
  
  -- Get policy count
  SELECT COUNT(*) INTO pol_cnt
  FROM pg_policy pol
  JOIN pg_class pc ON pol.polrelid = pc.oid
  JOIN pg_namespace pn ON pc.relnamespace = pn.oid
  WHERE pc.relname = table_name
    AND pn.nspname = 'public';
  
  RETURN QUERY SELECT table_name, row_cnt, rls_status, pol_cnt;
END;
$$;

-- Function to validate database connectivity
CREATE OR REPLACE FUNCTION validate_db_connection()
RETURNS TABLE (
  status text,
  timestamp timestamptz,
  version text,
  current_user text,
  current_database text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT 
    'connected'::text,
    now(),
    version()::text,
    current_user::text,
    current_database()::text;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_table_policies(text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_rls_enabled(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_stats(text) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_db_connection() TO authenticated;

-- Grant execute permissions to service role for admin operations
GRANT EXECUTE ON FUNCTION get_table_policies(text) TO service_role;
GRANT EXECUTE ON FUNCTION check_rls_enabled(text) TO service_role;
GRANT EXECUTE ON FUNCTION get_table_stats(text) TO service_role;
GRANT EXECUTE ON FUNCTION validate_db_connection() TO service_role;