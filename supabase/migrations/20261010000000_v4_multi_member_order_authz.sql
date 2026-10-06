-- =============================================================================
-- UMA Market V4 — multi-member order authorization
-- Migration: 20261010000000_v4_multi_member_order_authz.sql
--
-- FINDING (reproduced live before this migration; RED run captured by
-- scripts/verify-v4-multi-member-order-authz.ts):
--   V4 orders are owned collectively through orders.business_id and
--   public.business_members, but three write-path policies still
--   authenticated the caller solely through the legacy V2 identity
--   orders.business_clerk_id:
--     1. "orders: business cancels pending"              (USING + WITH CHECK)
--     2. "seller_reviews: completed buyer inserts own"   (WITH CHECK)
--     3. "product_reviews: completed buyer inserts own"  (WITH CHECK)
--   With more than one member the two identities differ: a legitimate STAFF
--   member — or an OWNER acting on an order a colleague placed — was denied
--   (0 rows updated / 42501 on insert), while cross-business isolation held
--   only as an accident of the legacy column instead of by membership.
--
-- FIX:
--   Each policy gains a second branch over public.business_members,
--   mirroring the existing SELECT policy "orders: business reads own"
--   (20261006000001):
--     actor is the legacy identity  OR  actor is a member of the row's business
--   Legacy rows (orders.business_id IS NULL) keep the legacy rule only.
--
-- NOT CHANGED (preserved verbatim):
--   * order-state rules: cancel only 'pending' rows, result must be 'cancelled'
--   * review eligibility: user_role='business', active profile, completed
--     order, cross-party provenance (order business ≠ farmer)
--   * review provenance columns (reviewer_clerk_id stays the acting member)
--   * reviewer UPDATE/DELETE policies — no application path writes them; they
--     fail closed for member-authored reviews and can reuse this branch if a
--     review edit/delete path is ever added
--   * admin policies, table grants, checkout RPCs, triggers, constraints
--
-- VERIFICATION:
--   npx tsx scripts/verify-v4-multi-member-order-authz.ts   (23 cases)
-- =============================================================================

-- ── 1. orders: business cancels pending ─────────────────────────────────────
DROP POLICY IF EXISTS "orders: business cancels pending" ON public.orders;
CREATE POLICY "orders: business cancels pending" ON public.orders
  FOR UPDATE
  USING (
    status = 'pending'
    AND (
      (auth.jwt()->>'sub') = business_clerk_id
      OR (
        business_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.business_members bm
          WHERE bm.business_id = orders.business_id
            AND bm.user_id = (auth.jwt()->>'sub')
        )
      )
    )
  )
  WITH CHECK (
    status = 'cancelled'
    AND (
      (auth.jwt()->>'sub') = business_clerk_id
      OR (
        business_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.business_members bm
          WHERE bm.business_id = orders.business_id
            AND bm.user_id = (auth.jwt()->>'sub')
        )
      )
    )
  );

-- ── 2. seller_reviews: completed buyer inserts own ───────────────────────────
DROP POLICY IF EXISTS "seller_reviews: completed buyer inserts own" ON public.seller_reviews;
CREATE POLICY "seller_reviews: completed buyer inserts own"
  ON public.seller_reviews FOR INSERT
  WITH CHECK (
    (auth.jwt()->>'user_role') = 'business'
    AND reviewer_clerk_id = auth.jwt()->>'sub'
    AND reviewer_clerk_id IS DISTINCT FROM target_farmer_clerk_id
    AND EXISTS (
      SELECT 1 FROM public.profiles reviewer
      WHERE reviewer.clerk_id = reviewer_clerk_id
        AND reviewer.role = 'business'
        AND reviewer.status = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.profiles farmer
        ON farmer.clerk_id = o.farmer_clerk_id
       AND farmer.role = 'farmer'
       AND farmer.status = 'active'
      WHERE o.id = order_id
        AND o.status = 'completed'
        AND o.farmer_clerk_id = target_farmer_clerk_id
        AND o.business_clerk_id IS DISTINCT FROM o.farmer_clerk_id
        AND (
          o.business_clerk_id = reviewer_clerk_id
          OR (
            o.business_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.business_members bm
              WHERE bm.business_id = o.business_id
                AND bm.user_id = reviewer_clerk_id
            )
          )
        )
    )
  );

-- ── 3. product_reviews: completed buyer inserts own ──────────────────────────
DROP POLICY IF EXISTS "product_reviews: completed buyer inserts own" ON public.product_reviews;
CREATE POLICY "product_reviews: completed buyer inserts own"
  ON public.product_reviews FOR INSERT
  WITH CHECK (
    (auth.jwt()->>'user_role') = 'business'
    AND reviewer_clerk_id = auth.jwt()->>'sub'
    AND EXISTS (
      SELECT 1 FROM public.profiles reviewer
      WHERE reviewer.clerk_id = reviewer_clerk_id
        AND reviewer.role = 'business'
        AND reviewer.status = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id AND oi.id = order_item_id
      JOIN public.products p ON p.id = oi.product_id AND p.id = product_id
      JOIN public.profiles farmer
        ON farmer.clerk_id = p.farmer_clerk_id
       AND farmer.role = 'farmer'
       AND farmer.status = 'active'
      WHERE o.id = order_id
        AND o.status = 'completed'
        AND o.business_clerk_id IS DISTINCT FROM o.farmer_clerk_id
        AND (
          o.business_clerk_id = reviewer_clerk_id
          OR (
            o.business_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.business_members bm
              WHERE bm.business_id = o.business_id
                AND bm.user_id = reviewer_clerk_id
            )
          )
        )
    )
  );
