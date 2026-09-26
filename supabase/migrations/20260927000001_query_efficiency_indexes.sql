-- =============================================================
-- UMA Market — Query Efficiency & Index Hardening
-- Migration: 20260927000001_query_efficiency_indexes.sql
--
-- Features:
-- 1. Composite order sort indexes for buyer and farmer order histories
-- 2. Foreign key index on cart_items(product_id) to eliminate table scans
-- 3. Drop redundant single-column index on product_images(product_id)
--    (covered by idx_product_images_sort_order ON (product_id, sort_order))
-- 4. Foreign key constraint on messages(sender_clerk_id) referencing profiles(clerk_id)
--    to enable single-roundtrip joined message sender queries in PostgREST
-- =============================================================

-- 1. Composite sort index for business buyer orders
CREATE INDEX IF NOT EXISTS idx_orders_business_created
  ON public.orders (business_clerk_id, created_at DESC);

-- 2. Composite sort index for farmer seller orders
CREATE INDEX IF NOT EXISTS idx_orders_farmer_created
  ON public.orders (farmer_clerk_id, created_at DESC);

-- 3. Foreign key index on cart_items(product_id)
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id
  ON public.cart_items (product_id);

-- 4. Drop redundant index covered by composite index (product_id, sort_order)
DROP INDEX IF EXISTS public.idx_product_images_product_id;

-- 5. Foreign key constraint for single-roundtrip message sender profile join
DO $$
BEGIN
  -- If constraint exists with any action other than RESTRICT, recreate it
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_sender_clerk_id_fkey'
      AND confdeltype != 'r'
  ) THEN
    ALTER TABLE public.messages DROP CONSTRAINT messages_sender_clerk_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_sender_clerk_id_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_sender_clerk_id_fkey
      FOREIGN KEY (sender_clerk_id) REFERENCES public.profiles(clerk_id)
      ON DELETE RESTRICT;
  END IF;
END $$;
