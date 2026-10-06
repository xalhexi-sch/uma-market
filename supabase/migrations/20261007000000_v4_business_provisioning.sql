-- =============================================================================
-- UMA Market V4 — Business provisioning foundation
-- Migration: 20261007000000_v4_business_provisioning.sql
--
-- Invariant: every non-admin profile (role farmer | business) has exactly one
-- legacy business (businesses.legacy_clerk_id = profiles.clerk_id) with the
-- user as its OWNER member.
--
-- 1. trg_businesses_10_guard_identity (BEFORE UPDATE OF legacy_clerk_id,
--    invoker): a direct client write (role authenticated/anon) may not change
--    businesses.legacy_clerk_id. Provisioning, the product derive trigger and
--    the legacy order fallbacks all trust that column as the owner's identity
--    anchor; without the guard an OWNER could point their business at another
--    user's Clerk ID before that user is provisioned.
-- 2. provision_owner_business(p_clerk_id) (SECURITY DEFINER, service_role only):
--    idempotent + concurrent-safe. Skips missing and admin profiles. Creates
--    the business with the existing capability mapping (farmer → SELL,
--    business → BUY) or reuses the existing one, ensures the OWNER membership,
--    then reconciles NULL products.business_id / cart_items.business_id.
-- 3. trg_profiles_provision_owner_business (AFTER INSERT on profiles, skips
--    admin): provisions in the same transaction as the profile insert. Profile
--    UPDATEs (including role changes) do not provision.
-- 4. Catch-up backfill: runs the function for every non-admin profile.
--    Rerunnable; already-provisioned users are a no-op.
--
-- Not changed: RLS policies (no INSERT/DELETE policies are added to
-- businesses or business_members), capabilities/status/name of existing
-- businesses, existing admin businesses, orders, legacy *_clerk_id columns.
--
-- Error codes raised by this migration's functions:
--   22023  invalid argument (empty Clerk ID)
--   42501  not allowed (client identity change; business operated by others)
--   40001  could not resolve the business row (retryable)
-- =============================================================================

-- ── 1. Guard: legacy_clerk_id is not client-writable ────────────────────────

-- SECURITY INVOKER on purpose (same pattern as trigger_guard_product_client_writes):
-- current_user is 'authenticated'/'anon' only for a direct PostgREST write.
CREATE OR REPLACE FUNCTION public.trigger_guard_business_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND NEW.legacy_clerk_id IS DISTINCT FROM OLD.legacy_clerk_id THEN
    RAISE EXCEPTION 'Business identity cannot be changed'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_guard_business_identity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_businesses_10_guard_identity ON public.businesses;
CREATE TRIGGER trg_businesses_10_guard_identity
  BEFORE UPDATE OF legacy_clerk_id ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_guard_business_identity();

-- ── 2. provision_owner_business ─────────────────────────────────────────────

-- Returns the user's business id, or NULL when there is nothing to provision
-- (no profile, or an admin profile).
--
-- Concurrency: INSERT ... ON CONFLICT (legacy_clerk_id) DO NOTHING makes a
-- concurrent caller wait for the first insert and then reuse its row; the
-- business row is then locked FOR UPDATE so the membership decision and the
-- reconciliation run one caller at a time per business.
CREATE OR REPLACE FUNCTION public.provision_owner_business(p_clerk_id TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile      RECORD;
  v_business_id  UUID;
  v_can_buy      BOOLEAN;
BEGIN
  IF p_clerk_id IS NULL OR btrim(p_clerk_id) = '' THEN
    RAISE EXCEPTION 'Clerk ID is required' USING ERRCODE = '22023';
  END IF;

  SELECT clerk_id, role, status, business_name, full_name
  INTO   v_profile
  FROM   public.profiles
  WHERE  clerk_id = p_clerk_id;

  -- Only farmer/business profiles own a business; admins are skipped.
  IF NOT FOUND OR v_profile.role NOT IN ('farmer', 'business') THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.businesses (name, can_buy, can_sell, status, legacy_clerk_id)
  VALUES (
    COALESCE(
      NULLIF(btrim(v_profile.business_name), ''),
      NULLIF(btrim(v_profile.full_name), ''),
      'Business'
    ),
    v_profile.role = 'business',
    v_profile.role = 'farmer',
    COALESCE(v_profile.status, 'active'),
    p_clerk_id
  )
  ON CONFLICT (legacy_clerk_id) DO NOTHING;

  SELECT b.id, b.can_buy
  INTO   v_business_id, v_can_buy
  FROM   public.businesses b
  WHERE  b.legacy_clerk_id = p_clerk_id
  FOR UPDATE;

  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'Could not resolve business for provisioning; retry'
      USING ERRCODE = '40001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = v_business_id AND bm.user_id = p_clerk_id
  ) THEN
    -- Only an orphaned business (no members) may be claimed by its legacy owner.
    IF EXISTS (
      SELECT 1 FROM public.business_members bm WHERE bm.business_id = v_business_id
    ) THEN
      RAISE EXCEPTION 'Business for this account is operated by other members'
        USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.business_members (business_id, user_id, role)
    VALUES (v_business_id, p_clerk_id, 'OWNER')
    ON CONFLICT (business_id, user_id) DO NOTHING;
  END IF;

  -- Listings created before the business existed (trg_products_20_derive_business
  -- found nothing). Rows that already belong to a business are left alone.
  UPDATE public.products p
  SET    business_id = v_business_id
  WHERE  p.business_id IS NULL
    AND  p.farmer_clerk_id = p_clerk_id;

  -- Legacy cart rows move to the buying business. A legacy row whose product is
  -- already in the business cart stays as it is rather than being merged or
  -- deleted (idx_cart_items_business_product).
  IF v_can_buy THEN
    UPDATE public.cart_items c
    SET    business_id = v_business_id
    WHERE  c.business_id IS NULL
      AND  c.business_clerk_id = p_clerk_id
      AND  NOT EXISTS (
             SELECT 1 FROM public.cart_items v
             WHERE  v.business_id = v_business_id
               AND  v.product_id = c.product_id
           );
  END IF;

  RETURN v_business_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_owner_business(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_owner_business(TEXT) TO service_role;

-- ── 3. Provision on profile insert ──────────────────────────────────────────

-- SECURITY DEFINER so the call works whichever role inserted the profile
-- (provision_owner_business is not executable by clients).
CREATE OR REPLACE FUNCTION public.trigger_provision_owner_business()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.provision_owner_business(NEW.clerk_id);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_provision_owner_business() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_provision_owner_business ON public.profiles;
CREATE TRIGGER trg_profiles_provision_owner_business
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.role IS DISTINCT FROM 'admin')
  EXECUTE FUNCTION public.trigger_provision_owner_business();

-- ── 4. Catch-up backfill ────────────────────────────────────────────────────

-- One statement, so the trigger toggle is rolled back with any failure.
-- Reconciliation must not touch products.updated_at (it drives "recently
-- updated" ordering), as in 20261006100000.
DO $$
BEGIN
  ALTER TABLE public.products DISABLE TRIGGER trg_products_updated_at;

  PERFORM public.provision_owner_business(p.clerk_id)
  FROM    public.profiles p
  WHERE   p.role IN ('farmer', 'business')
  ORDER BY p.created_at, p.clerk_id;

  ALTER TABLE public.products ENABLE TRIGGER trg_products_updated_at;
END;
$$;
