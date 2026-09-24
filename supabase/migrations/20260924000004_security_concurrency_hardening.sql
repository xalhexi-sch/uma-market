-- =============================================================
-- UMA Market — Security & Concurrency Hardening v2
-- Migration: 20260924000004_security_concurrency_hardening.sql
--
-- Fixes:
-- 1. SEC-005: Prevent profile role and verification tampering
--    - BEFORE UPDATE trigger on public.profiles ensuring only admin
--      or service_role callers can modify is_verified or role.
-- 2. SEC-006: Restrict farmer access to commercial buyer profiles
--    - Drop permissive "profiles: farmer reads business"
--    - Add "profiles: farmer reads order business" scoped strictly
--      to genuine transactional order relationships.
-- 3. SCL-002: Concurrent order status transition race
--    - Update public.update_order_status() to fetch order row FOR UPDATE
-- 4. SCL-003: Concurrent price snapshot inconsistency
--    - Update public.place_checkout_orders() and public.place_order()
--      to acquire FOR UPDATE locks on products during checkout
-- 5. SEC-008: Remove farmer direct hard DELETE on products
--    - Drop "products: farmer deletes own draft/archived"
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. SEC-005: PROFILE ROLE & VERIFICATION STATUS PROTECTION
-- ──────────────────────────────────────────────────────────────

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

  -- Platform administrators can update role and is_verified
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_protect_profile_fields();

-- ──────────────────────────────────────────────────────────────
-- 2. SEC-006: SCOPED BUSINESS PROFILE ACCESS FOR FARMERS
-- ──────────────────────────────────────────────────────────────

-- Drop the permissive policy that allowed any farmer to enumerate all businesses
DROP POLICY IF EXISTS "profiles: farmer reads business" ON public.profiles;

-- Create policy scoping farmer visibility of business profiles to orders they participate in
DROP POLICY IF EXISTS "profiles: farmer reads order business" ON public.profiles;
CREATE POLICY "profiles: farmer reads order business"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'user_role') = 'farmer'
    AND role = 'business'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.business_clerk_id = profiles.clerk_id
        AND o.farmer_clerk_id = (auth.jwt()->>'sub')
    )
  );

-- ──────────────────────────────────────────────────────────────
-- 3. SCL-002: SERIALIZED ORDER STATUS STATE MACHINE
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

  -- Acquire row-level lock on the target order to serialize concurrent status transitions
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

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

-- ──────────────────────────────────────────────────────────────
-- 4. SCL-003: CONCURRENT PRICE SNAPSHOT & ROW LOCKING IN CHECKOUT
-- ──────────────────────────────────────────────────────────────

-- 4a. Update multi-farmer checkout RPC
CREATE OR REPLACE FUNCTION public.place_checkout_orders(
  p_orders JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   TEXT;
  v_order_group JSONB;
  v_farmer_id   TEXT;
  v_fulfillment TEXT;
  v_address     TEXT;
  v_notes       TEXT;
  v_pickup_date DATE;
  v_items       JSONB;
  v_item        JSONB;
  v_product     RECORD;
  v_qty         NUMERIC(10,2);
  v_total       NUMERIC(10,2);
  v_order_id    UUID;
  v_order_ids   UUID[] := ARRAY[]::UUID[];
BEGIN
  -- Identity & role check
  v_caller_id := auth.jwt()->>'sub';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF (auth.jwt()->>'user_role') IS DISTINCT FROM 'business' THEN
    RAISE EXCEPTION 'Only business users can place orders';
  END IF;

  IF jsonb_array_length(p_orders) = 0 THEN
    RAISE EXCEPTION 'Checkout must contain at least one order';
  END IF;

  -- Process each farmer order in a single atomic transaction
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

    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
      RAISE EXCEPTION 'Order group for farmer % must contain at least one item', v_farmer_id;
    END IF;

    -- 1. Validate each product and lock the row FOR UPDATE in canonical order
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

    -- 2. Create the order
    INSERT INTO public.orders (
      business_clerk_id, farmer_clerk_id, fulfillment_type,
      delivery_address, notes, pickup_date, total_amount, status
    ) VALUES (
      v_caller_id, v_farmer_id, v_fulfillment,
      v_address, v_notes, v_pickup_date, v_total, 'pending'
    ) RETURNING id INTO v_order_id;

    -- 3. Create items + decrement stock + clear cart
    -- Since the products are already locked by this transaction, price and stock are consistent
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
    END LOOP;

    v_order_ids := array_append(v_order_ids, v_order_id);
  END LOOP;

  RETURN jsonb_build_object('order_ids', to_jsonb(v_order_ids));
END;
$$;

-- 4b. Update single-order checkout RPC (for backwards compatibility)
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
  END LOOP;

  RETURN jsonb_build_object('order_id', v_order_id);
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 5. SEC-008: REMOVE FARMER DIRECT HARD DELETE ON PRODUCTS
-- ──────────────────────────────────────────────────────────────

-- Remove direct hard DELETE permission for farmers.
-- Farmers must soft-delete / archive listings using the archive action (status = 'archived').
DROP POLICY IF EXISTS "products: farmer deletes own" ON public.products;
DROP POLICY IF EXISTS "products: farmer deletes own draft/archived" ON public.products;
