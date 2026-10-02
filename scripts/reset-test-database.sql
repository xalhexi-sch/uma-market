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
-- #  Verify the link before executing:                                     #
-- #    npx supabase link --project-ref xckdihprwjdwutglytwu                #
-- #    npx supabase db query --linked -f scripts/reset-test-database.sql   #
-- ############################################################################
-- =============================================================================

BEGIN;

TRUNCATE TABLE public.messages CASCADE;
TRUNCATE TABLE public.cart_items CASCADE;
TRUNCATE TABLE public.order_items CASCADE;
TRUNCATE TABLE public.orders CASCADE;

COMMIT;

-- Catalogue rows (categories, products, profiles) are intentionally preserved
-- so the security-test dataset stays seeded. Re-seed inventory with:
--   npm run seed:demo