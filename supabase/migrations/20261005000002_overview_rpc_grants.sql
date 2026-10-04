-- =============================================================
-- UMA Market — Overview RPC grant tightening
-- Migration: 20261005000002_overview_rpc_grants.sql
--
-- Forward-only correction to 20261005000001_overview_dashboard_aggregation.sql,
-- which revoked EXECUTE from PUBLIC only. Supabase's default privileges grant
-- EXECUTE on new functions to anon and service_role as well, so the intended
-- "authenticated sessions only" grant did not actually hold.
--
-- The JWT guards inside both functions already return 42501 before any row is
-- read when auth.jwt()->>'sub' is NULL or the role claim mismatches, so this
-- is defence in depth rather than a fix for a data leak — it makes the
-- privilege layer match the documented model: dashboards are authenticated
-- sessions, nothing else can invoke these functions.
-- =============================================================

REVOKE ALL ON FUNCTION public.get_farmer_overview_metrics(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.get_business_overview_metrics(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ)
  FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.get_farmer_overview_metrics(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_overview_metrics(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;
