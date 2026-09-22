-- =============================================================
-- UMA Market — Slice 4 Storage, Realtime & Produce Imagery
-- Migration: 20260923000001_slice4_storage.sql
-- =============================================================

-- 1. Add canonical image_path column to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_path TEXT;

-- 2. Ensure public.messages is published to supabase_realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

-- 3. Upsert product-images bucket configuration in storage.buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 4. Storage Row-Level Security Policies on storage.objects

-- Drop any existing conflicting policies if re-running
DROP POLICY IF EXISTS "product_images: public read" ON storage.objects;
DROP POLICY IF EXISTS "product_images: farmer upload own" ON storage.objects;
DROP POLICY IF EXISTS "product_images: farmer update own" ON storage.objects;
DROP POLICY IF EXISTS "product_images: farmer delete own" ON storage.objects;

-- Public can read images in product-images bucket
CREATE POLICY "product_images: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Farmers can insert images only into their own folder: products/{farmer_clerk_id}/*
CREATE POLICY "product_images: farmer upload own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND (auth.jwt()->>'user_role') = 'farmer'
    AND name LIKE ('products/' || (auth.jwt()->>'sub') || '/%')
  );

-- Farmers can update only their own uploaded images
CREATE POLICY "product_images: farmer update own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images'
    AND (auth.jwt()->>'user_role') = 'farmer'
    AND name LIKE ('products/' || (auth.jwt()->>'sub') || '/%')
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND (auth.jwt()->>'user_role') = 'farmer'
    AND name LIKE ('products/' || (auth.jwt()->>'sub') || '/%')
  );

-- Farmers can delete only their own uploaded images
CREATE POLICY "product_images: farmer delete own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND (auth.jwt()->>'user_role') = 'farmer'
    AND name LIKE ('products/' || (auth.jwt()->>'sub') || '/%')
  );
