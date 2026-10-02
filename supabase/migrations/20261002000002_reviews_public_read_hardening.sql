-- =============================================================
-- UMA Market — Verified Reviews Public Read Hardening
--
-- Public RLS policies cannot inspect orders directly because anonymous
-- callers do not have SELECT access to orders. These SECURITY DEFINER
-- predicates validate provenance without exposing order rows.
-- =============================================================

CREATE OR REPLACE FUNCTION public.is_verified_seller_review(
  p_order_id UUID,
  p_farmer_clerk_id TEXT
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.status = 'completed'
      AND o.farmer_clerk_id = p_farmer_clerk_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_verified_product_review(
  p_order_id UUID,
  p_order_item_id UUID,
  p_product_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.id = p_order_id
      AND o.status = 'completed'
      AND oi.id = p_order_item_id
      AND oi.product_id = p_product_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_verified_seller_review(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_verified_product_review(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_verified_seller_review(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_verified_product_review(UUID, UUID, UUID) TO anon, authenticated;

DROP POLICY IF EXISTS "seller_reviews: public reads verified" ON public.seller_reviews;
CREATE POLICY "seller_reviews: public reads verified"
  ON public.seller_reviews FOR SELECT
  USING (public.is_verified_seller_review(order_id, target_farmer_clerk_id));

DROP POLICY IF EXISTS "product_reviews: public reads verified" ON public.product_reviews;
CREATE POLICY "product_reviews: public reads verified"
  ON public.product_reviews FOR SELECT
  USING (public.is_verified_product_review(order_id, order_item_id, product_id));
