-- =============================================================
-- UMA Market — Database-side Overview Dashboard Aggregation
-- Migration: 20261005000001_overview_dashboard_aggregation.sql
--
-- Replaces the row-heavy JavaScript aggregation behind the farmer and
-- business Overview dashboards with PostgreSQL aggregation that returns
-- ONE compact JSON document instead of the order rows themselves.
--
-- Metric definitions (identical to the Phase 1 JavaScript aggregation):
--   revenue      = completed orders in the period (sum of total_amount)
--   pipeline     = open orders in the period
--                  (pending + accepted/preparing/ready/for_delivery)
--   orders       = orders created in the period
--   active_buyers= distinct counterparties with non-cancelled orders
--   previous     = the same four definitions over the previous window
--                  of equal length (delta comparisons)
--   chart        = per-Manila-day sales/orders buckets for the period
--   status       = per-status order counts for the period
--                  (in-progress statuses grouped as "in_progress")
--
-- Security model:
--   * SECURITY INVOKER — RLS on public.orders keeps applying unchanged;
--     the function is an extra predicate, never a replacement for policy.
--   * Caller identity is read from auth.jwt()->>'sub'. These functions
--     take NO user-identifier parameter, so a client-supplied Clerk ID
--     cannot influence authorization.
--   * Role is asserted from auth.jwt()->>'user_role'.
--   * Only three window instants are accepted as arguments.
--   * Day bucketing uses an explicit 'Asia/Manila' zone, never the
--     session TimeZone.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- Farmer Overview metrics
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_farmer_overview_metrics(
  p_prev_start TIMESTAMPTZ,
  p_start      TIMESTAMPTZ,
  p_end        TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sub  TEXT := auth.jwt()->>'sub';
  v_role TEXT := auth.jwt()->>'user_role';
BEGIN
  IF v_sub IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF v_role IS DISTINCT FROM 'farmer' THEN
    RAISE EXCEPTION 'Not authorized for farmer overview metrics'
      USING ERRCODE = '42501';
  END IF;

  IF p_prev_start IS NULL OR p_start IS NULL OR p_end IS NULL
     OR p_prev_start > p_start OR p_start >= p_end THEN
    RAISE EXCEPTION 'Invalid overview window'
      USING ERRCODE = '22023';
  END IF;

  RETURN (
    WITH scoped AS (
      -- Single index-friendly scan covering BOTH windows; owner column is
      -- derived from the JWT, never from a parameter.
      SELECT o.status,
             o.total_amount,
             o.created_at,
             o.business_clerk_id AS counterparty,
             (o.created_at >= p_start) AS is_current
      FROM public.orders o
      WHERE o.farmer_clerk_id = v_sub
        AND o.created_at >= p_prev_start
        AND o.created_at <  p_end
    ),
    m AS (
      SELECT count(*) FILTER (WHERE is_current) AS orders,
             COALESCE(sum(total_amount)
               FILTER (WHERE is_current AND status = 'completed'), 0) AS revenue,
             count(*) FILTER (
               WHERE is_current
                 AND status IN ('pending','accepted','preparing','ready','for_delivery')
             ) AS pipeline,
             count(DISTINCT counterparty)
               FILTER (WHERE is_current AND status <> 'cancelled') AS active_buyers,
             count(*) FILTER (WHERE NOT is_current) AS prev_orders,
             COALESCE(sum(total_amount)
               FILTER (WHERE NOT is_current AND status = 'completed'), 0) AS prev_revenue,
             count(*) FILTER (
               WHERE NOT is_current
                 AND status IN ('pending','accepted','preparing','ready','for_delivery')
             ) AS prev_pipeline,
             count(DISTINCT counterparty)
               FILTER (WHERE NOT is_current AND status <> 'cancelled') AS prev_active_buyers
      FROM scoped
    ),
    day_buckets AS (
      SELECT (created_at AT TIME ZONE 'Asia/Manila')::date AS day,
             count(*) AS orders,
             COALESCE(sum(total_amount)
               FILTER (WHERE status = 'completed'), 0) AS sales
      FROM scoped
      WHERE is_current
      GROUP BY 1
    ),
    chart AS (
      -- One bucket per Manila calendar day of the period, zero-filled.
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
             COALESCE(b.sales, 0) AS sales,
             COALESCE(b.orders, 0) AS orders
      FROM generate_series(
             (p_start AT TIME ZONE 'Asia/Manila')::date,
             ((p_end   AT TIME ZONE 'Asia/Manila')::date - 1),
             interval '1 day'
           ) AS d(day)
      LEFT JOIN day_buckets b ON b.day = d.day::date
    ),
    status_counts AS (
      SELECT CASE
               WHEN status IN ('accepted','preparing','ready','for_delivery')
                 THEN 'in_progress'
               ELSE status
             END AS bucket,
             count(*) AS cnt
      FROM scoped
      WHERE is_current
      GROUP BY 1
    )
    SELECT jsonb_build_object(
      'metrics', jsonb_build_object(
        'revenue',       m.revenue,
        'pipeline',      m.pipeline,
        'orders',        m.orders,
        'active_buyers', m.active_buyers,
        'previous', jsonb_build_object(
          'revenue',       m.prev_revenue,
          'pipeline',      m.prev_pipeline,
          'orders',        m.prev_orders,
          'active_buyers', m.prev_active_buyers
        )
      ),
      'chart', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'day', day, 'sales', sales, 'orders', orders
               ) ORDER BY day)
        FROM chart
      ), '[]'::jsonb),
      'status', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'status', bucket, 'count', cnt
               ) ORDER BY bucket)
        FROM status_counts
      ), '[]'::jsonb)
    )
    FROM m
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Business Overview metrics
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_business_overview_metrics(
  p_prev_start TIMESTAMPTZ,
  p_start      TIMESTAMPTZ,
  p_end        TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sub  TEXT := auth.jwt()->>'sub';
  v_role TEXT := auth.jwt()->>'user_role';
BEGIN
  IF v_sub IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF v_role IS DISTINCT FROM 'business' THEN
    RAISE EXCEPTION 'Not authorized for business overview metrics'
      USING ERRCODE = '42501';
  END IF;

  IF p_prev_start IS NULL OR p_start IS NULL OR p_end IS NULL
     OR p_prev_start > p_start OR p_start >= p_end THEN
    RAISE EXCEPTION 'Invalid overview window'
      USING ERRCODE = '22023';
  END IF;

  RETURN (
    WITH scoped AS (
      SELECT o.status,
             o.total_amount,
             o.created_at,
             o.farmer_clerk_id AS counterparty,
             (o.created_at >= p_start) AS is_current
      FROM public.orders o
      WHERE o.business_clerk_id = v_sub
        AND o.created_at >= p_prev_start
        AND o.created_at <  p_end
    ),
    m AS (
      SELECT count(*) FILTER (WHERE is_current) AS orders,
             COALESCE(sum(total_amount)
               FILTER (WHERE is_current AND status = 'completed'), 0) AS revenue,
             count(*) FILTER (
               WHERE is_current
                 AND status IN ('pending','accepted','preparing','ready','for_delivery')
             ) AS pipeline,
             count(DISTINCT counterparty)
               FILTER (WHERE is_current AND status <> 'cancelled') AS active_buyers,
             count(*) FILTER (WHERE NOT is_current) AS prev_orders,
             COALESCE(sum(total_amount)
               FILTER (WHERE NOT is_current AND status = 'completed'), 0) AS prev_revenue,
             count(*) FILTER (
               WHERE NOT is_current
                 AND status IN ('pending','accepted','preparing','ready','for_delivery')
             ) AS prev_pipeline,
             count(DISTINCT counterparty)
               FILTER (WHERE NOT is_current AND status <> 'cancelled') AS prev_active_buyers
      FROM scoped
    ),
    day_buckets AS (
      SELECT (created_at AT TIME ZONE 'Asia/Manila')::date AS day,
             count(*) AS orders,
             COALESCE(sum(total_amount)
               FILTER (WHERE status = 'completed'), 0) AS sales
      FROM scoped
      WHERE is_current
      GROUP BY 1
    ),
    chart AS (
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
             COALESCE(b.sales, 0) AS sales,
             COALESCE(b.orders, 0) AS orders
      FROM generate_series(
             (p_start AT TIME ZONE 'Asia/Manila')::date,
             ((p_end   AT TIME ZONE 'Asia/Manila')::date - 1),
             interval '1 day'
           ) AS d(day)
      LEFT JOIN day_buckets b ON b.day = d.day::date
    ),
    status_counts AS (
      SELECT CASE
               WHEN status IN ('accepted','preparing','ready','for_delivery')
                 THEN 'in_progress'
               ELSE status
             END AS bucket,
             count(*) AS cnt
      FROM scoped
      WHERE is_current
      GROUP BY 1
    )
    SELECT jsonb_build_object(
      'metrics', jsonb_build_object(
        'revenue',       m.revenue,
        'pipeline',      m.pipeline,
        'orders',        m.orders,
        'active_buyers', m.active_buyers,
        'previous', jsonb_build_object(
          'revenue',       m.prev_revenue,
          'pipeline',      m.prev_pipeline,
          'orders',        m.prev_orders,
          'active_buyers', m.prev_active_buyers
        )
      ),
      'chart', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'day', day, 'sales', sales, 'orders', orders
               ) ORDER BY day)
        FROM chart
      ), '[]'::jsonb),
      'status', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'status', bucket, 'count', cnt
               ) ORDER BY bucket)
        FROM status_counts
      ), '[]'::jsonb)
    )
    FROM m
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Grants: authenticated sessions only. No user-identifier argument
-- exists to forge, and anon/service_role never reach the JWT guards.
-- ─────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.get_farmer_overview_metrics(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_business_overview_metrics(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_farmer_overview_metrics(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_overview_metrics(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
