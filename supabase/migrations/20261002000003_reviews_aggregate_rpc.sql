-- =============================================================
-- UMA Market — Verified Review Aggregate RPCs
-- Forward-only addition: calculate reputation in PostgreSQL without
-- loading every review row into the application server.
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_seller_review_summary(p_farmer_clerk_id TEXT)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'average_rating', COALESCE(ROUND(AVG(r.rating)::NUMERIC, 1), 0),
    'review_count', COUNT(*)
  )
  FROM public.seller_reviews r
  WHERE r.target_farmer_clerk_id = p_farmer_clerk_id
    AND public.is_verified_seller_review(r.order_id, r.target_farmer_clerk_id);
$$;

CREATE OR REPLACE FUNCTION public.get_product_review_summary(p_product_id UUID)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'average_rating', COALESCE(ROUND(AVG(r.rating)::NUMERIC, 1), 0),
    'review_count', COUNT(*)
  )
  FROM public.product_reviews r
  WHERE r.product_id = p_product_id
    AND public.is_verified_product_review(r.order_id, r.order_item_id, r.product_id);
$$;

REVOKE ALL ON FUNCTION public.get_seller_review_summary(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_product_review_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seller_review_summary(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_review_summary(UUID) TO anon, authenticated;
