import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const client = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface RpcProduct {
  name: string;
  category?: { slug: string; name: string } | null;
}

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testId: string, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ ${GREEN}PASS${RESET} | ${testId.padEnd(8)} | ${testName}`);
    passCount++;
  } else {
    console.error(`❌ ${RED}FAIL${RESET} | ${testId.padEnd(8)} | ${testName}`);
    if (detail) {
      console.error(`          ${RED}Detail:${RESET} ${detail}`);
    }
    failCount++;
  }
}

async function run() {
  console.log(`\n${BLUE}==============================================================================${RESET}`);
  console.log(`${BLUE}UMA Market — Search + Category + Filter Regression Verification Suite${RESET}`);
  console.log(`${BLUE}==============================================================================${RESET}\n`);

  // ─── PART 1: Database & RPC Authoritative Behavior ───

  // Case A: category alone
  const { data: dRiceAlone } = await client.rpc("search_products", {
    p_category_slug: "rice-grains",
    p_in_stock_only: true,
    p_sort: "relevance",
    p_limit: 48,
    p_offset: 0,
  });
  const riceRows = (dRiceAlone ?? []) as unknown as RpcProduct[];
  const allRiceGrains = riceRows.length > 0 && riceRows.every((p) => p.category?.slug === "rice-grains");
  assert(
    allRiceGrains,
    "TEST-01",
    "Case A: Category alone (rice-grains) returns only Rice & Grains listings",
    `Count: ${riceRows.length}, allRiceGrains: ${allRiceGrains}`
  );

  // Case B: search alone across categories
  const { data: dFreshAlone } = await client.rpc("search_products", {
    p_search: "fresh",
    p_in_stock_only: true,
    p_sort: "relevance",
    p_limit: 48,
    p_offset: 0,
  });
  const freshRows = (dFreshAlone ?? []) as unknown as RpcProduct[];
  const categoriesInFresh = new Set(freshRows.map((p) => p.category?.slug));
  const hasGingerInFresh = freshRows.some((p) => p.name.includes("Ginger"));
  assert(
    freshRows.length > 1 && categoriesInFresh.size > 1 && hasGingerInFresh,
    "TEST-02",
    "Case B: Search 'fresh' alone matches across multiple categories (including Ginger)",
    `Count: ${freshRows.length}, unique categories: ${categoriesInFresh.size}, hasGinger: ${hasGingerInFresh}`
  );

  // Case C: search 'fresh' + category 'rice-grains' MUST return 0 products and strictly exclude Ginger
  const { data: dFreshRice } = await client.rpc("search_products", {
    p_search: "fresh",
    p_category_slug: "rice-grains",
    p_in_stock_only: true,
    p_sort: "relevance",
    p_limit: 48,
    p_offset: 0,
  });
  const freshRiceRows = (dFreshRice ?? []) as unknown as RpcProduct[];
  const gingerInFreshRice = freshRiceRows.some((p) => p.name.includes("Ginger"));
  assert(
    freshRiceRows.length === 0 && !gingerInFreshRice,
    "TEST-03",
    "Case C: Search 'fresh' + category 'rice-grains' returns 0 results (Ginger strictly excluded)",
    `Count: ${freshRiceRows.length}, contains ginger: ${gingerInFreshRice}`
  );

  // Case D: search 'fresh' + category 'vegetables' MUST return only Vegetables
  const { data: dFreshVeg } = await client.rpc("search_products", {
    p_search: "fresh",
    p_category_slug: "vegetables",
    p_in_stock_only: true,
    p_sort: "relevance",
    p_limit: 48,
    p_offset: 0,
  });
  const freshVegRows = (dFreshVeg ?? []) as unknown as RpcProduct[];
  const allVegetables = freshVegRows.length > 0 && freshVegRows.every((p) => p.category?.slug === "vegetables");
  const gingerInFreshVeg = freshVegRows.some((p) => p.name.includes("Ginger"));
  assert(
    freshVegRows.length > 0 && allVegetables && !gingerInFreshVeg,
    "TEST-04",
    "Case D: Search 'fresh' + category 'vegetables' strictly isolates vegetables",
    `Count: ${freshVegRows.length}, allVeg: ${allVegetables}, contains ginger: ${gingerInFreshVeg}`
  );

  // ─── PART 2: Client Component State Synchronization ───

  const searchContextFile = fs.readFileSync(
    path.resolve(__dirname, "../src/components/products/product-search-context.tsx"),
    "utf-8"
  );
  const productFiltersFile = fs.readFileSync(
    path.resolve(__dirname, "../src/components/products/product-filters.tsx"),
    "utf-8"
  );

  // Case E: ProductSearchProvider prop tracking for category
  const tracksCategory = searchContextFile.includes("prevProps.initialCategory !== initialCategory");
  const tracksSort = searchContextFile.includes("prevProps.initialSort !== initialSort");
  const tracksStock = searchContextFile.includes("prevProps.initialInStockOnly !== initialInStockOnly");
  const resetsLiveProductsOnPropChange = searchContextFile.includes("setLiveProducts(null);");
  const resetsHasSearchedOnPropChange = searchContextFile.includes("setHasSearched(false);");

  assert(
    tracksCategory && tracksSort && tracksStock && resetsLiveProductsOnPropChange && resetsHasSearchedOnPropChange,
    "TEST-05",
    "Case E: ProductSearchProvider synchronizes external prop changes (category/sort/in_stock) and resets stale live search results",
    `tracksCategory: ${tracksCategory}, tracksSort: ${tracksSort}, tracksStock: ${tracksStock}`
  );

  // Case F: Desktop Apply button commits sort and availability
  const applyButtonCallsHandleApply = productFiltersFile.includes("onClick={() => handleApply()}");
  const desktopApplyNotNoOp = !productFiltersFile.includes("searchContext.commitSearch(draftSearch);");
  assert(
    applyButtonCallsHandleApply,
    "TEST-06",
    "Case F: Desktop Apply button calls handleApply() directly to commit sort & availability",
    `callsHandleApply: ${applyButtonCallsHandleApply}, bypassesCommitSearch: ${desktopApplyNotNoOp}`
  );

  // Enter key commits search and active filter state
  const enterKeyCommitsFilters = productFiltersFile.includes("handleApply({ search: draftSearch });");
  assert(
    enterKeyCommitsFilters,
    "TEST-07",
    "Search input Enter key commits query while preserving draft sort and availability",
    `enterKeyCommitsFilters: ${enterKeyCommitsFilters}`
  );

  console.log(`\n${BLUE}==============================================================================${RESET}`);
  console.log(`SUMMARY: ${passCount}/${passCount + failCount} PASSED (${failCount} failed)`);
  console.log(`${BLUE}==============================================================================${RESET}\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

run();
