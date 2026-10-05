-- =============================================================================
-- UMA Market V4 — Business & Cart Foundation Migration
--
-- 1. Create businesses table (buyer, seller, or both).
-- 2. Create business_members table (OWNER | STAFF).
-- 3. Add additive business_id column to cart_items.
-- 4. Enable RLS on businesses and business_members.
-- 5. Update cart_items RLS to support both V4 business membership and V2 legacy.
-- 6. Idempotently backfill existing profiles into businesses + business_members.
-- 7. Backfill existing cart_items.business_id from legacy_clerk_id.
-- =============================================================================

-- ── 1. Create businesses table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.businesses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  can_buy           BOOLEAN NOT NULL DEFAULT true,
  can_sell          BOOLEAN NOT NULL DEFAULT false,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  legacy_clerk_id   TEXT UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_businesses_status ON public.businesses (status);
CREATE INDEX IF NOT EXISTS idx_businesses_legacy_clerk_id ON public.businesses (legacy_clerk_id);

DROP TRIGGER IF EXISTS trg_businesses_updated_at ON public.businesses;
CREATE TRIGGER trg_businesses_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ── 2. Create business_members table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.business_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id           TEXT NOT NULL,
  role              TEXT NOT NULL CHECK (role IN ('OWNER', 'STAFF')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_business_members_user_id ON public.business_members (user_id);
CREATE INDEX IF NOT EXISTS idx_business_members_business_id ON public.business_members (business_id);

DROP TRIGGER IF EXISTS trg_business_members_updated_at ON public.business_members;
CREATE TRIGGER trg_business_members_updated_at
  BEFORE UPDATE ON public.business_members
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ── 3. Enable RLS on businesses & business_members ────────────────────────────
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "businesses: members can view their businesses" ON public.businesses;
DROP POLICY IF EXISTS "businesses: public can view active seller businesses" ON public.businesses;
DROP POLICY IF EXISTS "businesses: owner can update business" ON public.businesses;
DROP POLICY IF EXISTS "business_members: members can view business memberships" ON public.business_members;

-- Businesses: members can view their own businesses
CREATE POLICY "businesses: members can view their businesses"
  ON public.businesses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.business_id = businesses.id
        AND bm.user_id = (auth.jwt()->>'sub')
    )
  );

-- Businesses: public can view active businesses with selling capability
CREATE POLICY "businesses: public can view active seller businesses"
  ON public.businesses FOR SELECT
  USING (status = 'active' AND can_sell = true);

-- Businesses: owners can update their business
CREATE POLICY "businesses: owner can update business"
  ON public.businesses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.business_id = businesses.id
        AND bm.user_id = (auth.jwt()->>'sub')
        AND bm.role = 'OWNER'
    )
  );

-- Business Members: users can view their own memberships (direct column match, no RLS recursion)
CREATE POLICY "business_members: members can view business memberships"
  ON public.business_members FOR SELECT
  USING (
    user_id = (auth.jwt()->>'sub')
  );


-- ── 4. Additive update to cart_items ──────────────────────────────────────────
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_cart_items_business_id
  ON public.cart_items (business_id);

-- Replace legacy whole-table constraint with scoped unique indexes:
-- 1. V4: unique per (business_id, product_id)
-- 2. V2 fallback: unique per (business_clerk_id, product_id) where business_id is NULL
ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_business_clerk_id_product_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_business_product
  ON public.cart_items (business_id, product_id)
  WHERE business_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_legacy_user_product
  ON public.cart_items (business_clerk_id, product_id)
  WHERE business_id IS NULL;


-- ── 5. Update cart_items RLS for V4 business and V2 backward-compatibility ───
DROP POLICY IF EXISTS "cart_items: business manages own" ON public.cart_items;
DROP POLICY IF EXISTS "cart_items: member manages business cart or legacy own" ON public.cart_items;

CREATE POLICY "cart_items: member manages business cart or legacy own"
  ON public.cart_items FOR ALL
  USING (
    (
      business_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.business_members bm
        JOIN public.businesses b ON b.id = bm.business_id
        WHERE bm.business_id = cart_items.business_id
          AND bm.user_id = (auth.jwt()->>'sub')
          AND b.can_buy = true
          AND b.status = 'active'
      )
    )
    OR
    (
      business_id IS NULL
      AND auth.jwt()->>'sub' = business_clerk_id
      AND (auth.jwt()->>'user_role') = 'business'
    )
  )
  WITH CHECK (
    (
      business_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.business_members bm
        JOIN public.businesses b ON b.id = bm.business_id
        WHERE bm.business_id = cart_items.business_id
          AND bm.user_id = (auth.jwt()->>'sub')
          AND b.can_buy = true
          AND b.status = 'active'
      )
    )
    OR
    (
      business_id IS NULL
      AND auth.jwt()->>'sub' = business_clerk_id
      AND (auth.jwt()->>'user_role') = 'business'
    )
  );

-- ── 6. Idempotent Backfill from profiles ──────────────────────────────────────
INSERT INTO public.businesses (id, name, can_buy, can_sell, status, legacy_clerk_id)
SELECT
  gen_random_uuid(),
  COALESCE(business_name, full_name, 'Business'),
  CASE WHEN role = 'farmer' THEN false ELSE true END,
  CASE WHEN role = 'farmer' THEN true ELSE false END,
  COALESCE(status, 'active'),
  clerk_id
FROM public.profiles
ON CONFLICT (legacy_clerk_id) DO NOTHING;

INSERT INTO public.business_members (business_id, user_id, role)
SELECT
  b.id,
  b.legacy_clerk_id,
  'OWNER'
FROM public.businesses b
WHERE b.legacy_clerk_id IS NOT NULL
ON CONFLICT (business_id, user_id) DO NOTHING;

-- Backfill existing cart_items with business_id
UPDATE public.cart_items c
SET business_id = b.id
FROM public.businesses b
WHERE c.business_id IS NULL
  AND c.business_clerk_id = b.legacy_clerk_id;
