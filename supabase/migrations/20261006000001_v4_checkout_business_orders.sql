-- =============================================================================
-- UMA Market V4 — Checkout Business Orders Migration
-- Migration: 20261006000001_v4_checkout_business_orders.sql
--
-- Changes:
-- 1. Additive columns on orders: business_id, placed_by_user_id
-- 2. New V4 checkout RPC: place_v4_checkout_orders
--    - Consumes cart items by business_id (not business_clerk_id)
--    - Validates business membership + can_buy in-RPC
--    - Writes business_id + placed_by_user_id on orders
--    - Preserves deterministic product locking (product_id ASC)
--    - Preserves atomic all-or-nothing transaction
--    - Preserves seller status check, MOQ, stock, moderation
--    - Cart item locking prevents concurrent shared-cart double-checkout
-- 3. Legacy place_checkout_orders / place_order remain unchanged
-- =============================================================================

-- ── 1. Additive columns on orders ───────────────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id),
  ADD COLUMN IF NOT EXISTS placed_by_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_business_id ON public.orders (business_id);

COMMENT ON COLUMN public.orders.business_id IS 'V4: buyer business that placed the order';
COMMENT ON COLUMN public.orders.placed_by_user_id IS 'V4: clerk user_id of the member who placed the order (audit trail)';

-- ── 2. V4 checkout RPC ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.place_v4_checkout_orders(
  p_business_id UUID,
  p_orders      JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id       TEXT;
  v_caller_status   TEXT;
  v_seller_status   TEXT;
  v_membership      RECORD;
  v_business        RECORD;
  v_order_group     JSONB;
  v_farmer_id       TEXT;
  v_fulfillment     TEXT;
  v_address         TEXT;
  v_notes           TEXT;
  v_pickup_date     DATE;
  v_items           JSONB;
  v_item            JSONB;
  v_product         RECORD;
  v_cart_item       RECORD;
  v_qty             NUMERIC(10,2);
  v_total           NUMERIC(10,2);
  v_order_id        UUID;
  v_order_ids       UUID[] := ARRAY[]::UUID[];
  v_rows_deleted    INT;
BEGIN
  -- ── 1. Identity check ─────────────────────────────────────────────────────
  v_caller_id := auth.jwt()->>'sub';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- ── 2. Business membership check ─────────────────────────────────────────
  SELECT bm.id, bm.role
  INTO   v_membership
  FROM   public.business_members bm
  WHERE  bm.business_id = p_business_id
    AND  bm.user_id = v_caller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of the specified business';
  END IF;

  -- ── 3. Business status + capability check ─────────────────────────────────
  SELECT b.id, b.status, b.can_buy, b.legacy_clerk_id
  INTO   v_business
  FROM   public.businesses b
  WHERE  b.id = p_business_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  IF v_business.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Business is % and cannot place orders', v_business.status;
  END IF;

  IF v_business.can_buy IS NOT TRUE THEN
    RAISE EXCEPTION 'This business does not have buying capability';
  END IF;

  -- ── 4. Caller profile status check ────────────────────────────────────────
  SELECT status INTO v_caller_status
  FROM public.profiles
  WHERE clerk_id = v_caller_id;

  IF v_caller_status IS NOT NULL AND v_caller_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Account is % and cannot place orders', v_caller_status;
  END IF;

  IF jsonb_array_length(p_orders) = 0 THEN
    RAISE EXCEPTION 'Checkout must contain at least one order';
  END IF;

  -- ── 5. Pre-validate & lock all cart items by business_id ──────────────────
  FOR v_order_group IN SELECT * FROM jsonb_array_elements(p_orders)
  LOOP
    v_items := v_order_group->'items';
    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
      RAISE EXCEPTION 'Order group must contain at least one item';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
      v_qty := (v_item->>'quantity')::NUMERIC;
      IF v_qty IS NULL OR v_qty <= 0 THEN
        RAISE EXCEPTION 'Item quantity must be greater than zero';
      END IF;

      -- Lock cart item by business_id (V4 path)
      SELECT ci.id, ci.quantity
      INTO   v_cart_item
      FROM   public.cart_items ci
      WHERE  ci.business_id = p_business_id
        AND  ci.product_id = (v_item->>'product_id')::UUID
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Cart item for product "%" was not found or has already been checked out.',
          COALESCE((SELECT name FROM public.products WHERE id = (v_item->>'product_id')::UUID), v_item->>'product_id');
      END IF;

      IF v_qty > v_cart_item.quantity THEN
        RAISE EXCEPTION 'Requested quantity (%) exceeds quantity in cart (%).', v_qty, v_cart_item.quantity;
      END IF;
    END LOOP;
  END LOOP;

  -- ── 6. Process each producer order atomically ─────────────────────────────
  FOR v_order_group IN SELECT * FROM jsonb_array_elements(p_orders)
  LOOP
    v_farmer_id   := v_order_group->>'farmer_clerk_id';
    v_fulfillment := v_order_group->>'fulfillment_type';
    v_address     := v_order_group->>'delivery_address';
    v_notes       := v_order_group->>'notes';
    v_pickup_date := (v_order_group->>'pickup_date')::DATE;
    v_items       := v_order_group->'items';
    v_total       := 0;

    IF v_farmer_id IS NULL THEN
      RAISE EXCEPTION 'Farmer ID is required for each order group';
    END IF;

    IF v_fulfillment IS NULL OR v_fulfillment NOT IN ('pickup', 'seller_delivery') THEN
      RAISE EXCEPTION 'Invalid fulfillment type: %', v_fulfillment;
    END IF;

    -- Seller status check (SEC-SELL-001)
    SELECT status INTO v_seller_status
    FROM public.profiles
    WHERE clerk_id = v_farmer_id;

    IF v_seller_status IS NOT NULL AND v_seller_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'Seller account is % and cannot accept orders', v_seller_status;
    END IF;

    -- Pickup date validation
    IF v_fulfillment = 'pickup' THEN
      IF v_pickup_date IS NULL THEN
        RAISE EXCEPTION 'Pickup date is required for pickup orders';
      END IF;
      IF v_pickup_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::DATE THEN
        RAISE EXCEPTION 'Pickup date cannot be in the past';
      END IF;
    ELSIF v_fulfillment = 'seller_delivery' THEN
      v_pickup_date := NULL;
    END IF;

    -- Product validation + deterministic locking (product_id ASC)
    FOR v_item IN
      SELECT elem.val
      FROM jsonb_array_elements(v_items) AS elem(val)
      ORDER BY (elem.val->>'product_id')::UUID ASC
    LOOP
      v_qty := (v_item->>'quantity')::NUMERIC;

      SELECT id, name, unit, price_per_unit, quantity_available,
             status, min_order_quantity, farmer_clerk_id
      INTO   v_product
      FROM   public.products
      WHERE  id = (v_item->>'product_id')::UUID
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found: %', v_item->>'product_id';
      END IF;
      IF v_product.farmer_clerk_id IS DISTINCT FROM v_farmer_id THEN
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

    -- Create the order with V4 business context
    INSERT INTO public.orders (
      business_clerk_id, farmer_clerk_id, fulfillment_type,
      delivery_address, notes, pickup_date, total_amount, status,
      business_id, placed_by_user_id
    ) VALUES (
      COALESCE(v_business.legacy_clerk_id, v_caller_id),
      v_farmer_id, v_fulfillment,
      v_address, v_notes, v_pickup_date, v_total, 'pending',
      p_business_id, v_caller_id
    ) RETURNING id INTO v_order_id;

    -- Create items + decrement stock + clear cart (by business_id)
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
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
        v_product.price_per_unit,
        v_product.name,
        v_product.unit
      );

      UPDATE public.products
      SET    quantity_available = quantity_available - v_qty,
             updated_at = NOW()
      WHERE  id = (v_item->>'product_id')::UUID;

      -- Delete by business_id (V4), not business_clerk_id
      DELETE FROM public.cart_items
      WHERE  business_id = p_business_id
        AND  product_id = (v_item->>'product_id')::UUID;

      GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
      IF v_rows_deleted = 0 THEN
        RAISE EXCEPTION 'Cart item for product "%" was already checked out or removed.', v_product.name;
      END IF;
    END LOOP;

    v_order_ids := array_append(v_order_ids, v_order_id);
  END LOOP;

  RETURN jsonb_build_object('order_ids', to_jsonb(v_order_ids));
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.place_v4_checkout_orders(UUID, JSONB) TO authenticated;

-- ── 3. Orders & Order Items RLS for V4 business members ──────────────────────

DROP POLICY IF EXISTS "orders: business reads own" ON public.orders;

CREATE POLICY "orders: business reads own"
  ON public.orders FOR SELECT
  USING (
    auth.jwt()->>'sub' = business_clerk_id
    OR (
      business_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.business_members bm
        WHERE bm.business_id = orders.business_id
          AND bm.user_id = (auth.jwt()->>'sub')
      )
    )
  );

DROP POLICY IF EXISTS "order_items: business reads own" ON public.order_items;

CREATE POLICY "order_items: business reads own"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          o.business_clerk_id = (auth.jwt()->>'sub')
          OR (
            o.business_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.business_members bm
              WHERE bm.business_id = o.business_id
                AND bm.user_id = (auth.jwt()->>'sub')
            )
          )
        )
    )
  );
