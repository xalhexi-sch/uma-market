-- =============================================================
-- UMA Market — Security Remediation Migration
-- Migration: 20260925000001_security_remediation.sql
--
-- Fixes:
-- 1. SEC-AUTH-001: Profile Status Lifecycle & Immediate Revocation Gate
--    - Adds `status` column to `public.profiles` ('active', 'suspended', 'revoked')
--    - Indexes status for fast lookup
--    - Updates profile field protection trigger to prevent non-admins from altering status
-- 2. E2E-005: Multi-Tab Same-Account Checkout Race Resilience
--    - Updates `public.place_checkout_orders` to validate and lock buyer's cart rows FOR UPDATE
--    - Enforces that requested products exist in cart and requested quantity <= cart quantity
--    - Asserts that deletion of cart items succeeds (ROW_COUNT > 0)
--    - Verifies buyer profile status is active before processing checkout
--    - Applies matching cart-authoritative protection to `public.place_order`
--    - Updates `public.update_order_status` to verify farmer profile status is active
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. SEC-AUTH-001: PROFILE STATUS LIFECYCLE
-- ──────────────────────────────────────────────────────────────

-- 1a. Add status column to profiles with default 'active'
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'suspended', 'revoked'));

CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- 1b. Update trigger to prevent non-admin/service_role users from mutating status
CREATE OR REPLACE FUNCTION public.trigger_protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role TEXT;
  v_user_role TEXT;
BEGIN
  -- If running in database maintenance/migration without a JWT context
  IF auth.jwt() IS NULL THEN
    RETURN NEW;
  END IF;

  v_jwt_role := auth.jwt() ->> 'role';
  IF v_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  v_user_role := auth.jwt() ->> 'user_role';

  -- Platform administrators can update role, is_verified, and status
  IF v_user_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Non-admin callers cannot modify is_verified
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    RAISE EXCEPTION 'Only administrators can modify profile verification status';
  END IF;

  -- Non-admin callers cannot modify role
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Only administrators can modify profile role';
  END IF;

  -- Non-admin callers cannot modify status
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only administrators can modify profile account status';
  END IF;

  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 2. E2E-005 & SEC-AUTH-001: HARDENED CHECKOUT & ORDER RPCS
-- ──────────────────────────────────────────────────────────────

-- 2a. Update multi-farmer checkout RPC with cart row-locking & status validation
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

  -- 2. Caller profile status check (SEC-AUTH-001)
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
  -- Locking cart items first ensures immediate rejection if any item was checked out
  -- or removed in another tab, before modifying products or orders.
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

-- 2b. Update single-order checkout RPC with cart row-locking & status validation
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
  v_order_id      UUID;
  v_item          JSONB;
  v_product       RECORD;
  v_cart_item     RECORD;
  v_total         NUMERIC(10,2) := 0;
  v_qty           NUMERIC(10,2);
  v_rows_deleted  INT;
BEGIN
  -- Identity & role check
  v_caller_id := auth.jwt()->>'sub';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF (auth.jwt()->>'user_role') IS DISTINCT FROM 'business' THEN
    RAISE EXCEPTION 'Only business users can place orders';
  END IF;

  -- Caller profile status check (SEC-AUTH-001)
  SELECT status INTO v_caller_status
  FROM public.profiles
  WHERE clerk_id = v_caller_id;

  IF v_caller_status IS NOT NULL AND v_caller_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Account is % and cannot place orders', v_caller_status;
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
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

-- 2c. Update order status RPC to verify caller profile status
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id            UUID,
  p_new_status          TEXT,
  p_cancellation_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id     TEXT;
  v_caller_status TEXT;
  v_order         RECORD;
  v_now           TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Identity & role check
  v_caller_id := auth.jwt() ->> 'sub';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF (auth.jwt() ->> 'user_role') IS DISTINCT FROM 'farmer' THEN
    RAISE EXCEPTION 'Only farmers can update order status';
  END IF;

  -- 2. Caller profile status check (SEC-AUTH-001)
  SELECT status INTO v_caller_status
  FROM public.profiles
  WHERE clerk_id = v_caller_id;

  IF v_caller_status IS NOT NULL AND v_caller_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Account is % and cannot update order status', v_caller_status;
  END IF;

  -- 3. Fetch the order with an exclusive row lock
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.farmer_clerk_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'Not authorized to update this order';
  END IF;

  -- 4. Validate permitted forward state transitions
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

  -- 5. Perform the transition
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
