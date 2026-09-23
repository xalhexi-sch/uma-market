-- =============================================================
-- UMA Market — Launch Readiness P1 Fixes
-- Migration: 20260924000002_launch_readiness_p1.sql
--
-- 1. Stock restitution trigger:
--    Restores products.quantity_available when an order status
--    transitions to 'cancelled'. Restores exactly once using order_items.
--
-- 2. Transactional multi-farmer checkout RPC:
--    place_checkout_orders() creates orders for multiple farmers in a
--    single atomic transaction. If any validation fails, the entire
--    batch rolls back, preventing partial-order failures.
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. STOCK RESTITUTION TRIGGER
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_restore_stock_on_order_cancelled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Execute ONLY when transitioning TO 'cancelled' FROM a non-cancelled status
  -- (guarantees exactly-once restoration and prevents double restoration)
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
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

DROP TRIGGER IF EXISTS trg_restore_stock_on_cancelled ON public.orders;
CREATE TRIGGER trg_restore_stock_on_cancelled
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
  EXECUTE FUNCTION public.trigger_restore_stock_on_order_cancelled();

-- ──────────────────────────────────────────────────────────────
-- 2. TRANSACTIONAL MULTI-FARMER CHECKOUT RPC
-- ──────────────────────────────────────────────────────────────
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

    -- 1. Validate each product in this order group
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
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

GRANT EXECUTE ON FUNCTION public.place_checkout_orders TO authenticated;
