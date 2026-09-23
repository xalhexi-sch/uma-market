-- =============================================================
-- UMA Market — Public Marketplace Profiles Policy
-- Migration: 20260923000002_public_marketplace_profiles
--
-- Enables public marketplace discovery so visitors and prospective
-- commercial buyers can view verified farmer provenance (farm name,
-- farmer name, city, bio, and verification badge) on active produce listings.
-- Sensitive user records (phone, address, credentials) remain protected.
-- =============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
      AND policyname = 'profiles: public reads farmer'
  ) THEN
    CREATE POLICY "profiles: public reads farmer"
      ON public.profiles FOR SELECT
      USING (role = 'farmer');
  END IF;
END $$;
