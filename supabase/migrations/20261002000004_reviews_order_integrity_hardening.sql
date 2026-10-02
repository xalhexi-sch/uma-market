-- =============================================================================
-- UMA Market — Verified Reviews V1 order-integrity hardening
-- Forward-only migration. Checkout remains SECURITY DEFINER and continues to
-- create pending orders atomically; ordinary clients cannot create orders by
-- writing to the orders table directly.
-- =============================================================================

-- A review may never be a farmer reviewing that same farmer.
ALTER TABLE public.seller_reviews
  ADD CONSTRAINT seller_reviews_no_self_review
  CHECK (reviewer_clerk_id IS DISTINCT FROM target_farmer_clerk_id);

-- Direct order creation is intentionally not an available client capability.
-- place_order() and place_checkout_orders() are SECURITY DEFINER and remain the
-- supported checkout boundary.
DROP POLICY IF EXISTS "orders: business inserts" ON public.orders;

-- Defense in depth for trusted/admin paths: a non-admin, non-service caller
-- cannot insert an order already marked completed. The checkout RPC inserts
-- pending orders and is unaffected.
CREATE OR REPLACE FUNCTION public.trigger_reject_direct_completed_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (auth.jwt()->>'role') IS DISTINCT FROM 'service_role'
     AND (auth.jwt()->>'user_role') IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Completed orders must be produced by the order workflow';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_direct_completed_order ON public.orders;
CREATE TRIGGER trg_reject_direct_completed_order
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_reject_direct_completed_order();

DROP POLICY IF EXISTS "seller_reviews: completed buyer inserts own" ON public.seller_reviews;
CREATE POLICY "seller_reviews: completed buyer inserts own"
  ON public.seller_reviews FOR INSERT
  WITH CHECK (
    (auth.jwt()->>'user_role') = 'business'
    AND reviewer_clerk_id = auth.jwt()->>'sub'
    AND reviewer_clerk_id IS DISTINCT FROM target_farmer_clerk_id
    AND EXISTS (
      SELECT 1 FROM public.profiles reviewer
      WHERE reviewer.clerk_id = reviewer_clerk_id
        AND reviewer.role = 'business'
        AND reviewer.status = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.profiles farmer
        ON farmer.clerk_id = o.farmer_clerk_id
       AND farmer.role = 'farmer'
       AND farmer.status = 'active'
      WHERE o.id = order_id
        AND o.status = 'completed'
        AND o.business_clerk_id = reviewer_clerk_id
        AND o.farmer_clerk_id = target_farmer_clerk_id
        AND o.business_clerk_id IS DISTINCT FROM o.farmer_clerk_id
    )
  );

DROP POLICY IF EXISTS "product_reviews: completed buyer inserts own" ON public.product_reviews;
CREATE POLICY "product_reviews: completed buyer inserts own"
  ON public.product_reviews FOR INSERT
  WITH CHECK (
    (auth.jwt()->>'user_role') = 'business'
    AND reviewer_clerk_id = auth.jwt()->>'sub'
    AND EXISTS (
      SELECT 1 FROM public.profiles reviewer
      WHERE reviewer.clerk_id = reviewer_clerk_id
        AND reviewer.role = 'business'
        AND reviewer.status = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id AND oi.id = order_item_id
      JOIN public.products p ON p.id = oi.product_id AND p.id = product_id
      JOIN public.profiles farmer
        ON farmer.clerk_id = p.farmer_clerk_id
       AND farmer.role = 'farmer'
       AND farmer.status = 'active'
      WHERE o.id = order_id
        AND o.status = 'completed'
        AND o.business_clerk_id = reviewer_clerk_id
        AND o.business_clerk_id IS DISTINCT FROM o.farmer_clerk_id
    )
  );

-- Revalidate every invariant on mutation. Relationship columns are immutable
-- through the existing provenance triggers, but are repeated here so an UPDATE
-- cannot turn a valid review into an invalid one through another field change.
DROP POLICY IF EXISTS "seller_reviews: reviewer updates rating and comment" ON public.seller_reviews;
CREATE POLICY "seller_reviews: reviewer updates rating and comment"
  ON public.seller_reviews FOR UPDATE
  USING (
    (auth.jwt()->>'user_role') = 'business'
    AND reviewer_clerk_id = auth.jwt()->>'sub'
    AND EXISTS (
      SELECT 1
      FROM public.profiles reviewer
      WHERE reviewer.clerk_id = reviewer_clerk_id
        AND reviewer.role = 'business'
        AND reviewer.status = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.profiles farmer
        ON farmer.clerk_id = o.farmer_clerk_id
       AND farmer.role = 'farmer'
       AND farmer.status = 'active'
      WHERE o.id = order_id
        AND o.status = 'completed'
        AND o.business_clerk_id = reviewer_clerk_id
        AND o.farmer_clerk_id = target_farmer_clerk_id
        AND o.business_clerk_id IS DISTINCT FROM o.farmer_clerk_id
    )
  )
  WITH CHECK (
    (auth.jwt()->>'user_role') = 'business'
    AND reviewer_clerk_id = auth.jwt()->>'sub'
    AND reviewer_clerk_id IS DISTINCT FROM target_farmer_clerk_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles reviewer
      WHERE reviewer.clerk_id = reviewer_clerk_id
        AND reviewer.role = 'business'
        AND reviewer.status = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.profiles farmer
        ON farmer.clerk_id = o.farmer_clerk_id
       AND farmer.role = 'farmer'
       AND farmer.status = 'active'
      WHERE o.id = order_id
        AND o.status = 'completed'
        AND o.business_clerk_id = reviewer_clerk_id
        AND o.farmer_clerk_id = target_farmer_clerk_id
        AND o.business_clerk_id IS DISTINCT FROM o.farmer_clerk_id
    )
  );

DROP POLICY IF EXISTS "seller_reviews: reviewer deletes own" ON public.seller_reviews;
CREATE POLICY "seller_reviews: reviewer deletes own"
  ON public.seller_reviews FOR DELETE
  USING (
    (auth.jwt()->>'user_role') = 'business'
    AND reviewer_clerk_id = auth.jwt()->>'sub'
    AND EXISTS (
      SELECT 1
      FROM public.profiles reviewer
      WHERE reviewer.clerk_id = reviewer_clerk_id
        AND reviewer.role = 'business'
        AND reviewer.status = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.profiles farmer
        ON farmer.clerk_id = o.farmer_clerk_id
       AND farmer.role = 'farmer'
       AND farmer.status = 'active'
      WHERE o.id = order_id
        AND o.status = 'completed'
        AND o.business_clerk_id = reviewer_clerk_id
        AND o.farmer_clerk_id = target_farmer_clerk_id
        AND o.business_clerk_id IS DISTINCT FROM o.farmer_clerk_id
    )
  );

DROP POLICY IF EXISTS "product_reviews: reviewer updates rating and comment" ON public.product_reviews;
CREATE POLICY "product_reviews: reviewer updates rating and comment"
  ON public.product_reviews FOR UPDATE
  USING (
    (auth.jwt()->>'user_role') = 'business'
    AND reviewer_clerk_id = auth.jwt()->>'sub'
    AND EXISTS (
      SELECT 1
      FROM public.profiles reviewer
      WHERE reviewer.clerk_id = reviewer_clerk_id
        AND reviewer.role = 'business'
        AND reviewer.status = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id AND oi.id = order_item_id
      JOIN public.products p ON p.id = oi.product_id AND p.id = product_id
      JOIN public.profiles farmer
        ON farmer.clerk_id = p.farmer_clerk_id
       AND farmer.role = 'farmer'
       AND farmer.status = 'active'
      WHERE o.id = order_id
        AND o.status = 'completed'
        AND o.business_clerk_id = reviewer_clerk_id
        AND o.business_clerk_id IS DISTINCT FROM o.farmer_clerk_id
    )
  )
  WITH CHECK (
    (auth.jwt()->>'user_role') = 'business'
    AND reviewer_clerk_id = auth.jwt()->>'sub'
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id AND oi.id = order_item_id
      JOIN public.products p ON p.id = oi.product_id AND p.id = product_id
      WHERE o.id = order_id
        AND o.status = 'completed'
        AND o.business_clerk_id = reviewer_clerk_id
        AND o.business_clerk_id IS DISTINCT FROM o.farmer_clerk_id
    )
  );

DROP POLICY IF EXISTS "product_reviews: reviewer deletes own" ON public.product_reviews;
CREATE POLICY "product_reviews: reviewer deletes own"
  ON public.product_reviews FOR DELETE
  USING (
    (auth.jwt()->>'user_role') = 'business'
    AND reviewer_clerk_id = auth.jwt()->>'sub'
    AND EXISTS (
      SELECT 1
      FROM public.profiles reviewer
      WHERE reviewer.clerk_id = reviewer_clerk_id
        AND reviewer.role = 'business'
        AND reviewer.status = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id AND oi.id = order_item_id
      JOIN public.products p ON p.id = oi.product_id AND p.id = product_id
      JOIN public.profiles farmer
        ON farmer.clerk_id = p.farmer_clerk_id
       AND farmer.role = 'farmer'
       AND farmer.status = 'active'
      WHERE o.id = order_id
        AND o.status = 'completed'
        AND o.business_clerk_id = reviewer_clerk_id
        AND o.business_clerk_id IS DISTINCT FROM o.farmer_clerk_id
    )
  );
