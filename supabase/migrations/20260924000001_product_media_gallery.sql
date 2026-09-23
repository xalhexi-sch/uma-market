-- =============================================================
-- UMA Market — Product Media Gallery
-- Migration: 20260924000001_product_media_gallery.sql
-- =============================================================

-- 1. Create product_images table
CREATE TABLE IF NOT EXISTS public.product_images (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_path  TEXT        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_product_images_path UNIQUE (product_id, image_path)
);

-- 2. Indexes for efficient lookup and ordered retrieval
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images (product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_sort_order ON public.product_images (product_id, sort_order);

-- 3. Row-Level Security
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "product_images: read active or own" ON public.product_images;
DROP POLICY IF EXISTS "product_images: farmer inserts own" ON public.product_images;
DROP POLICY IF EXISTS "product_images: farmer updates own" ON public.product_images;
DROP POLICY IF EXISTS "product_images: farmer deletes own" ON public.product_images;
DROP POLICY IF EXISTS "product_images: admin all" ON public.product_images;

-- SELECT: Public can view images for active products; farmers can view their own; admins view all
CREATE POLICY "product_images: read active or own"
  ON public.product_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_images.product_id
        AND (
          p.status = 'active'
          OR p.farmer_clerk_id = (auth.jwt()->>'sub')
          OR (auth.jwt()->>'user_role') = 'admin'
        )
    )
  );

-- INSERT: Farmers can insert images for products they own
CREATE POLICY "product_images: farmer inserts own"
  ON public.product_images FOR INSERT
  WITH CHECK (
    (auth.jwt()->>'user_role') = 'farmer'
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_images.product_id
        AND p.farmer_clerk_id = (auth.jwt()->>'sub')
    )
  );

-- UPDATE: Farmers can update sort order of images for products they own
CREATE POLICY "product_images: farmer updates own"
  ON public.product_images FOR UPDATE
  USING (
    (auth.jwt()->>'user_role') = 'farmer'
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_images.product_id
        AND p.farmer_clerk_id = (auth.jwt()->>'sub')
    )
  )
  WITH CHECK (
    (auth.jwt()->>'user_role') = 'farmer'
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_images.product_id
        AND p.farmer_clerk_id = (auth.jwt()->>'sub')
    )
  );

-- DELETE: Farmers can delete images for products they own
CREATE POLICY "product_images: farmer deletes own"
  ON public.product_images FOR DELETE
  USING (
    (auth.jwt()->>'user_role') = 'farmer'
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_images.product_id
        AND p.farmer_clerk_id = (auth.jwt()->>'sub')
    )
  );

-- ADMIN: Platform admins have full access
CREATE POLICY "product_images: admin all"
  ON public.product_images FOR ALL
  USING ((auth.jwt()->>'user_role') = 'admin')
  WITH CHECK ((auth.jwt()->>'user_role') = 'admin');

-- 4. Backfill existing products so current primary images appear in the gallery
INSERT INTO public.product_images (product_id, image_path, sort_order)
SELECT id, image_path, 0
FROM public.products
WHERE image_path IS NOT NULL AND TRIM(image_path) != ''
ON CONFLICT (product_id, image_path) DO NOTHING;
