-- =============================================================
-- UMA Market — Verified Reviews & Reputation V1
-- Migration: 20261002000001_verified_reviews_reputation
--
-- Reviews are transaction-backed: only a business buyer who owns a
-- completed order can review that order's farmer or purchased items.
-- Reviews are publicly readable, but writes remain buyer-scoped.
-- =============================================================

CREATE TABLE public.seller_reviews (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reviewer_clerk_id     TEXT NOT NULL REFERENCES public.profiles(clerk_id) ON DELETE RESTRICT,
  target_farmer_clerk_id TEXT NOT NULL REFERENCES public.profiles(clerk_id) ON DELETE RESTRICT,
  rating                INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment               TEXT CHECK (comment IS NULL OR char_length(comment) <= 1000),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT seller_reviews_one_per_order UNIQUE (order_id),
  CONSTRAINT seller_reviews_one_reviewer_per_order UNIQUE (order_id, reviewer_clerk_id)
);

CREATE INDEX idx_seller_reviews_farmer_created
  ON public.seller_reviews (target_farmer_clerk_id, created_at DESC);

CREATE TABLE public.product_reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id     UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  reviewer_clerk_id TEXT NOT NULL REFERENCES public.profiles(clerk_id) ON DELETE RESTRICT,
  product_id        UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  rating            INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment           TEXT CHECK (comment IS NULL OR char_length(comment) <= 1000),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_reviews_one_per_order_item UNIQUE (order_item_id),
  CONSTRAINT product_reviews_order_item_order_product_key
    UNIQUE (order_item_id, order_id, product_id)
);

CREATE INDEX idx_product_reviews_product_created
  ON public.product_reviews (product_id, created_at DESC);

CREATE TRIGGER trg_seller_reviews_updated_at
  BEFORE UPDATE ON public.seller_reviews
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER trg_product_reviews_updated_at
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Relationship columns are immutable. V1 intentionally exposes no edit action,
-- but this also protects future updates from changing review provenance.
CREATE OR REPLACE FUNCTION public.trigger_lock_review_provenance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.reviewer_clerk_id IS DISTINCT FROM OLD.reviewer_clerk_id
     OR NEW.target_farmer_clerk_id IS DISTINCT FROM OLD.target_farmer_clerk_id THEN
    RAISE EXCEPTION 'Review provenance cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seller_reviews_lock_provenance
  BEFORE UPDATE ON public.seller_reviews
  FOR EACH ROW EXECUTE FUNCTION public.trigger_lock_review_provenance();

CREATE OR REPLACE FUNCTION public.trigger_lock_product_review_provenance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.order_item_id IS DISTINCT FROM OLD.order_item_id
     OR NEW.reviewer_clerk_id IS DISTINCT FROM OLD.reviewer_clerk_id
     OR NEW.product_id IS DISTINCT FROM OLD.product_id THEN
    RAISE EXCEPTION 'Review provenance cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_reviews_lock_provenance
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.trigger_lock_product_review_provenance();

ALTER TABLE public.seller_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Reviews are public marketplace trust signals. They are valid by schema only
-- when backed by a real order/order_item; no client-controlled verified flag exists.
CREATE POLICY "seller_reviews: public reads verified"
  ON public.seller_reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.status = 'completed'
        AND o.farmer_clerk_id = target_farmer_clerk_id
    )
  );

CREATE POLICY "product_reviews: public reads verified"
  ON public.product_reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
      WHERE o.id = order_id
        AND o.status = 'completed'
        AND oi.id = order_item_id
        AND oi.product_id = product_reviews.product_id
    )
  );

CREATE POLICY "seller_reviews: completed buyer inserts own"
  ON public.seller_reviews FOR INSERT
  WITH CHECK (
    (auth.jwt()->>'user_role') = 'business'
    AND reviewer_clerk_id = auth.jwt()->>'sub'
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_id
        AND o.status = 'completed'
        AND o.business_clerk_id = auth.jwt()->>'sub'
        AND o.farmer_clerk_id = target_farmer_clerk_id
    )
  );

CREATE POLICY "product_reviews: completed buyer inserts own"
  ON public.product_reviews FOR INSERT
  WITH CHECK (
    (auth.jwt()->>'user_role') = 'business'
    AND reviewer_clerk_id = auth.jwt()->>'sub'
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
      WHERE o.id = order_id
        AND o.status = 'completed'
        AND o.business_clerk_id = auth.jwt()->>'sub'
        AND oi.id = order_item_id
        AND oi.product_id = product_reviews.product_id
    )
  );

CREATE POLICY "seller_reviews: reviewer updates rating and comment"
  ON public.seller_reviews FOR UPDATE
  USING (reviewer_clerk_id = auth.jwt()->>'sub')
  WITH CHECK (reviewer_clerk_id = auth.jwt()->>'sub');

CREATE POLICY "product_reviews: reviewer updates rating and comment"
  ON public.product_reviews FOR UPDATE
  USING (reviewer_clerk_id = auth.jwt()->>'sub')
  WITH CHECK (reviewer_clerk_id = auth.jwt()->>'sub');

CREATE POLICY "seller_reviews: reviewer deletes own"
  ON public.seller_reviews FOR DELETE
  USING (reviewer_clerk_id = auth.jwt()->>'sub');

CREATE POLICY "product_reviews: reviewer deletes own"
  ON public.product_reviews FOR DELETE
  USING (reviewer_clerk_id = auth.jwt()->>'sub');
