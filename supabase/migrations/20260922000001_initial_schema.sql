-- =============================================================
-- UMA Market — Initial Schema
-- Migration: 20260922000001_initial_schema
--
-- Auth model:
--   auth.jwt()->>'sub'        → Clerk user ID (text, e.g. "user_abc123")
--   auth.jwt()->>'user_role'  → UMA role: farmer | business | admin
--   auth.jwt()->>'role'       → Postgres role: always "authenticated"
--   auth.uid()                → NULL (not used; Supabase Auth not active)
--
-- All RLS user identification uses auth.jwt()->>'sub', NOT auth.uid().
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- Utility: auto-update updated_at
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ──────────────────────────────────────────────────────────────
-- profiles
-- One row per Clerk user, created during onboarding.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id    TEXT        NOT NULL UNIQUE,
  role        TEXT        NOT NULL
                            CHECK (role IN ('farmer', 'business', 'admin')),
  full_name   TEXT,
  phone       TEXT,
  address     TEXT,
  city        TEXT        NOT NULL DEFAULT 'Butuan',
  bio         TEXT,
  avatar_url  TEXT,
  is_verified BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_clerk_id ON public.profiles (clerk_id);
CREATE INDEX idx_profiles_role     ON public.profiles (role);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Own profile: always readable
CREATE POLICY "profiles: read own"
  ON public.profiles FOR SELECT
  USING (auth.jwt()->>'sub' = clerk_id);

-- Businesses can see farmer profiles (marketplace browsing)
CREATE POLICY "profiles: business reads farmer"
  ON public.profiles FOR SELECT
  USING (
    (auth.jwt()->>'user_role') = 'business'
    AND role = 'farmer'
  );

-- Farmers can see business profiles (order fulfillment context)
CREATE POLICY "profiles: farmer reads business"
  ON public.profiles FOR SELECT
  USING (
    (auth.jwt()->>'user_role') = 'farmer'
    AND role = 'business'
  );

-- Admin: read all
CREATE POLICY "profiles: admin reads all"
  ON public.profiles FOR SELECT
  USING ((auth.jwt()->>'user_role') = 'admin');

-- Users update their own profile
CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  USING  (auth.jwt()->>'sub' = clerk_id)
  WITH CHECK (auth.jwt()->>'sub' = clerk_id);

-- Admin: update all (verification, moderation)
CREATE POLICY "profiles: admin updates all"
  ON public.profiles FOR UPDATE
  USING ((auth.jwt()->>'user_role') = 'admin');

-- ──────────────────────────────────────────────────────────────
-- categories
-- Seeded by migration; managed by admin.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  slug        TEXT        NOT NULL UNIQUE,
  description TEXT,
  icon        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Public: everyone authenticated can read categories
CREATE POLICY "categories: authenticated read"
  ON public.categories FOR SELECT
  USING (true);

-- Only admins can write categories
CREATE POLICY "categories: admin write"
  ON public.categories FOR ALL
  USING ((auth.jwt()->>'user_role') = 'admin')
  WITH CHECK ((auth.jwt()->>'user_role') = 'admin');

-- Seed — matches CATEGORIES in src/lib/constants.ts
INSERT INTO public.categories (name, slug, description, icon) VALUES
  ('Vegetables',    'vegetables',   'Fresh vegetables from local farms',              'ri-plant-line'),
  ('Fruits',        'fruits',       'Seasonal and tropical fruits',                   'ri-apple-line'),
  ('Rice & Grains', 'rice-grains',  'Rice, corn, and other grains',                  'ri-seedling-line'),
  ('Root Crops',    'root-crops',   'Cassava, camote, gabi, and more',                'ri-leaf-line'),
  ('Herbs & Spices','herbs-spices', 'Local herbs, spices, and aromatics',             'ri-plant-line'),
  ('Poultry & Eggs','poultry-eggs', 'Chicken, duck, quail, and eggs',                 'ri-checkbox-blank-circle-line'),
  ('Fish & Seafood','fish-seafood', 'Fresh catch and aquaculture products',           'ri-fish-line'),
  ('Other',         'other',        'Other agricultural and farm products',           'ri-archive-line');

-- ──────────────────────────────────────────────────────────────
-- products
-- Owned by a farmer (clerk_id). Each row is a single listing.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.products (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_clerk_id    TEXT        NOT NULL,
  category_id        UUID        REFERENCES public.categories(id) ON DELETE SET NULL,
  name               TEXT        NOT NULL,
  description        TEXT,
  price_per_unit     NUMERIC(10,2) NOT NULL CHECK (price_per_unit >= 0),
  unit               TEXT        NOT NULL DEFAULT 'kg',
  quantity_available NUMERIC(10,2) NOT NULL DEFAULT 0
                                   CHECK (quantity_available >= 0),
  min_order_quantity NUMERIC(10,2) NOT NULL DEFAULT 1
                                   CHECK (min_order_quantity > 0),
  image_url          TEXT,
  -- Matches PRODUCT_STATUS in constants.ts
  status             TEXT        NOT NULL DEFAULT 'active'
                                   CHECK (status IN ('active', 'draft', 'out_of_stock', 'archived')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_farmer_clerk_id ON public.products (farmer_clerk_id);
CREATE INDEX idx_products_status          ON public.products (status);
CREATE INDEX idx_products_category_id     ON public.products (category_id);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can browse active products
CREATE POLICY "products: read active"
  ON public.products FOR SELECT
  USING (status = 'active');

-- Farmers see all their own products (including draft/archived)
CREATE POLICY "products: farmer reads own"
  ON public.products FOR SELECT
  USING (auth.jwt()->>'sub' = farmer_clerk_id);

-- Farmers insert their own products
CREATE POLICY "products: farmer inserts"
  ON public.products FOR INSERT
  WITH CHECK (
    auth.jwt()->>'sub' = farmer_clerk_id
    AND (auth.jwt()->>'user_role') = 'farmer'
  );

-- Farmers update their own products
CREATE POLICY "products: farmer updates own"
  ON public.products FOR UPDATE
  USING  (auth.jwt()->>'sub' = farmer_clerk_id)
  WITH CHECK (auth.jwt()->>'sub' = farmer_clerk_id);

-- Farmers delete their own products
CREATE POLICY "products: farmer deletes own"
  ON public.products FOR DELETE
  USING (auth.jwt()->>'sub' = farmer_clerk_id);

-- Admin: full access
CREATE POLICY "products: admin all"
  ON public.products FOR ALL
  USING ((auth.jwt()->>'user_role') = 'admin')
  WITH CHECK ((auth.jwt()->>'user_role') = 'admin');

-- ──────────────────────────────────────────────────────────────
-- cart_items
-- Per-business, per-product line. On order placement this is cleared.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.cart_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_clerk_id TEXT        NOT NULL,
  product_id        UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity          NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_clerk_id, product_id)
);

CREATE INDEX idx_cart_items_business ON public.cart_items (business_clerk_id);

CREATE TRIGGER trg_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- Businesses manage their own cart (all operations)
CREATE POLICY "cart_items: business manages own"
  ON public.cart_items FOR ALL
  USING (
    auth.jwt()->>'sub' = business_clerk_id
    AND (auth.jwt()->>'user_role') = 'business'
  )
  WITH CHECK (
    auth.jwt()->>'sub' = business_clerk_id
    AND (auth.jwt()->>'user_role') = 'business'
  );

-- ──────────────────────────────────────────────────────────────
-- orders
-- Created by a business, directed to a specific farmer.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.orders (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_clerk_id TEXT        NOT NULL,
  farmer_clerk_id   TEXT        NOT NULL,
  -- Matches ORDER_STATUS in constants.ts
  status            TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN (
                                    'pending', 'accepted', 'preparing',
                                    'ready', 'for_delivery', 'completed', 'cancelled'
                                  )),
  -- Matches FULFILLMENT_TYPE in constants.ts
  fulfillment_type  TEXT        NOT NULL DEFAULT 'pickup'
                                  CHECK (fulfillment_type IN ('pickup', 'seller_delivery')),
  total_amount      NUMERIC(10,2) CHECK (total_amount >= 0),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_business ON public.orders (business_clerk_id);
CREATE INDEX idx_orders_farmer   ON public.orders (farmer_clerk_id);
CREATE INDEX idx_orders_status   ON public.orders (status);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Businesses read their own orders
CREATE POLICY "orders: business reads own"
  ON public.orders FOR SELECT
  USING (auth.jwt()->>'sub' = business_clerk_id);

-- Farmers read orders directed to them
CREATE POLICY "orders: farmer reads own"
  ON public.orders FOR SELECT
  USING (auth.jwt()->>'sub' = farmer_clerk_id);

-- Businesses place orders
CREATE POLICY "orders: business inserts"
  ON public.orders FOR INSERT
  WITH CHECK (
    auth.jwt()->>'sub' = business_clerk_id
    AND (auth.jwt()->>'user_role') = 'business'
  );

-- Businesses can cancel their own pending orders
CREATE POLICY "orders: business cancels pending"
  ON public.orders FOR UPDATE
  USING (
    auth.jwt()->>'sub' = business_clerk_id
    AND status = 'pending'
  )
  WITH CHECK (
    auth.jwt()->>'sub' = business_clerk_id
    AND status = 'cancelled'
  );

-- Farmers update status of orders directed to them
CREATE POLICY "orders: farmer updates status"
  ON public.orders FOR UPDATE
  USING (auth.jwt()->>'sub' = farmer_clerk_id)
  WITH CHECK (auth.jwt()->>'sub' = farmer_clerk_id);

-- Admin: full access
CREATE POLICY "orders: admin all"
  ON public.orders FOR ALL
  USING ((auth.jwt()->>'user_role') = 'admin')
  WITH CHECK ((auth.jwt()->>'user_role') = 'admin');

-- ──────────────────────────────────────────────────────────────
-- order_items
-- Line items for an order. Immutable after creation.
-- Stores unit_price at time of order (price may change later).
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.order_items (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID        NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity   NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  subtotal   NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order   ON public.order_items (order_id);
CREATE INDEX idx_order_items_product ON public.order_items (product_id);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Business on the order can read its items
CREATE POLICY "order_items: business reads own"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.business_clerk_id = auth.jwt()->>'sub'
    )
  );

-- Farmer on the order can read its items
CREATE POLICY "order_items: farmer reads own"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.farmer_clerk_id = auth.jwt()->>'sub'
    )
  );

-- Only businesses insert order items at order creation
CREATE POLICY "order_items: business inserts"
  ON public.order_items FOR INSERT
  WITH CHECK (
    (auth.jwt()->>'user_role') = 'business'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.business_clerk_id = auth.jwt()->>'sub'
    )
  );

-- Admin: full access
CREATE POLICY "order_items: admin all"
  ON public.order_items FOR ALL
  USING ((auth.jwt()->>'user_role') = 'admin')
  WITH CHECK ((auth.jwt()->>'user_role') = 'admin');

-- ──────────────────────────────────────────────────────────────
-- messages
-- Threaded per order. Both parties (business + farmer) can read and send.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_clerk_id  TEXT        NOT NULL,
  body             TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_order  ON public.messages (order_id);
CREATE INDEX idx_messages_sender ON public.messages (sender_clerk_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Order participants read messages on their orders
CREATE POLICY "messages: participants read"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND (
          o.business_clerk_id = auth.jwt()->>'sub'
          OR o.farmer_clerk_id = auth.jwt()->>'sub'
        )
    )
  );

-- Order participants send messages on their orders
CREATE POLICY "messages: participants insert"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.jwt()->>'sub' = sender_clerk_id
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND (
          o.business_clerk_id = auth.jwt()->>'sub'
          OR o.farmer_clerk_id = auth.jwt()->>'sub'
        )
    )
  );

-- Admin: full access
CREATE POLICY "messages: admin all"
  ON public.messages FOR ALL
  USING ((auth.jwt()->>'user_role') = 'admin')
  WITH CHECK ((auth.jwt()->>'user_role') = 'admin');
