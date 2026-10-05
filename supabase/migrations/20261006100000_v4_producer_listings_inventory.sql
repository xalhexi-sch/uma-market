-- =============================================================================
-- UMA Market V4 — Producer Operations: business-owned listings + inventory ledger
-- Migration: 20261006100000_v4_producer_listings_inventory.sql
--
-- 1. products.business_id (additive, nullable) + idempotent backfill from
--    businesses.legacy_clerk_id = products.farmer_clerk_id.
-- 2. inventory_movements: append-only stock ledger. products.quantity_available
--    stays the fast current balance.
-- 3. Triggers on products:
--    a. trg_products_10_guard_client_writes (BEFORE, invoker): a direct client
--       write (role authenticated/anon) may not change quantity_available or
--       business_id; a client-supplied business_id on INSERT is discarded.
--       Closes the legacy last-write-wins stock path.
--    b. trg_products_20_derive_business (BEFORE INSERT, definer): fills
--       business_id for legacy inserts from the farmer's business.
--    c. trg_products_90_record_inventory_movement (AFTER, definer): every
--       change to quantity_available writes exactly one ledger row in the
--       same transaction, whichever trusted path made it (producer RPC,
--       checkout, cancellation restock, service role).
-- 4. Trusted producer RPCs (SECURITY DEFINER; membership, SELL capability,
--    active business and active caller are checked in SQL):
--      create_business_listing, update_business_listing,
--      set_business_listing_status, adjust_business_inventory.
-- 5. Read RLS for SELL-business members on products, product_images and
--    inventory_movements; storage upload into the member's own folder.
--
-- Checkout RPCs (place_order, place_checkout_orders, place_v4_checkout_orders)
-- and the cancellation restock trigger are NOT modified.
--
-- Contract for future trusted functions that change stock: set the
-- transaction-local setting `uma.inventory_context` to
-- {"type": <movement type>, "reason": <text|null>} before the UPDATE and clear
-- it afterwards. Without it, an authenticated decrement is recorded as SOLD,
-- a nested (trigger) increment as RELEASED, anything else as ADJUSTMENT.
--
-- Error codes raised by this migration's functions:
--   42501  not allowed (caller, membership, capability, direct stock write)
--   UMV01  validation — message is user-safe
--   UMC01  state conflict — message is user-safe
--   UMN01  listing not found in the business
-- =============================================================================

-- Block concurrent product writes for the rest of the transaction so the
-- opening-balance backfill and the ledger trigger see one consistent state.
LOCK TABLE public.products IN SHARE ROW EXCLUSIVE MODE;

-- ── 1. products.business_id ─────────────────────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_business_id ON public.products (business_id);

COMMENT ON COLUMN public.products.business_id IS
  'V4: business that owns this listing. farmer_clerk_id stays the legacy owner during migration.';

-- Backfill without touching updated_at (it drives "recently updated" ordering).
ALTER TABLE public.products DISABLE TRIGGER trg_products_updated_at;

UPDATE public.products p
SET    business_id = b.id
FROM   public.businesses b
WHERE  p.business_id IS NULL
  AND  b.legacy_clerk_id = p.farmer_clerk_id;

ALTER TABLE public.products ENABLE TRIGGER trg_products_updated_at;

-- ── 2. inventory_movements ledger ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  business_id     UUID          REFERENCES public.businesses(id) ON DELETE SET NULL,
  movement_type   TEXT          NOT NULL
                                CHECK (movement_type IN ('OPENING', 'RECEIVED', 'SOLD', 'RELEASED', 'SPOILAGE', 'ADJUSTMENT')),
  quantity_delta  NUMERIC(12,2) NOT NULL CHECK (quantity_delta <> 0),
  balance_after   NUMERIC(12,2) NOT NULL CHECK (balance_after >= 0),
  reason          TEXT          CHECK (reason IS NULL OR char_length(reason) <= 500),
  reference_type  TEXT          CHECK (reference_type IS NULL OR reference_type = 'order'),
  reference_id    UUID,
  created_by      TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.inventory_movements IS
  'V4: append-only stock ledger. One row per change to products.quantity_available, written by trg_products_90_record_inventory_movement.';

-- Business activity feed (/dashboard/inventory) and per-product history.
CREATE INDEX IF NOT EXISTS idx_inventory_movements_business_created
  ON public.inventory_movements (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_created
  ON public.inventory_movements (product_id, created_at DESC);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Append-only for clients: rows are written only by the definer trigger.
REVOKE ALL ON public.inventory_movements FROM anon, authenticated;
GRANT SELECT ON public.inventory_movements TO authenticated;

-- Opening balances so SUM(quantity_delta) = quantity_available for every product.
INSERT INTO public.inventory_movements (
  product_id, business_id, movement_type, quantity_delta, balance_after, reason
)
SELECT p.id, p.business_id, 'OPENING', p.quantity_available, p.quantity_available,
       'Ledger opening balance'
FROM   public.products p
WHERE  p.quantity_available > 0
  AND  NOT EXISTS (
         SELECT 1 FROM public.inventory_movements m WHERE m.product_id = p.id
       );

-- ── 3. Membership helper + product triggers ─────────────────────────────────

-- Businesses where the caller is a member AND the business is active with
-- SELL capability. Used by RLS policies as an uncorrelated subquery.
CREATE OR REPLACE FUNCTION public.current_seller_business_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bm.business_id
  FROM   public.business_members bm
  JOIN   public.businesses b ON b.id = bm.business_id
  WHERE  bm.user_id = (auth.jwt()->>'sub')
    AND  b.can_sell = true
    AND  b.status = 'active';
$$;

REVOKE ALL ON FUNCTION public.current_seller_business_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_seller_business_ids() TO authenticated;

-- 3a. Guard direct client writes. SECURITY INVOKER on purpose: current_user is
-- 'authenticated'/'anon' only for a direct PostgREST write; inside a SECURITY
-- DEFINER function (checkout, producer RPCs, restock trigger) it is the owner.
CREATE OR REPLACE FUNCTION public.trigger_guard_product_client_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Ownership is derived server-side, never chosen by the client.
    NEW.business_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.quantity_available IS DISTINCT FROM OLD.quantity_available THEN
    RAISE EXCEPTION 'Stock can only be changed through inventory actions'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.business_id IS DISTINCT FROM OLD.business_id THEN
    RAISE EXCEPTION 'Listing ownership cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_10_guard_client_writes ON public.products;
CREATE TRIGGER trg_products_10_guard_client_writes
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_guard_product_client_writes();

-- 3b. Derive business_id for legacy (farmer_clerk_id-only) inserts.
CREATE OR REPLACE FUNCTION public.trigger_derive_product_business()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.business_id IS NULL THEN
    NEW.business_id := (
      SELECT b.id FROM public.businesses b WHERE b.legacy_clerk_id = NEW.farmer_clerk_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_20_derive_business ON public.products;
CREATE TRIGGER trg_products_20_derive_business
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_derive_product_business();

-- 3c. Ledger writer: exactly one movement per stock change, same transaction.
CREATE OR REPLACE FUNCTION public.trigger_record_inventory_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta     NUMERIC(12,2);
  v_context   JSONB;
  v_type      TEXT;
  v_reason    TEXT;
  v_ref_type  TEXT;
  v_ref_id    UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_delta := NEW.quantity_available;
  ELSE
    v_delta := NEW.quantity_available - OLD.quantity_available;
  END IF;

  IF v_delta IS NULL OR v_delta = 0 THEN
    RETURN NULL;
  END IF;

  v_context := NULLIF(current_setting('uma.inventory_context', true), '')::JSONB;

  IF v_context IS NOT NULL THEN
    -- Producer RPC: explicit movement type + reason.
    v_type   := v_context->>'type';
    v_reason := v_context->>'reason';
  ELSIF TG_OP = 'INSERT' THEN
    v_type := 'OPENING';
  ELSIF v_delta > 0 AND pg_trigger_depth() > 1 THEN
    -- Restock fired from trg_restore_stock_on_cancelled on public.orders.
    v_type := 'RELEASED';
    v_ref_type := 'order';
    SELECT o.id INTO v_ref_id
    FROM   public.orders o
    JOIN   public.order_items oi ON oi.order_id = o.id
    WHERE  oi.product_id = NEW.id
      AND  o.status = 'cancelled'
      AND  o.updated_at = NOW()
    LIMIT  1;
  ELSIF v_delta < 0 AND (auth.jwt()->>'role') = 'authenticated' THEN
    -- Checkout RPC decrement; its order line was inserted in this transaction.
    v_type := 'SOLD';
    v_ref_type := 'order';
    SELECT oi.order_id INTO v_ref_id
    FROM   public.order_items oi
    WHERE  oi.product_id = NEW.id
      AND  oi.created_at = NOW()
    LIMIT  1;
  ELSE
    v_type   := 'ADJUSTMENT';
    v_reason := 'System adjustment';
  END IF;

  IF v_ref_id IS NULL THEN
    v_ref_type := NULL;
  END IF;

  INSERT INTO public.inventory_movements (
    product_id, business_id, movement_type, quantity_delta, balance_after,
    reason, reference_type, reference_id, created_by
  ) VALUES (
    NEW.id, NEW.business_id, v_type, v_delta, NEW.quantity_available,
    v_reason, v_ref_type, v_ref_id, auth.jwt()->>'sub'
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_90_record_inventory_movement ON public.products;
CREATE TRIGGER trg_products_90_record_inventory_movement
  AFTER INSERT OR UPDATE OF quantity_available ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_record_inventory_movement();

-- ── 4. Trusted producer RPCs ────────────────────────────────────────────────

-- Internal: authenticated + active profile + member + active business + SELL.
-- Returns the caller's Clerk id. Not callable by clients.
CREATE OR REPLACE FUNCTION public.require_business_seller_access(p_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller          TEXT := auth.jwt()->>'sub';
  v_profile_status  TEXT;
  v_business_status TEXT;
  v_can_sell        BOOLEAN;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_profile_status FROM public.profiles WHERE clerk_id = v_caller;
  IF v_profile_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Account is not active' USING ERRCODE = '42501';
  END IF;

  IF p_business_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = p_business_id AND bm.user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'Not a member of the specified business' USING ERRCODE = '42501';
  END IF;

  SELECT b.status, b.can_sell INTO v_business_status, v_can_sell
  FROM public.businesses b WHERE b.id = p_business_id;

  IF v_business_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Business is not active' USING ERRCODE = '42501';
  END IF;
  IF v_can_sell IS NOT TRUE THEN
    RAISE EXCEPTION 'This business does not have selling capability' USING ERRCODE = '42501';
  END IF;

  RETURN v_caller;
END;
$$;

REVOKE ALL ON FUNCTION public.require_business_seller_access(UUID) FROM PUBLIC, anon, authenticated;

-- Internal: shared listing field rules (mirrors ListingInputSchema in the app).
CREATE OR REPLACE FUNCTION public.validate_listing_fields(
  p_name               TEXT,
  p_description        TEXT,
  p_price_per_unit     NUMERIC,
  p_min_order_quantity NUMERIC,
  p_harvest_date       DATE,
  p_available_until    DATE
)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_name IS NULL OR char_length(btrim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Listing name is required.' USING ERRCODE = 'UMV01';
  END IF;
  IF char_length(btrim(p_name)) > 200 THEN
    RAISE EXCEPTION 'Listing name must be 200 characters or fewer.' USING ERRCODE = 'UMV01';
  END IF;
  IF p_description IS NOT NULL AND char_length(p_description) > 5000 THEN
    RAISE EXCEPTION 'Description must be 5000 characters or fewer.' USING ERRCODE = 'UMV01';
  END IF;
  IF p_price_per_unit IS NULL OR p_price_per_unit <= 0 THEN
    RAISE EXCEPTION 'Price must be greater than 0.' USING ERRCODE = 'UMV01';
  END IF;
  IF p_price_per_unit > 99999999.99 OR p_price_per_unit <> round(p_price_per_unit, 2) THEN
    RAISE EXCEPTION 'Enter a price with up to 2 decimal places.' USING ERRCODE = 'UMV01';
  END IF;
  IF p_min_order_quantity IS NULL OR p_min_order_quantity <= 0 THEN
    RAISE EXCEPTION 'Minimum order must be greater than 0.' USING ERRCODE = 'UMV01';
  END IF;
  IF p_min_order_quantity > 99999999.99 OR p_min_order_quantity <> round(p_min_order_quantity, 2) THEN
    RAISE EXCEPTION 'Enter a minimum order with up to 2 decimal places.' USING ERRCODE = 'UMV01';
  END IF;
  IF p_harvest_date IS NOT NULL AND p_available_until IS NOT NULL
     AND p_available_until < p_harvest_date THEN
    RAISE EXCEPTION 'Available-until date cannot be before the harvest date.' USING ERRCODE = 'UMV01';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_listing_fields(TEXT, TEXT, NUMERIC, NUMERIC, DATE, DATE)
  FROM PUBLIC, anon, authenticated;

-- Internal: photo paths. New uploads must be in the caller's own storage
-- folder; paths already attached to the listing may be kept or reordered.
CREATE OR REPLACE FUNCTION public.validate_listing_image_paths(
  p_image_paths    TEXT[],
  p_caller         TEXT,
  p_existing_paths TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_path TEXT;
BEGIN
  IF p_image_paths IS NULL THEN
    RETURN;
  END IF;
  IF cardinality(p_image_paths) > 5 THEN
    RAISE EXCEPTION 'A listing can have up to 5 photos.' USING ERRCODE = 'UMV01';
  END IF;
  IF cardinality(p_image_paths) <> (SELECT count(DISTINCT x) FROM unnest(p_image_paths) AS x) THEN
    RAISE EXCEPTION 'Each photo can only be added once.' USING ERRCODE = 'UMV01';
  END IF;

  FOREACH v_path IN ARRAY p_image_paths LOOP
    IF v_path IS NULL THEN
      RAISE EXCEPTION 'Invalid photo.' USING ERRCODE = 'UMV01';
    END IF;
    CONTINUE WHEN v_path = ANY (COALESCE(p_existing_paths, ARRAY[]::TEXT[]));
    IF NOT starts_with(v_path, 'products/' || p_caller || '/')
       OR v_path !~ '^products/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$' THEN
      RAISE EXCEPTION 'Invalid photo.' USING ERRCODE = 'UMV01';
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_listing_image_paths(TEXT[], TEXT, TEXT[])
  FROM PUBLIC, anon, authenticated;

-- 4a. Create a listing owned by the business. Opening stock is recorded as an
-- OPENING movement by the ledger trigger.
CREATE OR REPLACE FUNCTION public.create_business_listing(
  p_business_id        UUID,
  p_name               TEXT,
  p_category_id        UUID,
  p_description        TEXT,
  p_price_per_unit     NUMERIC,
  p_unit               TEXT,
  p_min_order_quantity NUMERIC,
  p_opening_quantity   NUMERIC,
  p_harvest_date       DATE,
  p_available_until    DATE,
  p_status             TEXT,
  p_image_paths        TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller     TEXT;
  v_owner      TEXT;
  v_product_id UUID;
  v_images     TEXT[] := COALESCE(p_image_paths, ARRAY[]::TEXT[]);
BEGIN
  v_caller := public.require_business_seller_access(p_business_id);

  PERFORM public.validate_listing_fields(
    p_name, p_description, p_price_per_unit, p_min_order_quantity,
    p_harvest_date, p_available_until
  );

  IF p_unit IS NULL OR p_unit NOT IN ('kg', 'g', 'bundle', 'piece', 'sack', 'crate', 'tray') THEN
    RAISE EXCEPTION 'Choose a valid unit.' USING ERRCODE = 'UMV01';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('active', 'draft') THEN
    RAISE EXCEPTION 'New listings are either published or saved as a draft.' USING ERRCODE = 'UMV01';
  END IF;
  IF p_opening_quantity IS NULL OR p_opening_quantity < 0 THEN
    RAISE EXCEPTION 'Opening stock cannot be negative.' USING ERRCODE = 'UMV01';
  END IF;
  IF p_opening_quantity > 99999999.99 OR p_opening_quantity <> round(p_opening_quantity, 2) THEN
    RAISE EXCEPTION 'Enter opening stock with up to 2 decimal places.' USING ERRCODE = 'UMV01';
  END IF;
  IF p_category_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = p_category_id) THEN
    RAISE EXCEPTION 'Choose a valid category.' USING ERRCODE = 'UMV01';
  END IF;

  PERFORM public.validate_listing_image_paths(v_images, v_caller, ARRAY[]::TEXT[]);

  -- The legacy seller identity (used by checkout/orders) stays the business's
  -- legacy owner when there is one, matching place_v4_checkout_orders.
  SELECT COALESCE(b.legacy_clerk_id, v_caller) INTO v_owner
  FROM public.businesses b WHERE b.id = p_business_id;

  PERFORM set_config(
    'uma.inventory_context',
    jsonb_build_object('type', 'OPENING', 'reason', 'Opening stock')::TEXT,
    true
  );

  INSERT INTO public.products (
    farmer_clerk_id, business_id, category_id, name, description,
    price_per_unit, unit, quantity_available, min_order_quantity,
    harvest_date, available_until, status, image_path
  ) VALUES (
    v_owner, p_business_id, p_category_id, btrim(p_name), NULLIF(btrim(p_description), ''),
    p_price_per_unit, p_unit, p_opening_quantity, p_min_order_quantity,
    p_harvest_date, p_available_until, p_status, v_images[1]
  )
  RETURNING id INTO v_product_id;

  PERFORM set_config('uma.inventory_context', '', true);

  INSERT INTO public.product_images (product_id, image_path, sort_order)
  SELECT v_product_id, t.path, (t.ord - 1)::INT
  FROM unnest(v_images) WITH ORDINALITY AS t(path, ord);

  RETURN v_product_id;
END;
$$;

-- 4b. Edit listing content (and optionally publish/unpublish a non-archived
-- listing). Never touches stock, moderation, or ownership.
CREATE OR REPLACE FUNCTION public.update_business_listing(
  p_business_id        UUID,
  p_product_id         UUID,
  p_name               TEXT,
  p_category_id        UUID,
  p_description        TEXT,
  p_price_per_unit     NUMERIC,
  p_unit               TEXT,
  p_min_order_quantity NUMERIC,
  p_harvest_date       DATE,
  p_available_until    DATE,
  p_status             TEXT DEFAULT NULL,
  p_image_paths        TEXT[] DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller   TEXT;
  v_product  RECORD;
  v_existing TEXT[];
BEGIN
  v_caller := public.require_business_seller_access(p_business_id);

  SELECT id, business_id, unit, status, moderation_status, image_path
  INTO   v_product
  FROM   public.products
  WHERE  id = p_product_id
  FOR UPDATE;

  IF NOT FOUND OR v_product.business_id IS DISTINCT FROM p_business_id THEN
    RAISE EXCEPTION 'Listing not found in this business.' USING ERRCODE = 'UMN01';
  END IF;

  PERFORM public.validate_listing_fields(
    p_name, p_description, p_price_per_unit, p_min_order_quantity,
    p_harvest_date, p_available_until
  );

  -- A legacy unit outside today's list may be kept, not newly chosen.
  IF p_unit IS NULL OR (
       p_unit NOT IN ('kg', 'g', 'bundle', 'piece', 'sack', 'crate', 'tray')
       AND p_unit IS DISTINCT FROM v_product.unit
     ) THEN
    RAISE EXCEPTION 'Choose a valid unit.' USING ERRCODE = 'UMV01';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('active', 'draft') THEN
    RAISE EXCEPTION 'Choose to publish the listing or keep it as a draft.' USING ERRCODE = 'UMV01';
  END IF;
  IF p_status = 'active' AND v_product.status NOT IN ('active', 'archived')
     AND v_product.moderation_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'This listing is under review by UMA and can''t be published until the review is resolved.'
      USING ERRCODE = 'UMC01';
  END IF;
  IF p_category_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = p_category_id) THEN
    RAISE EXCEPTION 'Choose a valid category.' USING ERRCODE = 'UMV01';
  END IF;

  IF p_image_paths IS NOT NULL THEN
    v_existing := ARRAY(
      SELECT pi.image_path FROM public.product_images pi WHERE pi.product_id = p_product_id
    );
    IF v_product.image_path IS NOT NULL THEN
      v_existing := array_append(v_existing, v_product.image_path);
    END IF;

    PERFORM public.validate_listing_image_paths(p_image_paths, v_caller, v_existing);

    DELETE FROM public.product_images
    WHERE  product_id = p_product_id
      AND  NOT (image_path = ANY (p_image_paths));

    INSERT INTO public.product_images (product_id, image_path, sort_order)
    SELECT p_product_id, t.path, (t.ord - 1)::INT
    FROM   unnest(p_image_paths) WITH ORDINALITY AS t(path, ord)
    ON CONFLICT (product_id, image_path) DO UPDATE SET sort_order = EXCLUDED.sort_order;
  END IF;

  UPDATE public.products
  SET    name               = btrim(p_name),
         category_id        = p_category_id,
         description        = NULLIF(btrim(p_description), ''),
         price_per_unit     = p_price_per_unit,
         unit               = p_unit,
         min_order_quantity = p_min_order_quantity,
         harvest_date       = p_harvest_date,
         available_until    = p_available_until,
         -- Editing never un-archives; restore is set_business_listing_status.
         status             = CASE WHEN status = 'archived' THEN status
                                   ELSE COALESCE(p_status, status) END,
         image_path         = CASE WHEN p_image_paths IS NULL THEN image_path ELSE p_image_paths[1] END
  WHERE  id = p_product_id;
END;
$$;

-- 4c. Producer lifecycle: publish (active), unpublish (draft), archive, restore.
-- Admin moderation (moderation_status) is never changed here, and a moderated
-- listing cannot be published (also enforced by trg_protect_product_moderation
-- and CHECK products_active_requires_approval).
CREATE OR REPLACE FUNCTION public.set_business_listing_status(
  p_business_id UUID,
  p_product_id  UUID,
  p_status      TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
BEGIN
  PERFORM public.require_business_seller_access(p_business_id);

  IF p_status IS NULL OR p_status NOT IN ('active', 'draft', 'archived') THEN
    RAISE EXCEPTION 'Choose a valid listing status.' USING ERRCODE = 'UMV01';
  END IF;

  SELECT id, business_id, status, moderation_status
  INTO   v_product
  FROM   public.products
  WHERE  id = p_product_id
  FOR UPDATE;

  IF NOT FOUND OR v_product.business_id IS DISTINCT FROM p_business_id THEN
    RAISE EXCEPTION 'Listing not found in this business.' USING ERRCODE = 'UMN01';
  END IF;

  IF v_product.status = p_status THEN
    RETURN p_status;
  END IF;

  IF p_status = 'active' AND v_product.moderation_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'This listing is under review by UMA and can''t be published until the review is resolved.'
      USING ERRCODE = 'UMC01';
  END IF;

  UPDATE public.products SET status = p_status WHERE id = p_product_id;

  RETURN p_status;
END;
$$;

-- 4d. The only producer path that changes stock. The row lock serializes this
-- with checkout (which locks the same rows) and with concurrent adjustments,
-- so no update is lost and the balance can never go negative.
--   RECEIVED   p_quantity > 0 is added
--   SPOILAGE   p_quantity > 0 is removed; cannot exceed current stock
--   ADJUSTMENT p_quantity >= 0 is the counted stock; p_expected_quantity must
--              equal the current balance (compare-and-set), so a count taken
--              before a sale cannot silently undo that sale
CREATE OR REPLACE FUNCTION public.adjust_business_inventory(
  p_business_id       UUID,
  p_product_id        UUID,
  p_movement_type     TEXT,
  p_quantity          NUMERIC,
  p_reason            TEXT DEFAULT NULL,
  p_expected_quantity NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
  v_current NUMERIC(12,2);
  v_new     NUMERIC(12,2);
  v_reason  TEXT := NULLIF(btrim(p_reason), '');
BEGIN
  PERFORM public.require_business_seller_access(p_business_id);

  IF p_movement_type IS NULL OR p_movement_type NOT IN ('RECEIVED', 'SPOILAGE', 'ADJUSTMENT') THEN
    RAISE EXCEPTION 'Choose a valid stock action.' USING ERRCODE = 'UMV01';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 0 THEN
    RAISE EXCEPTION 'Quantity cannot be negative.' USING ERRCODE = 'UMV01';
  END IF;
  IF p_quantity > 99999999.99 OR p_quantity <> round(p_quantity, 2) THEN
    RAISE EXCEPTION 'Enter a quantity with up to 2 decimal places.' USING ERRCODE = 'UMV01';
  END IF;
  IF p_movement_type <> 'ADJUSTMENT' AND p_quantity = 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than 0.' USING ERRCODE = 'UMV01';
  END IF;
  IF v_reason IS NOT NULL AND char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'Note must be 500 characters or fewer.' USING ERRCODE = 'UMV01';
  END IF;

  SELECT id, business_id, quantity_available, unit
  INTO   v_product
  FROM   public.products
  WHERE  id = p_product_id
  FOR UPDATE;

  IF NOT FOUND OR v_product.business_id IS DISTINCT FROM p_business_id THEN
    RAISE EXCEPTION 'Listing not found in this business.' USING ERRCODE = 'UMN01';
  END IF;

  v_current := v_product.quantity_available;

  IF p_movement_type = 'RECEIVED' THEN
    v_new := v_current + p_quantity;
  ELSIF p_movement_type = 'SPOILAGE' THEN
    IF p_quantity > v_current THEN
      RAISE EXCEPTION 'Only % % in stock. Loss can''t be more than current stock.',
        trim_scale(v_current), v_product.unit
        USING ERRCODE = 'UMC01';
    END IF;
    v_new := v_current - p_quantity;
  ELSE
    IF p_expected_quantity IS NULL THEN
      RAISE EXCEPTION 'Current stock is required for a count correction.' USING ERRCODE = 'UMV01';
    END IF;
    IF p_expected_quantity <> v_current THEN
      RAISE EXCEPTION 'Stock changed to % % since you opened this form. Review it and try again.',
        trim_scale(v_current), v_product.unit
        USING ERRCODE = 'UMC01';
    END IF;
    IF p_quantity = v_current THEN
      RAISE EXCEPTION 'Stock is already % %.', trim_scale(v_current), v_product.unit
        USING ERRCODE = 'UMV01';
    END IF;
    v_new := p_quantity;
  END IF;

  IF v_new > 99999999.99 THEN
    RAISE EXCEPTION 'That would exceed the maximum stock level.' USING ERRCODE = 'UMV01';
  END IF;

  PERFORM set_config(
    'uma.inventory_context',
    jsonb_build_object('type', p_movement_type, 'reason', v_reason)::TEXT,
    true
  );

  UPDATE public.products SET quantity_available = v_new WHERE id = p_product_id;

  PERFORM set_config('uma.inventory_context', '', true);

  RETURN jsonb_build_object(
    'product_id',         p_product_id,
    'movement_type',      p_movement_type,
    'quantity_delta',     v_new - v_current,
    'quantity_available', v_new
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_business_listing(
  UUID, TEXT, UUID, TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC, DATE, DATE, TEXT, TEXT[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_business_listing(
  UUID, TEXT, UUID, TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC, DATE, DATE, TEXT, TEXT[]
) TO authenticated;

REVOKE ALL ON FUNCTION public.update_business_listing(
  UUID, UUID, TEXT, UUID, TEXT, NUMERIC, TEXT, NUMERIC, DATE, DATE, TEXT, TEXT[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_business_listing(
  UUID, UUID, TEXT, UUID, TEXT, NUMERIC, TEXT, NUMERIC, DATE, DATE, TEXT, TEXT[]
) TO authenticated;

REVOKE ALL ON FUNCTION public.set_business_listing_status(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_business_listing_status(UUID, UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.adjust_business_inventory(UUID, UUID, TEXT, NUMERIC, TEXT, NUMERIC)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_business_inventory(UUID, UUID, TEXT, NUMERIC, TEXT, NUMERIC)
  TO authenticated;

-- ── 5. Read RLS for SELL-business members + storage uploads ─────────────────

DROP POLICY IF EXISTS "products: seller members read business listings" ON public.products;
CREATE POLICY "products: seller members read business listings"
  ON public.products FOR SELECT
  TO authenticated
  USING (business_id IN (SELECT public.current_seller_business_ids()));

DROP POLICY IF EXISTS "product_images: seller members read business listings" ON public.product_images;
CREATE POLICY "product_images: seller members read business listings"
  ON public.product_images FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_images.product_id
        AND p.business_id IN (SELECT public.current_seller_business_ids())
    )
  );

DROP POLICY IF EXISTS "inventory_movements: seller members read" ON public.inventory_movements;
CREATE POLICY "inventory_movements: seller members read"
  ON public.inventory_movements FOR SELECT
  TO authenticated
  USING (business_id IN (SELECT public.current_seller_business_ids()));

-- Members of an active SELL business may upload listing photos into their own
-- folder (products/{clerk_id}/...). starts_with avoids LIKE wildcards in ids.
-- Type/size limits stay enforced by the product-images bucket configuration.
DROP POLICY IF EXISTS "product_images: seller member upload own folder" ON storage.objects;
CREATE POLICY "product_images: seller member upload own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND starts_with(name, 'products/' || (auth.jwt()->>'sub') || '/')
    AND EXISTS (SELECT 1 FROM public.current_seller_business_ids())
  );

DROP POLICY IF EXISTS "product_images: seller member update own folder" ON storage.objects;
CREATE POLICY "product_images: seller member update own folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND starts_with(name, 'products/' || (auth.jwt()->>'sub') || '/')
    AND EXISTS (SELECT 1 FROM public.current_seller_business_ids())
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND starts_with(name, 'products/' || (auth.jwt()->>'sub') || '/')
    AND EXISTS (SELECT 1 FROM public.current_seller_business_ids())
  );
