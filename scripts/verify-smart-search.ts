// ==============================================================================
// UMA Market — Smart Search & Discovery Automated Verification Suite
// Feature A Verification Script
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

// Anonymous client (represents public visitors browsing /products)
const publicClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Admin client for test setup and security assertions
const adminClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface SearchRow {
  id: string;
  name: string;
  price_per_unit: number;
  quantity_available: number;
  search_rank: number;
  total_count: number | string;
  category?: { id: string; name: string; slug: string } | null;
  farmer?: {
    clerk_id: string;
    full_name: string | null;
    business_name: string | null;
    city: string;
    avatar_url: string | null;
    bio: string | null;
    is_verified: boolean;
    phone?: string;
    address?: string;
  } | null;
}

interface TestCaseResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestCaseResult[] = [];

function assert(id: string, name: string, condition: boolean, details: string) {
  results.push({ id, name, passed: condition, details });
  const icon = condition ? "✅ PASS" : "❌ FAIL";
  console.log(`${icon} | ${id.padEnd(8)} | ${name.padEnd(35)} | ${details}`);
}

async function run() {
  console.log("==============================================================================");
  console.log("UMA Market — Feature A: Smart Search & Discovery Verification Suite");
  console.log("Database:", supabaseUrl);
  console.log("==============================================================================\n");

  // Setup: Ensure Ampayon Fresh Red Tomatoes exists and is active
  const { data: vegCat } = await adminClient.from("categories").select("id").eq("slug", "vegetables").single();
  const { data: farmer } = await adminClient.from("profiles").select("clerk_id").eq("role", "farmer").limit(1).single();

  if (vegCat && farmer) {
    await adminClient.from("products").upsert({
      id: "a0000001-0000-0000-0000-000000000099",
      farmer_clerk_id: farmer.clerk_id,
      category_id: vegCat.id,
      name: "Ampayon Fresh Red Tomatoes",
      description: "Vine-ripened plump red tomatoes grown in Ampayon fertile soils. Naturally sweet and firm for salads, sauces, and retail.",
      price_per_unit: 65,
      unit: "kg",
      quantity_available: 200,
      min_order_quantity: 2,
      status: "active",
      harvest_date: new Date().toISOString().split("T")[0],
      available_until: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
    }, { onConflict: "id" });
  }

  // 1. TEST-01: Typo tolerance: Tomatp -> Ampayon Fresh Red Tomatoes
  {
    const { data, error } = await publicClient.rpc("search_products", { p_search: "Tomatp" });
    const rows = (data ?? []) as SearchRow[];
    const matched = !error && rows.some((p) => p.name.includes("Tomatoes"));
    assert("TEST-01", "Typo tolerance: Tomatp -> Tomatoes", !!matched, matched ? `Matched "${rows[0].name}" (rank: ${rows[0].search_rank.toFixed(2)})` : `Error: ${error?.message || "No match"}`);
  }

  // 2. TEST-02: Plural query: Tomatoes -> Ampayon Fresh Red Tomatoes
  {
    const { data, error } = await publicClient.rpc("search_products", { p_search: "Tomatoes" });
    const rows = (data ?? []) as SearchRow[];
    const matched = !error && rows.some((p) => p.name.includes("Tomatoes"));
    assert("TEST-02", "Plural query: Tomatoes", !!matched, matched ? `Matched "${rows[0].name}" (rank: ${rows[0].search_rank.toFixed(2)})` : `Error: ${error?.message || "No match"}`);
  }

  // 3. TEST-03: Regional spelling: petchay -> Crisp Native Pechay
  {
    const { data, error } = await publicClient.rpc("search_products", { p_search: "petchay" });
    const rows = (data ?? []) as SearchRow[];
    const matched = !error && rows.some((p) => p.name.toLowerCase().includes("pechay"));
    assert("TEST-03", "Regional spelling: petchay", !!matched, matched ? `Found ${rows.length} match(es): "${rows[0].name}"` : `Error: ${error?.message || "No match"}`);
  }

  // 4. TEST-04: Typo tolerance: talongg -> Fresh Native Eggplants (Talong)
  {
    const { data, error } = await publicClient.rpc("search_products", { p_search: "talongg" });
    const rows = (data ?? []) as SearchRow[];
    const matched = !error && rows.some((p) => p.name.toLowerCase().includes("talong"));
    assert("TEST-04", "Typo tolerance: talongg", !!matched, matched ? `Matched "${rows[0].name}" (rank: ${rows[0].search_rank.toFixed(2)})` : `Error: ${error?.message || "No match"}`);
  }

  // 5. TEST-05: Stem query: camot -> Yellow Sweet Camote
  {
    const { data, error } = await publicClient.rpc("search_products", { p_search: "camot" });
    const rows = (data ?? []) as SearchRow[];
    const matched = !error && rows.some((p) => p.name.toLowerCase().includes("camote"));
    assert("TEST-05", "Stem query: camot", !!matched, matched ? `Matched "${rows[0].name}" (rank: ${rows[0].search_rank.toFixed(2)})` : `Error: ${error?.message || "No match"}`);
  }

  // 6. TEST-06: Multi-word query: sweet mango
  {
    const { data, error } = await publicClient.rpc("search_products", { p_search: "sweet mango" });
    const rows = (data ?? []) as SearchRow[];
    const firstMatch = rows[0];
    const isMangoFirst = !error && firstMatch && firstMatch.name.toLowerCase().includes("mango");
    assert("TEST-06", "Multi-word: sweet mango", !!isMangoFirst, isMangoFirst ? `Rank 1: "${firstMatch.name}" (score: ${firstMatch.search_rank.toFixed(2)})` : "Mango not ranked 1");
  }

  // 7. TEST-07: Multi-word query: white rice
  {
    const { data, error } = await publicClient.rpc("search_products", { p_search: "white rice" });
    const rows = (data ?? []) as SearchRow[];
    const firstMatch = rows[0];
    const isRiceFirst = !error && firstMatch && firstMatch.name.toLowerCase().includes("white rice");
    assert("TEST-07", "Multi-word: white rice", !!isRiceFirst, isRiceFirst ? `Rank 1: "${firstMatch.name}" (score: ${firstMatch.search_rank.toFixed(2)})` : "White rice not ranked 1");
  }

  // 8. TEST-08: Multi-word query: brown eggs
  {
    const { data, error } = await publicClient.rpc("search_products", { p_search: "brown eggs" });
    const rows = (data ?? []) as SearchRow[];
    const matched = !error && rows.some((p) => p.name.toLowerCase().includes("eggs"));
    assert("TEST-08", "Multi-word: brown eggs", !!matched, matched ? `Matched "${rows[0].name}"` : "Eggs not matched");
  }

  // 9. TEST-09: Multi-word query: free range chicken
  {
    const { data, error } = await publicClient.rpc("search_products", { p_search: "free range chicken" });
    const rows = (data ?? []) as SearchRow[];
    const matched = !error && rows.some((p) => p.name.toLowerCase().includes("chicken"));
    assert("TEST-09", "Multi-word: free range chicken", !!matched, matched ? `Matched "${rows[0].name}"` : "Chicken not matched");
  }

  // 10. TEST-10: Farmer provenance discovery: Verdant Ridge
  {
    const { data, error } = await publicClient.rpc("search_products", { p_search: "Verdant Ridge" });
    const rows = (data ?? []) as SearchRow[];
    const allVerdant = !error && rows.length > 0 && rows.every((p) => p.farmer?.business_name?.includes("Verdant Ridge") || p.farmer?.full_name?.includes("Verdant"));
    assert("TEST-10", "Farmer search: Verdant Ridge", !!allVerdant, allVerdant ? `Matched ${rows.length} listings from Verdant Ridge Demo Farm` : "Failed to match farmer listings");
  }

  // 11. TEST-11: Farmer provenance discovery: Golden Harvest
  {
    const { data, error } = await publicClient.rpc("search_products", { p_search: "Golden Harvest" });
    const rows = (data ?? []) as SearchRow[];
    const hasGolden = !error && rows.length > 0 && rows.some((p) => p.farmer?.business_name?.includes("Golden Harvest"));
    assert("TEST-11", "Farmer search: Golden Harvest", !!hasGolden, hasGolden ? `Matched ${rows.length} listings including Golden Harvest Demo Agro` : "Failed to match farmer listings");
  }

  // 12. TEST-12: Category keyword search: Vegetables
  {
    const { data, error } = await publicClient.rpc("search_products", { p_search: "Vegetables" });
    const rows = (data ?? []) as SearchRow[];
    const allVeg = !error && rows.length > 0 && rows.every((p) => p.category?.slug === "vegetables");
    assert("TEST-12", "Category search: Vegetables", !!allVeg, allVeg ? `Found ${rows.length} produce listings in Vegetables category` : "Failed category match");
  }

  // 13. TEST-13: Combined query: search + category filter
  {
    const { data, error } = await publicClient.rpc("search_products", {
      p_search: "fresh",
      p_category_slug: "vegetables",
    });
    const rows = (data ?? []) as SearchRow[];
    const valid = !error && rows.length > 0 && rows.every((p) => p.category?.slug === "vegetables");
    assert("TEST-13", "Combined: search + category filter", !!valid, valid ? `Returned ${rows.length} vegetable listings matching 'fresh'` : "Filtered results contained non-vegetables");
  }

  // 14. TEST-14: Combined query: search + price sorting
  {
    const { data, error } = await publicClient.rpc("search_products", {
      p_search: "rice",
      p_sort: "price_asc",
    });
    const rows = (data ?? []) as SearchRow[];
    const isSorted = !error && rows.length >= 2 && rows[0].price_per_unit <= rows[1].price_per_unit;
    assert("TEST-14", "Combined: search + price_asc sort", !!isSorted, isSorted ? `Ascending order: ₱${rows[0].price_per_unit} (${rows[0].name}) <= ₱${rows[1].price_per_unit} (${rows[1].name})` : "Sort violated");
  }

  // 15. TEST-15: Combined query: search + in_stock_only
  {
    const { data, error } = await publicClient.rpc("search_products", {
      p_search: "organic",
      p_in_stock_only: true,
    });
    const rows = (data ?? []) as SearchRow[];
    const allInStock = !error && (rows.length === 0 || rows.every((p) => p.quantity_available > 0));
    assert("TEST-15", "Combined: search + in_stock_only", !!allInStock, allInStock ? `All ${rows.length} matches have stock > 0` : "Found 0-stock product");
  }

  // 16. TEST-16: Gibberish query: no false positives
  {
    const { data, error } = await publicClient.rpc("search_products", { p_search: "xyzqwerty999" });
    const rows = (data ?? []) as SearchRow[];
    const isZero = !error && rows.length === 0;
    assert("TEST-16", "Gibberish query: zero matches", !!isZero, isZero ? "Returned 0 matches cleanly" : `Returned ${rows.length} false positive(s)`);
  }

  // 17. TEST-17: SQL Injection resilience
  {
    const { data, error } = await publicClient.rpc("search_products", { p_search: "' OR 1=1 --" });
    const rows = (data ?? []) as SearchRow[];
    const safe = !error && rows.length === 0;
    assert("TEST-17", "SQL injection resilience", !!safe, safe ? "Safely escaped as literal string, returned 0 matches" : `Error or false matches: ${error?.message || rows.length}`);
  }

  // 18. TEST-18: Security: non-active products (draft, archived) are NEVER returned
  {
    const { data, error } = await publicClient.rpc("search_products", { p_search: "Security" });
    // In demo db there are draft products with "Security" in name
    const rows = (data ?? []) as SearchRow[];
    const noDrafts = !error && rows.length === 0;
    assert("TEST-18", "Security: draft exclusion", !!noDrafts, noDrafts ? "Draft produce strictly excluded from search" : `Leaked ${rows.length} draft item(s)`);
  }

  // 19. TEST-19: Privacy: farmer phone and address omitted from search payload
  {
    const { data, error } = await publicClient.rpc("search_products", { p_search: "Ampayon", p_limit: 1 });
    const rows = (data ?? []) as SearchRow[];
    const first = rows[0];
    const farmerProfile = first?.farmer;
    const isPrivateDataOmitted = !error && farmerProfile && !farmerProfile.phone && !farmerProfile.address;
    assert("TEST-19", "Privacy: phone/address omitted", !!isPrivateDataOmitted, isPrivateDataOmitted ? "Farmer payload contains only public provenance" : "Leaked sensitive farmer fields");
  }

  // 20. TEST-20: Pagination correctness: total_count & range
  {
    const { data: page1, error: err1 } = await publicClient.rpc("search_products", {
      p_category_slug: "vegetables",
      p_limit: 2,
      p_offset: 0,
    });
    const { data: page2, error: err2 } = await publicClient.rpc("search_products", {
      p_category_slug: "vegetables",
      p_limit: 2,
      p_offset: 2,
    });

    const r1 = (page1 ?? []) as SearchRow[];
    const r2 = (page2 ?? []) as SearchRow[];
    const isPaginated = !err1 && !err2 && r1.length === 2 && r2.length === 2 && r1[0].id !== r2[0].id && Number(r1[0].total_count) >= 4;
    assert("TEST-20", "Pagination: limit/offset & total_count", !!isPaginated, isPaginated ? `Page 1 count: ${r1.length}, Page 2 count: ${r2.length}, Total count: ${r1[0].total_count}` : "Pagination mismatch");
  }

  // 21. TEST-21: Punctuation-only search: q="???" returns 0 rows (MED-01)
  {
    const { data, error } = await publicClient.rpc("search_products", { p_search: "???" });
    const rows = (data ?? []) as SearchRow[];
    const zeroResults = !error && rows.length === 0;
    assert("TEST-21", "Punctuation query: ???", !!zeroResults, zeroResults ? "Zero matches returned cleanly" : `Returned ${rows.length} false match(es)`);
  }

  // 22. TEST-22: Punctuation-only search: q="!@#$%" returns 0 rows (MED-01)
  {
    const { data, error } = await publicClient.rpc("search_products", { p_search: "!@#$%" });
    const rows = (data ?? []) as SearchRow[];
    const zeroResults = !error && rows.length === 0;
    assert("TEST-22", "Punctuation query: !@#$%", !!zeroResults, zeroResults ? "Zero matches returned cleanly" : `Returned ${rows.length} false match(es)`);
  }

  // 23. TEST-23: Cross-category isolation: q="bangus", category="vegetables" returns 0 items
  {
    const { data, error } = await publicClient.rpc("search_products", {
      p_search: "bangus",
      p_category_slug: "vegetables",
    });
    const rows = (data ?? []) as SearchRow[];
    const isolated = !error && rows.length === 0;
    assert("TEST-23", "Cross-category isolation: bangus in vegetables", !!isolated, isolated ? "0 items returned (vegetables strictly isolated)" : `Leaked ${rows.length} seafood item(s)`);
  }

  // 24. TEST-24: Long query resilience: 500-character search string (MED-02)
  {
    const longQ = "tomato ".repeat(75); // 525 characters
    const start = Date.now();
    const { data, error } = await publicClient.rpc("search_products", { p_search: longQ });
    const elapsedMs = Date.now() - start;
    const rows = (data ?? []) as SearchRow[];
    const safe = !error && rows.length > 0 && elapsedMs < 1000;
    assert("TEST-24", "Long query resilience: 500+ chars", !!safe, safe ? `Safe execution in ${elapsedMs}ms, matched "${rows[0]?.name}"` : `Failed or timed out: ${error?.message || `${elapsedMs}ms`}`);
  }

  // 25. TEST-25: RPC parameter bounds & normalization (MED-02, LOW-03)
  {
    const { data: limitData, error: limitErr } = await publicClient.rpc("search_products", { p_limit: 100000 });
    const { data: negOffsetData, error: offsetErr } = await publicClient.rpc("search_products", { p_offset: -10 });
    const { data: emptySlugData, error: emptySlugErr } = await publicClient.rpc("search_products", { p_category_slug: "" });
    const { data: spaceSlugData, error: spaceSlugErr } = await publicClient.rpc("search_products", { p_category_slug: "   " });

    const limitRows = (limitData ?? []) as SearchRow[];
    const offsetRows = (negOffsetData ?? []) as SearchRow[];
    const emptyRows = (emptySlugData ?? []) as SearchRow[];
    const spaceRows = (spaceSlugData ?? []) as SearchRow[];

    const boundsClamped =
      !limitErr && !offsetErr && !emptySlugErr && !spaceSlugErr &&
      limitRows.length <= 100 &&
      offsetRows.length > 0 &&
      emptyRows.length > 0 &&
      spaceRows.length > 0;

    assert(
      "TEST-25",
      "RPC parameter clamping & normalization",
      !!boundsClamped,
      boundsClamped
        ? `Limit clamped <= 100 (${limitRows.length} rows), negative offset clamped, empty/whitespace slug normalized`
        : "Bounds clamping failed"
    );
  }

  // 26. TEST-26: Null relationship payload handling (LOW-01)
  {
    // Check that when category or farmer relationship is absent, JSON returns SQL null rather than an empty object
    const { data: testRows, error } = await publicClient.rpc("search_products", { p_limit: 1 });
    const row = testRows?.[0] as SearchRow | undefined;
    // Verify that the farmer/category objects are either genuine objects with valid keys or null (never empty dummy objects)
    const validCategoryShape = !error && row && (row.category === null || (row.category && typeof row.category.id === "string"));
    const validFarmerShape = !error && row && (row.farmer === null || (row.farmer && typeof row.farmer.clerk_id === "string"));

    assert(
      "TEST-26",
      "Null category/farmer relationship handling",
      !!(validCategoryShape && validFarmerShape),
      validCategoryShape && validFarmerShape
        ? "Category and farmer objects maintain strict nullable JSON shapes"
        : "Found empty dummy object for category/farmer"
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

run().catch((err) => {
  console.error("Fatal error running test suite:", err);
  process.exit(1);
});
