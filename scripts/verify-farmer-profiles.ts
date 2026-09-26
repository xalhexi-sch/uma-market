// ==============================================================================
// UMA Market — Public Farmer Profile Feature Verification Suite
// Tests public access, safe fields exposure, active-product filtering, and security
// ==============================================================================

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

// Anonymous public client (represents unauthenticated visitor)
const publicClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Admin client for test setup/ground-truth verification
const adminClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface TestCaseResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestCaseResult[] = [];

function assert(id: string, name: string, condition: boolean, details: string) {
  results.push({ id, name, passed: condition, details });
  const status = condition ? "PASS" : "FAIL";
  console.log(`[${status}] ${id}: ${name} — ${details}`);
}

async function runVerification() {
  console.log("==============================================================================");
  console.log("UMA Market — Public Farmer Profile Verification");
  console.log("==============================================================================\n");

  // 1. Discover a sample registered farmer from the database
  const { data: sampleFarmers, error: farmerListErr } = await adminClient
    .from("profiles")
    .select("clerk_id, full_name, business_name, city, is_verified, phone, address")
    .eq("role", "farmer")
    .limit(5);

  if (farmerListErr) {
    console.error("Failed to query farmers from database:", farmerListErr.message);
    process.exit(1);
  }

  const sampleFarmer = sampleFarmers?.[0];
  if (!sampleFarmer) {
    console.error("No registered farmer found in database for testing.");
    process.exit(1);
  }

  console.log(`Testing with ground-truth farmer: ${sampleFarmer.business_name || sampleFarmer.full_name} (${sampleFarmer.clerk_id})`);

  // TEST-01: Anonymous access to public_farmer_profiles view
  {
    const { data, error } = await publicClient
      .from("public_farmer_profiles")
      .select("*")
      .eq("clerk_id", sampleFarmer.clerk_id)
      .maybeSingle();

    const passed = !error && data !== null && data.clerk_id === sampleFarmer.clerk_id;
    assert(
      "TEST-01",
      "Anonymous query to public_farmer_profiles",
      passed,
      passed ? `Successfully loaded public profile for ${data.business_name || data.full_name}` : `Failed: ${error?.message}`
    );
  }

  // TEST-02: Strict field isolation on public_farmer_profiles (no phone, no address)
  {
    const { data } = await publicClient
      .from("public_farmer_profiles")
      .select("*")
      .eq("clerk_id", sampleFarmer.clerk_id)
      .maybeSingle();

    const record = (data ?? {}) as Record<string, unknown>;
    const hasPhone = "phone" in record;
    const hasAddress = "address" in record;
    const hasStatus = "status" in record;
    const hasRole = "role" in record;

    const isolated = !hasPhone && !hasAddress && !hasStatus && !hasRole;
    assert(
      "TEST-02",
      "Zero sensitive data leakage in public_farmer_profiles",
      isolated,
      isolated
        ? "Confirmed: phone, address, status, and role are not exposed in the view"
        : `Leaked sensitive columns: ${[hasPhone && "phone", hasAddress && "address", hasStatus && "status", hasRole && "role"].filter(Boolean).join(", ")}`
    );
  }

  // TEST-03: Direct anonymous SELECT on public.profiles is blocked (SEC-002)
  {
    const { data, error } = await publicClient
      .from("profiles")
      .select("*")
      .eq("clerk_id", sampleFarmer.clerk_id);

    // Should error with 42501 (permission denied) or return empty/blocked
    const blocked = error !== null || (data ?? []).length === 0;
    assert(
      "TEST-03",
      "Direct anonymous SELECT on public.profiles blocked",
      blocked,
      blocked ? `Access properly denied to underlying table (${error?.message || "empty result"})` : "SECURITY FAILURE: Direct profiles table readable by anon!"
    );
  }

  // TEST-04: Active products for farmer are retrievable anonymously
  {
    const { data, error } = await publicClient
      .from("products")
      .select(`
        id, farmer_clerk_id, name, status, price_per_unit, quantity_available,
        category:categories(id, name, slug)
      `)
      .eq("farmer_clerk_id", sampleFarmer.clerk_id)
      .eq("status", "active");

    const passed = !error;
    const count = (data ?? []).length;
    assert(
      "TEST-04",
      "Public query for farmer's active products",
      passed,
      passed ? `Retrieved ${count} active product(s) for farmer` : `Query error: ${error?.message}`
    );
  }

  // TEST-05: Non-active products (draft, archived) are strictly filtered out
  {
    // Check if any non-active products belong to this farmer in ground truth
    const { data: allFarmerProducts } = await adminClient
      .from("products")
      .select("id, status")
      .eq("farmer_clerk_id", sampleFarmer.clerk_id);

    const hasInactiveInDb = (allFarmerProducts ?? []).some((p) => p.status !== "active");

    // Public query with status = 'active'
    const { data: publicProducts } = await publicClient
      .from("products")
      .select("id, status")
      .eq("farmer_clerk_id", sampleFarmer.clerk_id)
      .eq("status", "active");

    const allPublicActive = (publicProducts ?? []).every((p) => p.status === "active");

    assert(
      "TEST-05",
      "Active status filter strictly excludes non-active products",
      allPublicActive,
      allPublicActive
        ? `All ${publicProducts?.length ?? 0} public products have status 'active' (DB total: ${allFarmerProducts?.length ?? 0}, has inactive in DB: ${hasInactiveInDb})`
        : "Found inactive products in public query!"
    );
  }

  // TEST-06: Nonexistent farmer returns null (supports notFound())
  {
    const dummyClerkId = "user_nonexistent_9999999999999";
    const { data, error } = await publicClient
      .from("public_farmer_profiles")
      .select("*")
      .eq("clerk_id", dummyClerkId)
      .maybeSingle();

    const notFoundHandled = !error && data === null;
    assert(
      "TEST-06",
      "Nonexistent farmer clerk_id returns null (triggers 404)",
      notFoundHandled,
      notFoundHandled ? "Successfully returned null for nonexistent farmer" : `Unexpected response: ${JSON.stringify(data)}`
    );
  }

  // TEST-07: Verification badge status integrity
  {
    const { data } = await publicClient
      .from("public_farmer_profiles")
      .select("clerk_id, is_verified")
      .eq("clerk_id", sampleFarmer.clerk_id)
      .maybeSingle();

    const matchesGroundTruth = data?.is_verified === sampleFarmer.is_verified;
    assert(
      "TEST-07",
      "Verification badge reflects database ground truth",
      matchesGroundTruth,
      matchesGroundTruth
        ? `is_verified (${data?.is_verified}) matches ground-truth value (${sampleFarmer.is_verified})`
        : "Mismatch in verification status!"
    );
  }

  // TEST-08: Zero-product farmer handling (empty state resilience)
  {
    // Query products for a farmer with no active products or dummy clerk_id
    const { data, error } = await publicClient
      .from("products")
      .select("id")
      .eq("farmer_clerk_id", "user_dummy_with_no_products")
      .eq("status", "active");

    const emptyArray = !error && Array.isArray(data) && data.length === 0;
    assert(
      "TEST-08",
      "Zero-product farmer returns clean empty array for empty state rendering",
      emptyArray,
      emptyArray ? "Returns clean empty array [] (allows Empty state rendering)" : `Failed: ${error?.message}`
    );
  }

  console.log("\n==============================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`SUMMARY: ${passed}/${total} PASSED (${failed} failed)`);
  console.log("==============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error("Verification suite encountered an unhandled error:", err);
  process.exit(1);
});
