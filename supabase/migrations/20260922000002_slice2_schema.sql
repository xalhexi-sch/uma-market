-- =============================================================
-- UMA Market — Slice 2 Schema Extensions
-- Migration: 20260922000002_slice2_schema
--
-- Adds columns needed by the business purchase flow and farmer
-- product management. Also adds FK constraints for PostgREST
-- joins, and two SECURITY DEFINER RPCs for atomic operations:
--   place_order()      — creates order + items + decrements stock
--   update_order_status() — enforces valid status transitions
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- profiles: add business_name
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_name TEXT;

-- ──────────────────────────────────────────────────────────────
-- products: add harvest dates
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS harvest_date   DATE,
  ADD COLUMN IF NOT EXISTS available_until DATE;

-- ──────────────────────────────────────────────────────────────
-- orders: add delivery + status timestamp columns
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_address     TEXT,
  ADD COLUMN IF NOT EXISTS pickup_date          DATE,
  ADD COLUMN IF NOT EXISTS accepted_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason  TEXT;

-- ──────────────────────────────────────────────────────────────
-- order_items: add price/name snapshots
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS unit         TEXT;

-- ──────────────────────────────────────────────────────────────
-- FK constraints — enable PostgREST auto-joins
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.products
  ADD CONSTRAINT products_farmer_clerk_id_fkey
  FOREIGN KEY (farmer_clerk_id) REFERENCES public.profiles(clerk_id)
  ON DELETE RESTRICT;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_business_clerk_id_fkey
  FOREIGN KEY (business_clerk_id) REFERENCES public.profiles(clerk_id)
  ON DELETE RESTRICT,
  ADD CONSTRAINT orders_farmer_clerk_id_fkey
  FOREIGN KEY (farmer_clerk_id) REFERENCES public.profiles(clerk_id)
  ON DELETE RESTRICT;

-- ──────────────────────────────────────────────────────────────
-- RPC: place_order
-- Atomically: validates → creates order + items → decrements
-- stock → clears cart. Runs as SECURITY DEFINER so it can
-- update product quantities (owned by farmers).
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.place_order(
  p_farmer_clerk_id  TEXT,
  p_fulfillment_type TEXT,
  p_delivery_address TEXT DEFAULT NULL,
  p_notes            TEXT DEFAULT NULL,
  p_pickup_date      DATE DEFAULT NULL,
  p_items            JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   TEXT;
  v_order_id    UUID;
  v_item        JSONB;
  v_product     RECORD;
  v_total       NUMERIC(10,2) := 0;
  v_qty         NUMERIC(10,2);
BEGIN
  -- Identity & role check
  v_caller_id := auth.jwt()->>'sub';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF (auth.jwt()->>'user_role') IS DISTINCT FROM 'business' THEN
    RAISE EXCEPTION 'Only business users can place orders';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;

  -- Validate each product and compute total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::NUMERIC;

    SELECT id, name, unit, price_per_unit, quantity_available,
           status, min_order_quantity, farmer_clerk_id
    INTO   v_product
    FROM   public.products
    WHERE  id = (v_item->>'product_id')::UUID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_item->>'product_id';
    END IF;
    IF v_product.farmer_clerk_id IS DISTINCT FROM p_farmer_clerk_id THEN
      RAISE EXCEPTION 'Product % does not belong to the specified farmer', v_product.name;
    END IF;
    IF v_product.status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'Product % is not available for ordering', v_product.name;
    END IF;
    IF v_qty < v_product.min_order_quantity THEN
      RAISE EXCEPTION 'Minimum order for "%" is % %',
        v_product.name, v_product.min_order_quantity, v_product.unit;
    END IF;
    IF v_qty > v_product.quantity_available THEN
      RAISE EXCEPTION 'Insufficient stock for "%" — available: % %',
        v_product.name, v_product.quantity_available, v_product.unit;
    END IF;

    v_total := v_total + v_qty * v_product.price_per_unit;
  END LOOP;

  -- Create order
  INSERT INTO public.orders (
    business_clerk_id, farmer_clerk_id, fulfillment_type,
    delivery_address, notes, pickup_date, total_amount, status
  ) VALUES (
    v_caller_id, p_farmer_clerk_id, p_fulfillment_type,
    p_delivery_address, p_notes, p_pickup_date, v_total, 'pending'
  ) RETURNING id INTO v_order_id;

  -- Create items + decrement stock + clear cart
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::NUMERIC;

    SELECT id, name, unit, price_per_unit
    INTO   v_product
    FROM   public.products
    WHERE  id = (v_item->>'product_id')::UUID;

    INSERT INTO public.order_items (
      order_id, product_id, quantity, unit_price, product_name, unit
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      v_qty,
      v_product.price_per_unit,   -- price snapshot
      v_product.name,             -- name snapshot
      v_product.unit              -- unit snapshot
    );

    UPDATE public.products
    SET    quantity_available = quantity_available - v_qty,
           updated_at = NOW()
    WHERE  id = (v_item->>'product_id')::UUID;

    DELETE FROM public.cart_items
    WHERE  business_clerk_id = v_caller_id
      AND  product_id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN jsonb_build_object('order_id', v_order_id);
END;
$$;

-- Grant execute to authenticated users (RLS inside the function handles authz)
GRANT EXECUTE ON FUNCTION public.place_order TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- RPC: update_order_status
-- Farmers only. Enforces valid state-machine transitions.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id         UUID,
  p_new_status       TEXT,
  p_cancellation_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id TEXT;
  v_order     RECORD;
  v_now       TIMESTAMPTZ := NOW();
BEGIN
  v_caller_id := auth.jwt()->>'sub';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF (auth.jwt()->>'user_role') IS DISTINCT FROM 'farmer' THEN
    RAISE EXCEPTION 'Only farmers can update order status';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.farmer_clerk_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'Not authorized to update this order';
  END IF;

  -- Validate state-machine transitions
  CASE v_order.status
    WHEN 'pending' THEN
      IF p_new_status NOT IN ('accepted', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition: pending → %', p_new_status;
      END IF;
    WHEN 'accepted' THEN
      IF p_new_status IS DISTINCT FROM 'preparing' THEN
        RAISE EXCEPTION 'Invalid transition: accepted → %', p_new_status;
      END IF;
    WHEN 'preparing' THEN
      IF p_new_status IS DISTINCT FROM 'ready' THEN
        RAISE EXCEPTION 'Invalid transition: preparing → %', p_new_status;
      END IF;
    WHEN 'ready' THEN
      IF p_new_status NOT IN ('for_delivery', 'completed') THEN
        RAISE EXCEPTION 'Invalid transition: ready → %', p_new_status;
      END IF;
    WHEN 'for_delivery' THEN
      IF p_new_status IS DISTINCT FROM 'completed' THEN
        RAISE EXCEPTION 'Invalid transition: for_delivery → %', p_new_status;
      END IF;
    ELSE
      RAISE EXCEPTION 'Order in terminal status % cannot be updated', v_order.status;
  END CASE;

  UPDATE public.orders
  SET
    status               = p_new_status,
    accepted_at          = CASE WHEN p_new_status = 'accepted'    THEN v_now ELSE accepted_at    END,
    completed_at         = CASE WHEN p_new_status = 'completed'   THEN v_now ELSE completed_at   END,
    cancelled_at         = CASE WHEN p_new_status = 'cancelled'   THEN v_now ELSE cancelled_at   END,
    cancellation_reason  = CASE WHEN p_new_status = 'cancelled'   THEN p_cancellation_reason ELSE cancellation_reason END,
    updated_at           = v_now
  WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_order_status TO authenticated;
