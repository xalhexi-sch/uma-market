-- =============================================================
-- UMA Market — Security Hardening P1 Fixes
-- Migration: 20260924000003_security_hardening_p1.sql
--
-- Fixes:
-- 1. SEC-002: Public farmer profile privacy leak
--    - Drop permissive "profiles: public reads farmer" policy that
--      exposed full profiles (phone, address, etc.) to anon.
--    - Create public_farmer_profiles view exposing only approved
--      non-sensitive public fields (name, city, bio, avatar, verified).
--    - Revoke direct SELECT on public.profiles from anon role.
--
-- 2. SEC-003: Order state-machine bypass through direct UPDATE
--    - Drop "orders: farmer updates status" direct UPDATE policy.
--    - Farmer order state transitions must exclusively execute via
--      the update_order_status() SECURITY DEFINER RPC.
--    - Legitimate buyer pending cancellation policy is preserved.
--
-- 3. SEC-004: Phantom inventory through cancellation cycles
--    - Add BEFORE UPDATE trigger enforcing terminal order statuses
--      ('cancelled' cannot be reopened; 'completed' cannot be altered).
--    - Update stock restitution trigger to only restore stock for
--      pre-fulfillment states ('pending', 'accepted', 'preparing').
--    - Guarantee stock is never restored from 'ready', 'for_delivery',
--      or 'completed' states, preventing inventory inflation.
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. SEC-002: PUBLIC FARMER PROVENANCE PRIVACY
-- ──────────────────────────────────────────────────────────────

-- Drop the overly permissive row-level policy that allowed public/anon
-- to read all columns from public.profiles
DROP POLICY IF EXISTS "profiles: public reads farmer" ON public.profiles;

-- Revoke direct SELECT on the underlying profiles table from anon
REVOKE SELECT ON public.profiles FROM anon;

-- Create a secure view for public marketplace discovery that exposes
-- ONLY safe, non-sensitive farmer provenance columns.
-- Phone numbers, physical addresses, and sensitive fields are omitted.
CREATE OR REPLACE VIEW public.public_farmer_profiles
WITH (security_invoker = false) AS
SELECT
  clerk_id,
  full_name,
  business_name,
  city,
  bio,
  avatar_url,
  is_verified
FROM public.profiles
WHERE role = 'farmer';

-- Grant read-only access to the public view for anonymous and authenticated visitors
GRANT SELECT ON public.public_farmer_profiles TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────
-- 2. SEC-003: RESTRICT DIRECT ORDER UPDATES FOR FARMERS
-- ──────────────────────────────────────────────────────────────

-- Drop the direct UPDATE policy on orders for farmers.
-- Farmers must use public.update_order_status() RPC to enforce the state machine.
DROP POLICY IF EXISTS "orders: farmer updates status" ON public.orders;

-- ──────────────────────────────────────────────────────────────
-- 3. SEC-004: ENFORCE TERMINAL ORDER STATUSES & SAFE STOCK RESTITUTION
-- ──────────────────────────────────────────────────────────────

-- 3a. Enforce terminal order states at the database engine level
CREATE OR REPLACE FUNCTION public.trigger_enforce_order_terminal_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Cancelled is a terminal state. Once cancelled, an order can never be reopened or updated.
  IF OLD.status = 'cancelled' AND NEW.status IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'Order % is cancelled and cannot be reopened or updated', OLD.id;
  END IF;

  -- Completed is a terminal state. Once completed, an order cannot be transitioned to cancelled or any other status.
  IF OLD.status = 'completed' AND NEW.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'Order % is completed and cannot be transitioned to %', OLD.id, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_terminal_status ON public.orders;
CREATE TRIGGER trg_enforce_order_terminal_status
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_enforce_order_terminal_status();

-- 3b. Update stock restitution function:
-- Restore stock ONLY when transitioning to 'cancelled' from pre-fulfillment states ('pending', 'accepted', 'preparing').
-- NEVER restore stock from post-preparation/fulfillment states ('ready', 'for_delivery', 'completed').
CREATE OR REPLACE FUNCTION public.trigger_restore_stock_on_order_cancelled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IN ('pending', 'accepted', 'preparing') THEN
    FOR v_item IN
      SELECT product_id, quantity
      FROM public.order_items
      WHERE order_id = NEW.id
    LOOP
      UPDATE public.products
      SET quantity_available = quantity_available + v_item.quantity,
          updated_at = NOW()
      WHERE id = v_item.product_id;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger with updated WHEN guard
DROP TRIGGER IF EXISTS trg_restore_stock_on_cancelled ON public.orders;
CREATE TRIGGER trg_restore_stock_on_cancelled
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IN ('pending', 'accepted', 'preparing'))
  EXECUTE FUNCTION public.trigger_restore_stock_on_order_cancelled();
