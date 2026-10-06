-- =============================================================================
-- UMA Market V4 — retire legacy checkout RPC execution
-- Migration: 20261011000000_v4_retire_legacy_checkout_rpc.sql
--
-- FINDING:
--   public.place_order(...) and public.place_checkout_orders(...) are the V2
--   checkout boundary: they authenticate only through auth.jwt()->>'sub' and
--   key carts/orders on the legacy business_clerk_id identity. V4 replaced
--   them with public.place_v4_checkout_orders(uuid, jsonb), which enforces
--   business_members membership, business status/capability, and business_id
--   cart ownership. Both legacy functions were still EXECUTE-granted to
--   PUBLIC, anon, authenticated and service_role, so any client could still
--   run the retired path.
--
-- FIX:
--   Revoke EXECUTE on both legacy functions from every client role.
--   The functions are NOT dropped: their source stays available for audit,
--   rollback comparison, and the static prosrc coverage in
--   scripts/verify-v4-phase1-security.ts (which reads pg_proc only).
--
-- NOT CHANGED:
--   * public.place_v4_checkout_orders — remains the only executable checkout
--     boundary (GRANT to authenticated untouched)
--   * update_order_status and every other RPC
--   * function bodies, triggers, RLS policies, table grants
--
-- VERIFICATION (scripts/verify-v4-checkout-live.ts, section 6):
--   LEG-01 authenticated client → place_checkout_orders  → denied
--   LEG-02 authenticated client → place_order            → denied
--   LEG-03 anonymous client     → place_checkout_orders  → denied
--   (RED before this migration is applied, GREEN after)
-- =============================================================================

REVOKE ALL ON FUNCTION public.place_checkout_orders(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.place_order(text, text, text, text, date, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
