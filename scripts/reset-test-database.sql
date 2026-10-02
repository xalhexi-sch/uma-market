-- =============================================================================
-- UMA Market — Security-test database reset
--
-- Referenced by:
--   scripts/verify-checkout-orders.ts (cleanup failure guidance)
--   docs/security/SECURITY-TEST-ENVIRONMENT.md section 8
--
-- ############################################################################
-- #  SAFETY: THIS SCRIPT IS DESTRUCTIVE. IT TRUNCATES TRANSACTION TABLES.   #
-- #  RUN IT AGAINST THE ISOLATED SECURITY-TEST SUPABASE PROJECT ONLY.        #
-- #  Ref: xckdihprwjdwutglytwu                                             #
-- #  NEVER run it against production (odnpkqjytrmciwmcehff).                 #
-- #                                                                       #
-- #  The guard below is EXECUTABLE SQL, not a comment. It runs inside the   #
-- #  same transaction as the TRUNCATEs and raises before the first one, so  #
-- #  a wrong target aborts the whole batch with nothing truncated.          #
-- #                                                                       #
-- #  Verify the link before executing:                                     #
-- #    npx supabase link --project-ref xckdihprwjdwutglytwu                #
-- #    npx supabase db query --linked -f scripts/reset-test-database.sql   #
-- ############################################################################
-- =============================================================================
--
-- WHY THE GUARD CHECKS TWO THINGS
--
--   1. current_database()
--      VERIFIED against the isolated project:
--        SELECT current_database();  ->  'postgres'
--      Supabase names the database 'postgres' for EVERY project, so the project
--      ref never appears here. The check still runs (a non-Supabase or
--      mis-named target is refused), but on its own it cannot tell the
--      security-test project from production.
--
--   2. pg_control_system().system_identifier
--      This is the cluster's unique identity and is what actually distinguishes
--      'xckdihprwjdwutglytwu' from production. It was recorded read-only from
--      the isolated project:
--        SELECT system_identifier FROM pg_control_system();
--          -> 7678071634733212629
--      If this project is ever rebuilt, refresh the constant with the same
--      read-only query. Until then, any other cluster (including production)
--      raises and the TRUNCATEs never execute — the guard fails closed.
--
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_database        text := current_database();
  v_cluster_id      text;
  -- Isolated security-test project xckdihprwjdwutglytwu — cluster identity.
  v_expected_cluster constant text := '7678071634733212629';
  -- Supabase database name used by every project, including the target one.
  v_expected_database constant text := 'postgres';
BEGIN
  IF v_database IS DISTINCT FROM v_expected_database THEN
    RAISE EXCEPTION
      'reset-test-database: REFUSED. current_database() is %, expected % (project %).',
      v_database, v_expected_database, 'xckdihprwjdwutglytwu';
  END IF;

  SELECT system_identifier::text
    INTO v_cluster_id
    FROM pg_control_system();

  IF v_cluster_id IS DISTINCT FROM v_expected_cluster THEN
    RAISE EXCEPTION
      'reset-test-database: REFUSED. Connected cluster system_identifier is %, expected % — this is NOT the isolated security-test project xckdihprwjdwutglytwu. Nothing was truncated.',
      v_cluster_id, v_expected_cluster;
  END IF;
END $$;

TRUNCATE TABLE public.messages CASCADE;
TRUNCATE TABLE public.cart_items CASCADE;
TRUNCATE TABLE public.order_items CASCADE;
TRUNCATE TABLE public.orders CASCADE;

COMMIT;

-- Catalogue rows (categories, products, profiles) are intentionally preserved
-- so the security-test dataset stays seeded. Re-seed inventory with:
--   npm run seed:demo
