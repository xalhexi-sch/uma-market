-- =============================================================================
-- UMA Market — Migration: 20260928000001_pickup_date_validation.sql
--
-- Description:
-- 1. Hardens public.place_checkout_orders RPC to enforce:
--    - If fulfillment_type = 'pickup', pickup_date is required and cannot be in the past.
--    - If fulfillment_type = 'seller_delivery', pickup_date is forced to NULL.
-- 2. Hardens legacy public.place_order RPC with the exact same validation rules.
-- 3. Adds a non-blocking check constraint ensuring seller_delivery never stores pickup_date.
-- =============================================================================

-- 1. Enforce seller_delivery consistency via constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_pickup_date_consistency'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT chk_orders_pickup_date_consistency
      CHECK (fulfillment_type != 'seller_delivery' OR pickup_date IS NULL)
      NOT VALID;
  END IF;
END $$;

-- 2. Hardened place_checkout_orders RPC
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

-- 3. Hardened legacy place_order RPC
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

  -- 2. Caller profile status check (SEC-AUTH-001)
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

GRANT EXECUTE ON FUNCTION public.place_checkout_orders(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_order(TEXT, TEXT, TEXT, TEXT, DATE, JSONB) TO authenticated;
