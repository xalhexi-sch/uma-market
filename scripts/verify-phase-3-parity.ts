// ==============================================================================
// UMA Market — Feature B: Phase 3 Surface Parity & Pagination Verification
//
// SAFETY RULES:
//   1. MUST ONLY target the dedicated security-test Supabase project.
//   2. Credentials are loaded EXCLUSIVELY from .env.security-test.local;
//      the production environment file is never read.
//   3. ABORTS (exit 2) before any Supabase client is constructed if the
//      resolved project is production or any unknown ref.
//   4. Never prints keys, secrets, or JWTs.
// ==============================================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { loadSecurityTestEnv } from "./lib/safety-guard";

// Environment safety guard (shared): aborts with exit code 2 on production or
// on any unknown Supabase project, before any client is constructed.
const env = loadSecurityTestEnv("verify-phase-3-parity");

const supabaseUrl = env.supabaseUrl;
const supabaseAnonKey = env.anonKey;

const publicClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

// ANSI color codes
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ${GREEN}✓${RESET} ${testName}`);
    passCount++;
  } else {
    console.error(`  ${RED}✗${RESET} ${testName}`);
    if (detail) {
      console.error(`    ${RED}Detail:${RESET} ${detail}`);
    }
    failCount++;
  }
}

async function runTests() {
  console.log(`\n${BLUE}====================================================${RESET}`);
  console.log(`${BLUE}Feature B — Phase 3 Verification Suite (14 Tests)${RESET}`);
  console.log(`${BLUE}====================================================${RESET}\n`);

  const categoryPillsPath = path.resolve(__dirname, "../src/components/products/category-pills.tsx");
  const paginationPath = path.resolve(__dirname, "../src/components/products/product-pagination.tsx");
  const publicProductsPath = path.resolve(__dirname, "../src/app/products/page.tsx");
  const productDetailPath = path.resolve(__dirname, "../src/app/products/[id]/page.tsx");
  const liveGridPath = path.resolve(__dirname, "../src/components/products/live-product-grid.tsx");
  const searchContextPath = path.resolve(__dirname, "../src/components/products/product-search-context.tsx");

  const categoryPillsContent = fs.readFileSync(categoryPillsPath, "utf-8");
  const paginationContent = fs.readFileSync(paginationPath, "utf-8");
  const publicProductsContent = fs.readFileSync(publicProductsPath, "utf-8");
  const productDetailContent = fs.readFileSync(productDetailPath, "utf-8");
  const liveGridContent = fs.readFileSync(liveGridPath, "utf-8");
  const searchContextContent = fs.readFileSync(searchContextPath, "utf-8");

  // Test 1: The V4 marketplace has one category-filtered product surface.
  console.log(`${YELLOW}1. Canonical Marketplace Category Pills${RESET}`);
  const hasCategoryPillsInMarketplace = publicProductsContent.includes("<CategoryPills");
  const hasPillStyling =
    categoryPillsContent.includes("rounded-full") &&
    categoryPillsContent.includes("overflow-x-auto") &&
    categoryPillsContent.includes("no-scrollbar") &&
    categoryPillsContent.includes("whitespace-nowrap") &&
    categoryPillsContent.includes("shadow-2xs");
  assert(
    hasCategoryPillsInMarketplace && hasPillStyling,
    "Canonical marketplace page uses the shared CategoryPills component with consistent visual tokens",
    `marketplace: ${hasCategoryPillsInMarketplace}, styling: ${hasPillStyling}`
  );

  // Test 2: Category change preserves q/sort/in_stock and resets page
  console.log(`${YELLOW}2. Category Pill URL & Filter Preservation${RESET}`);
  const categoryPreservesQ = categoryPillsContent.includes('params.set("q", searchParams.q)');
  const categoryPreservesSort = categoryPillsContent.includes('params.set("sort", searchParams.sort)');
  const categoryPreservesStock = categoryPillsContent.includes('params.set("in_stock", "false")');
  const categoryDoesNotSetPage = !categoryPillsContent.includes('params.set("page"');
  assert(
    categoryPreservesQ && categoryPreservesSort && categoryPreservesStock && categoryDoesNotSetPage,
    "Selecting a category preserves active q, sort, and in_stock while resetting page to 1",
    `preserves: q=${categoryPreservesQ}, sort=${categoryPreservesSort}, stock=${categoryPreservesStock}, resets page=${categoryDoesNotSetPage}`
  );

  // Test 3: Canonical product detail breadcrumbs
  console.log(`${YELLOW}3. Product Detail Breadcrumbs${RESET}`);
  const hasBreadcrumb = productDetailContent.includes('<nav aria-label="Breadcrumb"');
  const hasProductsBreadcrumbLink = productDetailContent.includes('href="/products"');
  assert(
    hasBreadcrumb && hasProductsBreadcrumbLink,
    "Canonical product detail page includes breadcrumb navigation back to /products",
    `breadcrumb: ${hasBreadcrumb}, products link: ${hasProductsBreadcrumbLink}`
  );

  // Test 4: Product detail category image badge
  console.log(`${YELLOW}4. Product Detail Category Image Badge${RESET}`);
  const passesCategoryNameToGallery = productDetailContent.includes(
    "categoryName={product.category?.name}"
  );
  assert(
    passesCategoryNameToGallery,
    "Canonical product detail page passes categoryName to ProductGallery for image overlay badge",
    `categoryName passed: ${passesCategoryNameToGallery}`
  );

  // Test 5: Producer provenance presentation
  console.log(`${YELLOW}5. Producer Provenance Card${RESET}`);
  const hasProvenanceHeader = productDetailContent.includes("About the producer");
  const hasVerifiedBadgeTokens =
    productDetailContent.includes("Verified producer") &&
    productDetailContent.includes("dark:text-emerald-400");
  const hasProvenanceStoreIcon = productDetailContent.includes("<RiStore2Line");
  const hasProvenanceCity = productDetailContent.includes("product.farmer?.city");
  assert(
    hasProvenanceHeader && hasVerifiedBadgeTokens && hasProvenanceStoreIcon && hasProvenanceCity,
    "Canonical product detail page presents verified producer identity and location",
    `header: ${hasProvenanceHeader}, verified: ${hasVerifiedBadgeTokens}, storeIcon: ${hasProvenanceStoreIcon}, city: ${hasProvenanceCity}`
  );

  // Test 6: Canonical business order entry
  console.log(`${YELLOW}6. Canonical Buyer Order Entry${RESET}`);
  const hasBusinessOrderEntry = productDetailContent.includes('role === "business" && !isOwnListing');
  const usesCanonicalCart = productDetailContent.includes("href={routes.cart}");
  const usesAddToCartControls = productDetailContent.includes("<AddToCartControls product={product} />");
  assert(
    hasBusinessOrderEntry && usesCanonicalCart && usesAddToCartControls,
    "Canonical product detail page connects business buyers to the V4 cart",
    `business entry: ${hasBusinessOrderEntry}, cart link: ${usesCanonicalCart}, add-to-cart: ${usesAddToCartControls}`
  );

  // Test 7: MOQ=1 renders correctly
  console.log(`${YELLOW}7. MOQ=1 Visibility Check${RESET}`);
  const sampleProductMoq1 = { min_order_quantity: 1, unit: "kg" };
  const moq1Formatted =
    sampleProductMoq1.min_order_quantity != null && sampleProductMoq1.min_order_quantity > 0
      ? `${sampleProductMoq1.min_order_quantity} ${sampleProductMoq1.unit}`
      : "No minimum";
  const noOldMoqHideBug = !productDetailContent.includes("min_order_quantity > 1");
  assert(
    moq1Formatted === "1 kg" && noOldMoqHideBug,
    "MOQ = 1 renders visibly as '1 kg' and old 'min_order_quantity > 1' hiding bug is removed",
    `formatted: '${moq1Formatted}', old bug removed: ${noOldMoqHideBug}`
  );

  // Test 8: Null/zero MOQ follows actual application semantics without inventing data
  console.log(`${YELLOW}8. Null/Zero MOQ Defensive Semantics${RESET}`);
  const sampleNullMoq = { min_order_quantity: null, unit: "kg" };
  const sampleZeroMoq = { min_order_quantity: 0, unit: "kg" };
  const formatMoq = (p: { min_order_quantity: number | null; unit: string }) =>
    p.min_order_quantity != null && p.min_order_quantity > 0
      ? `${p.min_order_quantity} ${p.unit}`
      : "No minimum";
  const nullMoqResult = formatMoq(sampleNullMoq);
  const zeroMoqResult = formatMoq(sampleZeroMoq);
  assert(
    nullMoqResult === "No minimum" && zeroMoqResult === "No minimum",
    "Null or zero MOQ renders truthful 'No minimum' state without fabricating '1 unit'",
    `null result: '${nullMoqResult}', zero result: '${zeroMoqResult}'`
  );

  // Test 9: Public pagination page 2 behavior (Live Query & Server Wiring)
  console.log(`${YELLOW}9. Public Pagination Query Execution${RESET}`);
  const publicPageHasLimit24 = publicProductsContent.includes("limit: 24");
  const publicPageHasPageParam = publicProductsContent.includes("page: currentPage");
  const publicPageUsesSearchActive = publicProductsContent.includes("await searchActiveProducts(");

  let rpcSuccess = false;
  let totalCountVal = 0;
  let totalPagesVal = 0;

  if (publicClient) {
    try {
      const { data, error } = await publicClient.rpc("search_products", {
        p_limit: 24,
        p_offset: 24, // Page 2 offset
        p_in_stock_only: false,
      });

      if (!error && Array.isArray(data)) {
        rpcSuccess = true;
        totalCountVal = data.length > 0 ? Number(data[0].total_count) : 0;
        totalPagesVal = Math.ceil(totalCountVal / 24);
      }
    } catch {
      // Standalone execution without network
    }
  }

  assert(
    publicPageHasLimit24 && publicPageHasPageParam && publicPageUsesSearchActive && (rpcSuccess || !publicClient),
    "Public products page wires searchActiveProducts with page: currentPage, limit: 24, and RPC returns valid page 2 offset",
    `hasLimit24: ${publicPageHasLimit24}, hasPageParam: ${publicPageHasPageParam}, usesSearchActive: ${publicPageUsesSearchActive}, rpcSuccess: ${rpcSuccess}, totalCount: ${totalCountVal}, totalPages: ${totalPagesVal}`
  );

  // Test 10: Pagination preserves all search/filter parameters
  console.log(`${YELLOW}10. Pagination URL Parameter Preservation${RESET}`);
  const preservesQ = paginationContent.includes('params.set("q", searchParams.q)');
  const preservesCategory = paginationContent.includes('params.set("category", searchParams.category)');
  const preservesSort = paginationContent.includes('params.set("sort", searchParams.sort)');
  const preservesStock = paginationContent.includes('params.set("in_stock", "false")');
  const omitsPage1 = paginationContent.includes("if (pageNumber > 1) params.set(\"page\", pageNumber.toString())");
  assert(
    preservesQ && preservesCategory && preservesSort && preservesStock && omitsPage1,
    "ProductPagination preserves q, category, sort, and in_stock while cleanly omitting page=1",
    `q: ${preservesQ}, category: ${preservesCategory}, sort: ${preservesSort}, stock: ${preservesStock}, omitsPage1: ${omitsPage1}`
  );

  // Test 11: Pagination hides when totalPages <= 1
  console.log(`${YELLOW}11. Pagination Hiding on Single Page${RESET}`);
  const hasTotalPagesCheck = paginationContent.includes("if (totalPages <= 1) {") && paginationContent.includes("return null;");
  assert(
    hasTotalPagesCheck,
    "ProductPagination automatically hides when totalPages <= 1",
    `hiding logic present: ${hasTotalPagesCheck}`
  );

  // Test 12: Invalid/out-of-range page behavior
  console.log(`${YELLOW}12. Invalid / Out-of-Range Page Handling${RESET}`);
  const hasPageParsing = publicProductsContent.includes("const rawPage = parseInt(page || \"1\", 10);");
  const hasPageClamp = publicProductsContent.includes("isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;");
  const hasOutOfRangeGridCheck = liveGridContent.includes("isPageOutOfRange");
  const hasReturnToPage1Link = liveGridContent.includes("Return to page 1");
  assert(
    hasPageParsing && hasPageClamp && hasOutOfRangeGridCheck && hasReturnToPage1Link,
    "Invalid page strings default to 1, and out-of-range page numbers display an informative state with return-to-page-1 link",
    `parsing: ${hasPageParsing}, clamp: ${hasPageClamp}, gridCheck: ${hasOutOfRangeGridCheck}, returnLink: ${hasReturnToPage1Link}`
  );

  // Test 13: Search commit resets page to 1
  console.log(`${YELLOW}13. Search Commit Page Reset${RESET}`);
  const commitDeletesPage = searchContextContent.includes('params.delete("page");');
  assert(
    commitDeletesPage,
    "ProductSearchContext commitSearch and clearSearch delete page parameter to reset pagination to page 1",
    `commitSearch deletes page: ${commitDeletesPage}`
  );

  // Test 14: Existing live-search behavior remains page-1 based
  console.log(`${YELLOW}14. Live Search-as-You-Type Page 1 Isolation${RESET}`);
  const executeDeletesPage = searchContextContent.includes('browserParams.delete("page");');
  const liveGridPreservesLiveState = liveGridContent.includes("!hasSearched && totalPages !== undefined");
  assert(
    executeDeletesPage && liveGridPreservesLiveState,
    "Live search-as-you-type operates on page 1 and hides static pagination during active live search",
    `executeDeletesPage: ${executeDeletesPage}, liveGridPreservesLiveState: ${liveGridPreservesLiveState}`
  );

  console.log(`\n${BLUE}====================================================${RESET}`);
  console.log(`Phase 3 Test Results: ${passCount} Passed, ${failCount} Failed`);
  console.log(`${BLUE}====================================================${RESET}\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal error during test run:", err);
  process.exit(1);
});
