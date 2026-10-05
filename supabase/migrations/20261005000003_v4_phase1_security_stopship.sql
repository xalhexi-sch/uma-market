-- =============================================================
-- UMA Market — V4 Phase 1: Security Stop-Ship Fixes
-- Migration: 20261005000003_v4_phase1_security_stopship.sql
--
-- Fixes:
-- 1. SEC-OI-001: Drop direct order_items INSERT policy
--    The initial schema's "order_items: business inserts" RLS policy
--    allows a business user to INSERT order_items rows directly,
--    bypassing the SECURITY DEFINER checkout RPCs. This means a
--    client can forge unit_price, quantity, or product_id values
--    without server-side validation. All legitimate order_items
--    inserts go through place_checkout_orders() / place_order(),
--    which run as SECURITY DEFINER and therefore bypass RLS.
--
-- 2. SEC-SELL-001: Verify seller (farmer) profile status during checkout
--    The checkout RPCs validate the BUYER's profile status but do
--    NOT check whether the SELLER's account is active. A suspended
--    or revoked farmer's products could still be ordered.
--    Both place_checkout_orders() and place_order() are updated.
--
-- 3. SEC-MOD-001: Product moderation state separation
--    Products have a single status field that both farmers and admins
--    can modify. A farmer can change a product's status back to
--    'active' after an admin sets it to 'archived' for moderation.
--    This adds a moderation_status column and a BEFORE UPDATE
--    trigger that prevents a farmer from activating a product that
--    has been flagged or suspended by moderation.
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. SEC-OI-001: DROP DIRECT ORDER_ITEMS INSERT POLICY
-- ──────────────────────────────────────────────────────────────
-- All legitimate order_items writes happen inside SECURITY DEFINER
-- RPCs (place_checkout_orders, place_order) which bypass RLS.
-- No non-admin user should ever directly INSERT into order_items.

DROP POLICY IF EXISTS "order_items: business inserts" ON public.order_items;

-- ──────────────────────────────────────────────────────────────
-- 2. SEC-SELL-001: SELLER STATUS CHECK IN CHECKOUT RPCS
-- ──────────────────────────────────────────────────────────────

-- 2a. Update place_checkout_orders to verify seller profile status
CREATE OR REPLACE FUNCTION public.place_checkout_orders(
  p_orders JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id     TEXT;
  v_caller_status TEXT;
  v_seller_status TEXT;
  v_order_group   JSONB;
  v_farmer_id     TEXT;
  v_fulfillment   TEXT;
  v_address       TEXT;
  v_notes         TEXT;
  v_pickup_date   DATE;
  v_items         JSONB;
  v_item          JSONB;
  v_product       RECORD;
  v_cart_item     RECORD;
  v_qty           NUMERIC(10,2);
  v_total         NUMERIC(10,2);
  v_order_id      UUID;
  v_order_ids     UUID[] := ARRAY[]::UUID[];
  v_rows_deleted  INT;
BEGIN
  -- 1. Identity & role check
  v_caller_id := auth.jwt()->>'sub';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF (auth.jwt()->>'user_role') IS DISTINCT FROM 'business' THEN
    RAISE EXCEPTION 'Only business users can place orders';
  END IF;

  -- 2. Caller (buyer) profile status check (SEC-AUTH-001)
  SELECT status INTO v_caller_status
  FROM public.profiles
  WHERE clerk_id = v_caller_id;

  IF v_caller_status IS NOT NULL AND v_caller_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Account is % and cannot place orders', v_caller_status;
  END IF;

  IF jsonb_array_length(p_orders) = 0 THEN
    RAISE EXCEPTION 'Checkout must contain at least one order';
  END IF;

  -- 3. Pre-validate & lock all requested cart items across all order groups (E2E-005)
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

      SELECT id, quantity
      INTO   v_cart_item
      FROM   public.cart_items
      WHERE  business_clerk_id = v_caller_id
        AND  product_id = (v_item->>'product_id')::UUID
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

  -- 4. Process each farmer order in a single atomic transaction
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

    -- SEC-SELL-001: Verify seller (farmer) profile status is active
    SELECT status INTO v_seller_status
    FROM public.profiles
    WHERE clerk_id = v_farmer_id;

    IF v_seller_status IS NOT NULL AND v_seller_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'Seller account is % and cannot accept orders', v_seller_status;
    END IF;

    -- Pickup vs delivery date validation
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

    -- Validate each product and lock the row FOR UPDATE in canonical order
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

    -- Create the order
    INSERT INTO public.orders (
      business_clerk_id, farmer_clerk_id, fulfillment_type,
      delivery_address, notes, pickup_date, total_amount, status
    ) VALUES (
      v_caller_id, v_farmer_id, v_fulfillment,
      v_address, v_notes, v_pickup_date, v_total, 'pending'
    ) RETURNING id INTO v_order_id;

    -- Create items + decrement stock + clear cart
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

      DELETE FROM public.cart_items
      WHERE  business_clerk_id = v_caller_id
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

-- 2b. Update place_order to verify seller profile status
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
  v_caller_id     TEXT;
  v_caller_status TEXT;
  v_seller_status TEXT;
  v_order_id      UUID;
  v_total         NUMERIC(10,2) := 0;
  v_item          JSONB;
  v_product       RECORD;
  v_cart_item     RECORD;
  v_qty           NUMERIC(10,2);
  v_rows_deleted  INT;
  v_final_pickup_date DATE := p_pickup_date;
BEGIN
  -- 1. Identity & role check
  v_caller_id := auth.jwt()->>'sub';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF (auth.jwt()->>'user_role') IS DISTINCT FROM 'business' THEN
    RAISE EXCEPTION 'Only business users can place orders';
  END IF;

  -- 2. Caller (buyer) profile status check (SEC-AUTH-001)
  SELECT status INTO v_caller_status
  FROM public.profiles
  WHERE clerk_id = v_caller_id;

  IF v_caller_status IS NOT NULL AND v_caller_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Account is % and cannot place orders', v_caller_status;
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;

  IF p_fulfillment_type IS NULL OR p_fulfillment_type NOT IN ('pickup', 'seller_delivery') THEN
    RAISE EXCEPTION 'Invalid fulfillment type: %', p_fulfillment_type;
  END IF;

  -- SEC-SELL-001: Verify seller (farmer) profile status is active
  SELECT status INTO v_seller_status
  FROM public.profiles
  WHERE clerk_id = p_farmer_clerk_id;

  IF v_seller_status IS NOT NULL AND v_seller_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Seller account is % and cannot accept orders', v_seller_status;
  END IF;

  -- Pickup vs delivery date validation
  IF p_fulfillment_type = 'pickup' THEN
    IF v_final_pickup_date IS NULL THEN
      RAISE EXCEPTION 'Pickup date is required for pickup orders';
    END IF;
    IF v_final_pickup_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::DATE THEN
      RAISE EXCEPTION 'Pickup date cannot be in the past';
    END IF;
  ELSIF p_fulfillment_type = 'seller_delivery' THEN
    v_final_pickup_date := NULL;
  END IF;

  -- Pre-validate & lock all requested cart items (E2E-005)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::NUMERIC;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be greater than zero';
    END IF;

    SELECT id, quantity
    INTO   v_cart_item
    FROM   public.cart_items
    WHERE  business_clerk_id = v_caller_id
      AND  product_id = (v_item->>'product_id')::UUID
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cart item for product "%" was not found or has already been checked out.',
        COALESCE((SELECT name FROM public.products WHERE id = (v_item->>'product_id')::UUID), v_item->>'product_id');
    END IF;

    IF v_qty > v_cart_item.quantity THEN
      RAISE EXCEPTION 'Requested quantity (%) exceeds quantity in cart (%).', v_qty, v_cart_item.quantity;
    END IF;
  END LOOP;

  -- Validate each product and compute total while acquiring row locks in canonical order
  FOR v_item IN
    SELECT elem.val
    FROM jsonb_array_elements(p_items) AS elem(val)
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
    p_delivery_address, p_notes, v_final_pickup_date, v_total, 'pending'
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
      v_product.price_per_unit,
      v_product.name,
      v_product.unit
    );

    UPDATE public.products
    SET    quantity_available = quantity_available - v_qty,
           updated_at = NOW()
    WHERE  id = (v_item->>'product_id')::UUID;

    DELETE FROM public.cart_items
    WHERE  business_clerk_id = v_caller_id
      AND  product_id = (v_item->>'product_id')::UUID;

    GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
    IF v_rows_deleted = 0 THEN
      RAISE EXCEPTION 'Cart item for product "%" was already checked out or removed.', v_product.name;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('order_id', v_order_id);
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 3. SEC-MOD-001: PRODUCT MODERATION STATE SEPARATION
-- ──────────────────────────────────────────────────────────────

-- 3a. Add moderation_status column to products
-- 'approved' = normal state (default for existing products)
-- 'flagged'  = under admin review, hidden from marketplace
-- 'suspended' = admin-suspended, farmer cannot reactivate
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (moderation_status IN ('approved', 'flagged', 'suspended'));

CREATE INDEX IF NOT EXISTS idx_products_moderation_status
  ON public.products (moderation_status);

-- 3b. Trigger: prevent non-admin users from modifying moderation_status
CREATE OR REPLACE FUNCTION public.trigger_protect_product_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role  TEXT;
  v_user_role TEXT;
BEGIN
  -- Migration / service_role context: allow
  IF auth.jwt() IS NULL THEN
    RETURN NEW;
  END IF;

  v_jwt_role := auth.jwt() ->> 'role';
  IF v_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  v_user_role := auth.jwt() ->> 'user_role';

  -- Admins can modify moderation_status freely
  IF v_user_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Non-admin users cannot modify moderation_status
  IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status THEN
    RAISE EXCEPTION 'Only administrators can modify product moderation status';
  END IF;

  -- Non-admin users cannot set status to 'active' when product is moderation-suspended
  IF OLD.moderation_status IN ('flagged', 'suspended')
     AND NEW.status = 'active'
     AND OLD.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Product is under moderation review and cannot be activated';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_product_moderation ON public.products;
CREATE TRIGGER trg_protect_product_moderation
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_protect_product_moderation();

-- 3c. Update the "products: read active" policy to also require moderation approval
-- Only products that are both 'active' status AND 'approved' moderation are publicly visible
DROP POLICY IF EXISTS "products: read active" ON public.products;
CREATE POLICY "products: read active"
  ON public.products FOR SELECT
  USING (status = 'active' AND moderation_status = 'approved');

-- GRANTS: ensure authenticated users can still call the checkout RPCs
GRANT EXECUTE ON FUNCTION public.place_checkout_orders(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_order(TEXT, TEXT, TEXT, TEXT, DATE, JSONB) TO authenticated;
