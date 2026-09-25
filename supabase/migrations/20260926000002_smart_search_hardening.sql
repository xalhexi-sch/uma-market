-- =============================================================
-- UMA Market — Smart Search & Discovery Hardening
-- Migration: 20260926000002_smart_search_hardening.sql
--
-- Remediations:
-- 1. HIGH-01: Functional GIN Trigram indexes on LOWER(column)
--    replaces raw indexes so PostgreSQL query planner can utilize index scans
-- 2. MED-01: Punctuation-only search (e.g. "???", "!@#$%") returns 0 matches
--    instead of neutralizing into full catalog browse
-- 3. MED-02: RPC parameter bounds (clamp search <= 100, limit [1, 100], offset >= 0)
-- 4. LOW-01: Null category & farmer relationships return SQL NULL instead of empty objects
-- 5. LOW-03: Empty category slug string normalized to NULL inside RPC
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. FUNCTIONAL GIN TRIGRAM INDEXES (HIGH-01)
-- ──────────────────────────────────────────────────────────────

-- Drop previous non-functional indexes if present
DROP INDEX IF EXISTS public.idx_products_name_trgm;
DROP INDEX IF EXISTS public.idx_products_description_trgm;
DROP INDEX IF EXISTS public.idx_categories_name_trgm;
DROP INDEX IF EXISTS public.idx_profiles_farmer_biz_trgm;
DROP INDEX IF EXISTS public.idx_profiles_farmer_name_trgm;

-- Functional GIN Trigram index on produce name (matches LOWER(p.name) LIKE and trigram similarity)
CREATE INDEX IF NOT EXISTS idx_products_name_lower_trgm
  ON public.products USING gin (lower(name) extensions.gin_trgm_ops);

-- Functional GIN Trigram index on produce description
CREATE INDEX IF NOT EXISTS idx_products_description_lower_trgm
  ON public.products USING gin (lower(description) extensions.gin_trgm_ops);

-- Functional GIN Trigram index on category names
CREATE INDEX IF NOT EXISTS idx_categories_name_lower_trgm
  ON public.categories USING gin (lower(name) extensions.gin_trgm_ops);

-- Functional GIN Trigram index on farmer business name
CREATE INDEX IF NOT EXISTS idx_profiles_farmer_biz_lower_trgm
  ON public.profiles USING gin (lower(business_name) extensions.gin_trgm_ops)
  WHERE role = 'farmer';

-- Functional GIN Trigram index on farmer full name
CREATE INDEX IF NOT EXISTS idx_profiles_farmer_name_lower_trgm
  ON public.profiles USING gin (lower(full_name) extensions.gin_trgm_ops)
  WHERE role = 'farmer';

-- ──────────────────────────────────────────────────────────────
-- 2. HARDENED SEARCH RPC: search_products (MED-01, MED-02, LOW-01, LOW-03)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_products(
  p_search TEXT DEFAULT NULL,
  p_category_slug TEXT DEFAULT NULL,
  p_in_stock_only BOOLEAN DEFAULT TRUE,
  p_sort TEXT DEFAULT 'relevance',
  p_limit INT DEFAULT 24,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  farmer_clerk_id TEXT,
  category_id UUID,
  name TEXT,
  description TEXT,
  price_per_unit NUMERIC(10,2),
  unit TEXT,
  quantity_available NUMERIC(10,2),
  min_order_quantity NUMERIC(10,2),
  image_url TEXT,
  image_path TEXT,
  harvest_date DATE,
  available_until DATE,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  category JSONB,
  farmer JSONB,
  images JSONB,
  search_rank REAL,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_raw TEXT := NULLIF(TRIM(p_search), '');
  v_q TEXT := NULL;
  v_clean TEXT := NULL;
  v_is_empty_punctuation BOOLEAN := FALSE;
  v_category_slug TEXT := NULLIF(TRIM(p_category_slug), '');
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 100);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF v_raw IS NOT NULL THEN
    -- Clamp search string to 100 chars (MED-02)
    v_raw := LEFT(v_raw, 100);
    v_q := LOWER(v_raw);
    -- Strip punctuation and collapse whitespace
    v_clean := TRIM(REGEXP_REPLACE(v_q, '[^a-z0-9\s]', ' ', 'g'));
    v_clean := TRIM(REGEXP_REPLACE(v_clean, '\s+', ' ', 'g'));
    -- If non-empty query contains no alphanumeric characters, flag as empty punctuation (MED-01)
    IF v_clean = '' THEN
      v_is_empty_punctuation := TRUE;
      v_clean := NULL;
    END IF;
  END IF;

  RETURN QUERY
  WITH scored_products AS (
    SELECT
      p.id,
      p.farmer_clerk_id,
      p.category_id,
      p.name,
      p.description,
      p.price_per_unit,
      p.unit,
      p.quantity_available,
      p.min_order_quantity,
      p.image_url,
      p.image_path,
      p.harvest_date,
      p.available_until,
      p.status,
      p.created_at,
      p.updated_at,
      CASE
        WHEN c.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'slug', c.slug,
          'icon', c.icon
        )
      END AS category,
      CASE
        WHEN f.clerk_id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'clerk_id', f.clerk_id,
          'full_name', f.full_name,
          'business_name', f.business_name,
          'city', f.city,
          'avatar_url', f.avatar_url,
          'bio', f.bio,
          'is_verified', COALESCE(f.is_verified, FALSE)
        )
      END AS farmer,
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', pi.id,
              'product_id', pi.product_id,
              'image_path', pi.image_path,
              'sort_order', pi.sort_order
            ) ORDER BY pi.sort_order ASC
          )
          FROM public.product_images pi
          WHERE pi.product_id = p.id
        ),
        '[]'::jsonb
      ) AS images,
      CASE
        WHEN v_q IS NULL OR v_is_empty_punctuation THEN 1.0::REAL
        ELSE (
          -- 1. Produce Name Match (Primary Anchor: exact, prefix, substring, trigram)
          (CASE
            WHEN LOWER(p.name) = v_q THEN 100.0
            WHEN LOWER(p.name) LIKE v_q || '%' THEN 60.0
            WHEN LOWER(p.name) LIKE '%' || v_q || '%' THEN 40.0
            ELSE 0.0
          END) +
          (extensions.word_similarity(v_q, LOWER(p.name)) * 40.0) +
          (extensions.similarity(LOWER(p.name), v_q) * 30.0) +
          -- 2. Category Name Match
          (CASE
            WHEN LOWER(c.name) LIKE '%' || v_q || '%' THEN 25.0
            ELSE extensions.word_similarity(v_q, LOWER(c.name)) * 20.0
          END) +
          -- 3. Farmer Provenance Match
          (CASE
            WHEN LOWER(COALESCE(f.business_name, '')) LIKE '%' || v_q || '%' THEN 20.0
            WHEN LOWER(COALESCE(f.full_name, '')) LIKE '%' || v_q || '%' THEN 15.0
            ELSE extensions.word_similarity(v_q, LOWER(COALESCE(f.business_name, ''))) * 15.0
          END) +
          -- 4. Description Keyword Match (Requires exact substring and length >= 3)
          (CASE
            WHEN v_clean IS NOT NULL AND LENGTH(v_clean) >= 3 AND LOWER(COALESCE(p.description, '')) LIKE '%' || v_clean || '%' THEN 15.0
            ELSE 0.0
          END)
        )::REAL
      END AS rank_score,
      -- Boolean match criteria: must meet at least one substantive match condition
      (
        CASE
          WHEN v_is_empty_punctuation THEN FALSE
          WHEN v_q IS NULL THEN TRUE
          ELSE (
            LOWER(p.name) LIKE '%' || v_q || '%'
            OR (v_clean IS NOT NULL AND LOWER(p.name) LIKE '%' || v_clean || '%')
            OR extensions.word_similarity(v_q, LOWER(p.name)) >= 0.45
            OR extensions.similarity(LOWER(p.name), v_q) >= 0.2
            OR LOWER(c.name) LIKE '%' || v_q || '%'
            OR extensions.word_similarity(v_q, LOWER(c.name)) >= 0.5
            OR LOWER(COALESCE(f.business_name, '')) LIKE '%' || v_q || '%'
            OR extensions.word_similarity(v_q, LOWER(COALESCE(f.business_name, ''))) >= 0.5
            OR LOWER(COALESCE(f.full_name, '')) LIKE '%' || v_q || '%'
            OR (v_clean IS NOT NULL AND LENGTH(v_clean) >= 3 AND LOWER(COALESCE(p.description, '')) LIKE '%' || v_clean || '%')
          )
        END
      ) AS is_match
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    LEFT JOIN public.profiles f ON f.clerk_id = p.farmer_clerk_id
    WHERE p.status = 'active'
      AND (NOT p_in_stock_only OR p.quantity_available > 0)
      AND (v_category_slug IS NULL OR c.slug = v_category_slug)
  )
  SELECT
    sp.id,
    sp.farmer_clerk_id,
    sp.category_id,
    sp.name,
    sp.description,
    sp.price_per_unit,
    sp.unit,
    sp.quantity_available,
    sp.min_order_quantity,
    sp.image_url,
    sp.image_path,
    sp.harvest_date,
    sp.available_until,
    sp.status,
    sp.created_at,
    sp.updated_at,
    sp.category,
    sp.farmer,
    sp.images,
    sp.rank_score AS search_rank,
    COUNT(*) OVER() AS total_count
  FROM scored_products sp
  WHERE sp.is_match = TRUE
  ORDER BY
    CASE WHEN v_q IS NOT NULL AND (p_sort IS NULL OR p_sort = 'relevance') THEN sp.rank_score END DESC NULLS LAST,
    CASE WHEN p_sort = 'price_asc' THEN sp.price_per_unit END ASC,
    CASE WHEN p_sort = 'price_desc' THEN sp.price_per_unit END DESC,
    CASE WHEN p_sort = 'harvest_newest' THEN sp.harvest_date END DESC NULLS LAST,
    CASE WHEN p_sort = 'name_asc' THEN sp.name END ASC,
    CASE WHEN p_sort = 'newest' OR (v_q IS NULL AND (p_sort IS NULL OR p_sort = 'relevance')) THEN sp.created_at END DESC,
    sp.id ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.search_products(TEXT, TEXT, BOOLEAN, TEXT, INT, INT)
  TO anon, authenticated, service_role;
