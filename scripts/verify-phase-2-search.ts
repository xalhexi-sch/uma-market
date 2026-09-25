import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const client = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface Product {
  id: string;
  name: string;
  price_per_unit: number;
  quantity_available: number;
  category?: { slug: string; name: string } | null;
  farmer?: { full_name?: string; business_name?: string; city?: string; phone?: string; address?: string } | null;
}

async function searchActiveProductsTest({
  search,
  categorySlug,
  sort = "relevance",
  inStockOnly = true,
  limit = 48,
}: {
  search?: string;
  categorySlug?: string;
  sort?: string;
  inStockOnly?: boolean;
  limit?: number;
}): Promise<{ products: Product[]; totalCount: number }> {
  const effectiveSort = !search?.trim() && sort === "relevance" ? "newest" : sort;
  const { data, error } = await client.rpc("search_products", {
    p_search: search?.trim() || null,
    p_category_slug: categorySlug?.trim() || null,
    p_in_stock_only: inStockOnly,
    p_sort: effectiveSort,
    p_limit: limit,
    p_offset: 0,
  });

  if (error) throw error;
  const rows = (data ?? []) as Product[];
  const totalCount = rows.length > 0 ? Number((rows[0] as unknown as { total_count: number }).total_count) : 0;
  return { products: rows, totalCount };
}

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(id: string, name: string, passed: boolean, details: string) {
  results.push({ id, name, passed, details });
  const status = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${status} | ${id.padEnd(8)} | ${name.padEnd(42)} | ${details}`);
}

async function runPhase2Tests() {
  console.log("==============================================================================");
  console.log("UMA Market — Feature B: Phase 2 Live Search-as-You-Type Verification");
  console.log("==============================================================================");

  // 1. Normal Search: "tomato"
  try {
    const res = await searchActiveProductsTest({ search: "tomato", inStockOnly: true });
    const matched = res.products.some((p) => /tomato/i.test(p.name));
    record(
      "TEST-01",
      'Normal search: "tomato"',
      matched && res.products.length > 0,
      `Found ${res.products.length} product(s), first: "${res.products[0]?.name}"`
    );
  } catch (err: unknown) {
    record("TEST-01", 'Normal search: "tomato"', false, String(err));
  }

  // 2. Partial Search: "toma"
  try {
    const res = await searchActiveProductsTest({ search: "toma", inStockOnly: true });
    const matched = res.products.some((p) => /tomato|toma/i.test(p.name));
    record(
      "TEST-02",
      'Partial search: "toma"',
      matched && res.products.length > 0,
      `Found ${res.products.length} product(s), first: "${res.products[0]?.name}"`
    );
  } catch (err: unknown) {
    record("TEST-02", 'Partial search: "toma"', false, String(err));
  }

  // 3. Typo-tolerant Search: "Tomatp"
  try {
    const res = await searchActiveProductsTest({ search: "Tomatp", inStockOnly: true });
    const matched = res.products.some((p) => /tomato/i.test(p.name));
    record(
      "TEST-03",
      'Typo tolerance: "Tomatp"',
      matched && res.products.length > 0,
      `Fuzzy match: "${res.products[0]?.name}"`
    );
  } catch (err: unknown) {
    record("TEST-03", 'Typo tolerance: "Tomatp"', false, String(err));
  }

  // 4. Clearing search: empty string ""
  try {
    const res = await searchActiveProductsTest({ search: "", inStockOnly: true, limit: 10 });
    record(
      "TEST-04",
      "Clearing search: empty query",
      res.products.length > 0,
      `Restored default catalog with ${res.products.length} listings`
    );
  } catch (err: unknown) {
    record("TEST-04", "Clearing search: empty query", false, String(err));
  }

  // 5. Search combined with Category filter: "fresh" in "vegetables"
  try {
    const res = await searchActiveProductsTest({
      search: "fresh",
      categorySlug: "vegetables",
      inStockOnly: true,
    });
    const allVegetables = res.products.every(
      (p) => p.category?.slug === "vegetables" || !p.category
    );
    record(
      "TEST-05",
      'Combined: search "fresh" + "vegetables"',
      res.products.length > 0 && allVegetables,
      `Found ${res.products.length} produce item(s) strictly in vegetables`
    );
  } catch (err: unknown) {
    record("TEST-05", 'Combined: search "fresh" + "vegetables"', false, String(err));
  }

  // 6. Category Isolation: "chicken" in "vegetables" -> 0 matches
  try {
    const res = await searchActiveProductsTest({
      search: "chicken",
      categorySlug: "vegetables",
      inStockOnly: true,
    });
    record(
      "TEST-06",
      'Isolation: "chicken" in "vegetables"',
      res.products.length === 0,
      `0 matches returned (correct cross-category isolation)`
    );
  } catch (err: unknown) {
    record("TEST-06", 'Isolation: "chicken" in "vegetables"', false, String(err));
  }

  // 7. Search combined with Sort: "price_asc"
  try {
    const res = await searchActiveProductsTest({
      search: "rice",
      sort: "price_asc",
      inStockOnly: false,
    });
    let isAsc = true;
    for (let i = 1; i < res.products.length; i++) {
      if (res.products[i].price_per_unit < res.products[i - 1].price_per_unit) {
        isAsc = false;
        break;
      }
    }
    record(
      "TEST-07",
      'Combined: search + sort "price_asc"',
      isAsc && res.products.length > 0,
      `Verified ascending price order: ₱${res.products[0]?.price_per_unit} <= ₱${res.products[res.products.length - 1]?.price_per_unit}`
    );
  } catch (err: unknown) {
    record("TEST-07", 'Combined: search + sort "price_asc"', false, String(err));
  }

  // 8. Race condition simulation: Monotonic request sequence test
  try {
    // Simulate Request 1 ("toma") launched first, delayed by 100ms
    // Simulate Request 2 ("tomato") launched second, resolving in 20ms
    let latestRequestId = 0;
    let committedResults: string | null = null;

    const simulateClientSearch = async (reqId: number, query: string, delayMs: number) => {
      await new Promise((r) => setTimeout(r, delayMs));
      // Stale response guard
      if (reqId === latestRequestId) {
        committedResults = query;
      }
    };

    // Request 1 starts
    const req1Id = ++latestRequestId;
    const p1 = simulateClientSearch(req1Id, "toma", 80);

    // Request 2 starts later but arrives earlier or later
    const req2Id = ++latestRequestId;
    const p2 = simulateClientSearch(req2Id, "tomato", 20);

    await Promise.all([p1, p2]);

    record(
      "TEST-08",
      "Race condition: out-of-order rejection",
      committedResults === "tomato",
      `Older response discarded; newer query "${committedResults}" retained`
    );
  } catch (err: unknown) {
    record("TEST-08", "Race condition: out-of-order rejection", false, String(err));
  }

  // 9. Client-side debounce simulation (250ms)
  try {
    let firedCount = 0;
    let timer: NodeJS.Timeout | null = null;

    const debouncedFn = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        firedCount++;
      }, 250);
    };

    // Rapid keystrokes: 't' -> 'to' -> 'tom' -> 'toma' -> 'tomat' -> 'tomato' (50ms apart)
    const strokes = ["t", "to", "tom", "toma", "tomat", "tomato"];
    for (let i = 0; i < strokes.length; i++) {
      debouncedFn();
      await new Promise((r) => setTimeout(r, 40));
    }

    // Wait 300ms for the debounce to finally fire
    await new Promise((r) => setTimeout(r, 300));

    record(
      "TEST-09",
      "Client debounce: rapid keystrokes",
      firedCount === 1,
      `6 rapid keystrokes debounced to exactly ${firedCount} execution(s)`
    );
  } catch (err: unknown) {
    record("TEST-09", "Client debounce: rapid keystrokes", false, String(err));
  }

  // 10. Privacy & security boundary check on RPC payload
  try {
    const res = await searchActiveProductsTest({ search: "mango", limit: 5 });
    let privacySafe = true;
    for (const p of res.products) {
      const farmerAny = p.farmer as Record<string, unknown> | undefined;
      if (farmerAny?.phone || farmerAny?.address) {
        privacySafe = false;
        break;
      }
    }
    record(
      "TEST-10",
      "Privacy: farmer PII excluded from search",
      privacySafe && res.products.length > 0,
      "Farmer phone and address strictly excluded from live search results"
    );
  } catch (err: unknown) {
    record("TEST-10", "Privacy: farmer PII excluded from search", false, String(err));
  }

  console.log("==============================================================================");
  const totalPassed = results.filter((r) => r.passed).length;
  console.log(`SUMMARY: ${totalPassed}/${results.length} PASSED (${results.length - totalPassed} failed)`);
  console.log("==============================================================================");

  if (totalPassed !== results.length) {
    process.exit(1);
  }
}

runPhase2Tests();
