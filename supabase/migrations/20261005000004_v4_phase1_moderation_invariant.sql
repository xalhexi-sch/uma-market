-- =============================================================
-- UMA Market — V4 Phase 1: Moderation invariant
-- Migration: 20261005000004_v4_phase1_moderation_invariant.sql
--
-- Follow-up to 20261005000003 (SEC-MOD-001).
--
-- Problem: moderation_status was enforced only by the
-- "products: read active" RLS policy. SECURITY DEFINER functions
-- bypass RLS and filter on status = 'active' alone:
--   - search_products()           → moderated products still searchable
--   - place_checkout_orders()     → moderated products still purchasable
--   - place_order()               → moderated products still purchasable
--
-- Fix: a row-level invariant. A product may only be status='active'
-- when moderation_status='approved'. Every existing status='active'
-- filter (RLS, search, checkout) therefore excludes moderated products
-- without rewriting those functions.
--
-- Admin moderation flow: set moderation_status to 'flagged'/'suspended'
-- AND move status off 'active' (e.g. 'archived') in the same UPDATE.
-- On approval, admin sets moderation_status='approved'; the producer may
-- then reactivate.
-- =============================================================

-- Defensive: bring any pre-existing inconsistent rows into compliance
-- before adding the constraint (idempotent; no-op on clean data).
UPDATE public.products
SET    status = 'archived'
WHERE  status = 'active'
  AND  moderation_status <> 'approved';

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_active_requires_approval;

ALTER TABLE public.products
  ADD CONSTRAINT products_active_requires_approval
  CHECK (status <> 'active' OR moderation_status = 'approved');
