-- =============================================================================
-- UMA Market V4 — F9: business OWNER column-restricted UPDATE hardening
-- Migration: 20261009000000_v4_business_owner_rls_hardening.sql
--
-- FINDING (prior audit, reproduced live before this migration):
--   "businesses: owner can update business" is a ROW policy. Postgres RLS
--   cannot restrict individual columns (a policy only ever sees the new row),
--   so an authenticated OWNER could rewrite any column on their own business:
--     can_buy, can_sell  → grant themselves capabilities they were not given
--     status             → lift a platform suspension / revoke themselves
--     created_at, id     → tamper with the ownership key and audit fields
--   legacy_clerk_id was already guarded by trg_businesses_10_guard_identity
--   (20261007000000), but the other columns were wide open.
--
-- FIX:
--   A SECURITY INVOKER BEFORE UPDATE trigger — the same pattern as
--   trigger_guard_product_client_writes (20261006100000) and
--   trigger_guard_business_identity (20261007000000) — restricts a direct
--   client (authenticated/anon) write to the profile-safe columns.
--
--   ALLOWED for a direct client : name, updated_at
--   FORBIDDEN for a direct client: id, legacy_clerk_id, can_buy, can_sell,
--                                  status, created_at
--   FORBIDDEN means: service_role and SECURITY DEFINER paths only — that is
--   the authorized platform/admin mechanism for capabilities and lifecycle
--   status (e.g. createAdminClient() behind an admin server action).
--
--   A column added to public.businesses later must be added to the guard
--   below, otherwise it silently joins the allowed set.
--
-- NOT CHANGED:
--   policies (still one OWNER-only UPDATE policy; no INSERT/DELETE policies),
--   table grants, business_members (default-deny), provision_owner_business,
--   trg_businesses_10_guard_identity, products, cart, notifications.
--   No client-side workaround: the application performs no writes to
--   businesses, so no RPC or server action was added to bypass this guard.
--
-- Error code raised: 42501 (not allowed).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trigger_guard_business_client_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- SECURITY INVOKER on purpose: current_user is 'authenticated'/'anon' only
  -- for a direct PostgREST write. service_role and SECURITY DEFINER callers
  -- fall through and may write every column.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.legacy_clerk_id IS DISTINCT FROM OLD.legacy_clerk_id
     OR NEW.can_buy IS DISTINCT FROM OLD.can_buy
     OR NEW.can_sell IS DISTINCT FROM OLD.can_sell
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only the business name can be edited directly; capabilities, status and identity are managed by the platform'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Not callable by clients; the table owner fires it, so REVOKE is safe.
REVOKE ALL ON FUNCTION public.trigger_guard_business_client_writes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_businesses_20_guard_client_writes ON public.businesses;
CREATE TRIGGER trg_businesses_20_guard_client_writes
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_guard_business_client_writes();
