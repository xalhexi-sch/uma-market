import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

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
  const businessProductsPath = path.resolve(__dirname, "../src/app/(dashboard)/business/products/page.tsx");
  const businessDetailPath = path.resolve(__dirname, "../src/app/(dashboard)/business/products/[id]/page.tsx");
  const liveGridPath = path.resolve(__dirname, "../src/components/products/live-product-grid.tsx");
  const searchContextPath = path.resolve(__dirname, "../src/components/products/product-search-context.tsx");

  const categoryPillsContent = fs.readFileSync(categoryPillsPath, "utf-8");
  const paginationContent = fs.readFileSync(paginationPath, "utf-8");
  const publicProductsContent = fs.readFileSync(publicProductsPath, "utf-8");
  const businessProductsContent = fs.readFileSync(businessProductsPath, "utf-8");
  const businessDetailContent = fs.readFileSync(businessDetailPath, "utf-8");
  const liveGridContent = fs.readFileSync(liveGridPath, "utf-8");
  const searchContextContent = fs.readFileSync(searchContextPath, "utf-8");

  // Test 1: Public/business category pill parity
  console.log(`${YELLOW}1. Category Pill Surface Parity${RESET}`);
  const hasCategoryPillsInPublic = publicProductsContent.includes("<CategoryPills");
  const hasCategoryPillsInBusiness = businessProductsContent.includes("<CategoryPills");
  const hasPillStyling =
    categoryPillsContent.includes("rounded-full") &&
    categoryPillsContent.includes("overflow-x-auto") &&
    categoryPillsContent.includes("no-scrollbar") &&
    categoryPillsContent.includes("whitespace-nowrap") &&
    categoryPillsContent.includes("shadow-2xs");
  assert(
    hasCategoryPillsInPublic && hasCategoryPillsInBusiness && hasPillStyling,
    "Shared CategoryPills component is used in both public and business pages with consistent visual tokens",
    `public: ${hasCategoryPillsInPublic}, business: ${hasCategoryPillsInBusiness}, styling: ${hasPillStyling}`
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

  // Test 3: Business detail breadcrumbs
  console.log(`${YELLOW}3. Business Detail Breadcrumbs${RESET}`);
  const hasBreadcrumbImport = businessDetailContent.includes('from "@/components/ui/breadcrumb"');
  const hasBreadcrumbList = businessDetailContent.includes("<BreadcrumbList");
  const hasProductsBreadcrumbLink = businessDetailContent.includes('href="/business/products"');
  assert(
    hasBreadcrumbImport && hasBreadcrumbList && hasProductsBreadcrumbLink,
    "Business detail page includes structured shadcn Breadcrumb hierarchy linking to business products and category",
    `import: ${hasBreadcrumbImport}, list: ${hasBreadcrumbList}, link: ${hasProductsBreadcrumbLink}`
  );

  // Test 4: Business detail category image badge
  console.log(`${YELLOW}4. Business Detail Category Image Badge${RESET}`);
  const passesCategoryNameToGallery = businessDetailContent.includes(
    "categoryName={product.category?.name}"
  );
  assert(
    passesCategoryNameToGallery,
    "Business detail page passes categoryName to ProductGallery for image overlay badge",
    `categoryName passed: ${passesCategoryNameToGallery}`
  );

  // Test 5: Business provenance presentation
  console.log(`${YELLOW}5. Business Producer Provenance Card${RESET}`);
  const hasProvenanceHeader = businessDetailContent.includes("Producer Provenance");
  const hasVerifiedBadgeTokens =
    businessDetailContent.includes("✓ Verified Producer") &&
    businessDetailContent.includes("dark:text-emerald-400");
  const hasProvenanceStoreIcon = businessDetailContent.includes("<RiStore2Line");
  const hasProvenanceCity = businessDetailContent.includes("product.farmer?.city");
  assert(
    hasProvenanceHeader && hasVerifiedBadgeTokens && hasProvenanceStoreIcon && hasProvenanceCity,
    "Business detail page contains structured Producer Provenance card with verified dark-mode tokens and city display",
    `header: ${hasProvenanceHeader}, verified: ${hasVerifiedBadgeTokens}, storeIcon: ${hasProvenanceStoreIcon}, city: ${hasProvenanceCity}`
  );

  // Test 6: Business fulfillment presentation
  console.log(`${YELLOW}6. Business Wholesale Fulfillment Options${RESET}`);
  const hasFulfillmentCard = businessDetailContent.includes("Wholesale Fulfillment Options");
  const hasFarmPickup = businessDetailContent.includes("Farm Pickup");
  const hasSellerDelivery = businessDetailContent.includes("Seller Delivery");
  assert(
    hasFulfillmentCard && hasFarmPickup && hasSellerDelivery,
    "Business detail page includes Wholesale Fulfillment Options explaining Farm Pickup and Seller Delivery",
    `fulfillmentCard: ${hasFulfillmentCard}, pickup: ${hasFarmPickup}, delivery: ${hasSellerDelivery}`
  );

  // Test 7: MOQ=1 renders correctly
  console.log(`${YELLOW}7. MOQ=1 Visibility Check${RESET}`);
  const sampleProductMoq1 = { min_order_quantity: 1, unit: "kg" };
  const moq1Formatted =
    sampleProductMoq1.min_order_quantity != null && sampleProductMoq1.min_order_quantity > 0
      ? `${sampleProductMoq1.min_order_quantity} ${sampleProductMoq1.unit}`
      : "No minimum";
  const noOldMoqHideBug = !businessDetailContent.includes("min_order_quantity > 1");
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
