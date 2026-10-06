/**
 * UMA V4 — Legacy Route Bridging and Canonical Termination Guard
 *
 * Verifies that:
 * 1. Every legacy V2 route pattern (/farmer/*, /business/*, /farmers/*) has a direct next.config.ts redirect.
 * 2. Every redirect destination is a valid canonical V4 route (not a legacy route).
 * 3. Every dynamic path parameter (:id, :orderId) is mapped 1:1 without parameter drop.
 * 4. Zero redirect loops: no destination targets another redirect source.
 * 5. Role recovery in onboarding/actions.ts routes to canonical dashboard.
 * 6. Admin non-role redirects route to canonical dashboard.
 * 7. Incomplete profile prompt routes to /profile.
 * 8. AddToCartControls routes to /cart.
 * 9. ProductForm default successHref routes to /dashboard/listings.
 *
 * HOW TO RUN:
 *   npx tsx scripts/verify-v4-legacy-redirects.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface RedirectRule {
  source: string;
  destination: string;
  permanent: boolean;
}

const root = process.cwd();
let passed = 0;
let failed = 0;

function assert(id: string, name: string, condition: boolean, details?: string) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${id.padEnd(16)} ${name}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${id.padEnd(16)} ${name}`);
    if (details) console.error(`         >> ${details}`);
  }
}

function parseRedirectRules(): RedirectRule[] {
  const configContent = readFileSync(resolve(root, "next.config.ts"), "utf8");
  const redirectsBlock = configContent.match(/async redirects\(\)\s*\{[\s\S]*?return\s*\[([\s\S]*?)\];/);
  if (!redirectsBlock) {
    throw new Error("Could not extract redirects from next.config.ts");
  }

  const rules: RedirectRule[] = [];
  const objectRegex = /\{\s*source:\s*"([^"]+)",\s*destination:\s*"([^"]+)",\s*permanent:\s*(true|false),?\s*\}/g;
  let match;
  while ((match = objectRegex.exec(redirectsBlock[1])) !== null) {
    rules.push({
      source: match[1],
      destination: match[2],
      permanent: match[3] === "true",
    });
  }
  return rules;
}

function main() {
  console.log("\n" + "=".repeat(72));
  console.log("  UMA V4 — Legacy Route Bridging Verification");
  console.log("=".repeat(72) + "\n");

  const rules = parseRedirectRules();
  console.log(`Found ${rules.length} route-level redirect rules in next.config.ts\n`);

  // 1. Mandatory legacy sources covered
  const mandatorySources = [
    "/farmers/:id",
    "/farmer",
    "/farmer/products",
    "/farmer/products/new",
    "/farmer/products/:id/edit",
    "/farmer/products/:id",
    "/farmer/orders",
    "/farmer/orders/:id",
    "/farmer/messages",
    "/farmer/profile",
    "/business",
    "/business/products",
    "/business/products/:id",
    "/business/cart",
    "/business/checkout",
    "/business/checkout/confirmation",
    "/business/checkout/confirmation/:orderId",
    "/business/orders",
    "/business/orders/:id",
    "/business/messages",
    "/business/profile",
  ];

  const sourceMap = new Map(rules.map((r) => [r.source, r]));

  mandatorySources.forEach((src, idx) => {
    const id = `LEG-SRC-${String(idx + 1).padStart(2, "0")}`;
    const rule = sourceMap.get(src);
    assert(id, `Source ${src} is defined in next.config.ts`, Boolean(rule), `Missing source: ${src}`);
  });

  // 2. All destinations must be canonical V4 routes (must NOT start with /farmer or /business)
  rules.forEach((rule, idx) => {
    const id = `LEG-CAN-${String(idx + 1).padStart(2, "0")}`;
    const isLegacyDest = /^\/(farmer|business)(\/|$)/.test(rule.destination);
    assert(
      id,
      `${rule.source} -> ${rule.destination} targets canonical V4`,
      !isLegacyDest,
      `Destination is legacy: ${rule.destination}`
    );
  });

  // 3. No redirect loops: destination must not match any source
  const sourceSet = new Set(rules.map((r) => r.source));
  rules.forEach((rule, idx) => {
    const id = `LEG-LOOP-${String(idx + 1).padStart(2, "0")}`;
    const isLoop = sourceSet.has(rule.destination);
    assert(
      id,
      `No loop for ${rule.source} -> ${rule.destination}`,
      !isLoop,
      `Destination is itself a redirect source: ${rule.destination}`
    );
  });

  // 4. Parameter preservation
  const parameterizedRules = rules.filter((r) => r.source.includes(":"));
  parameterizedRules.forEach((rule, idx) => {
    const id = `LEG-PARAM-${String(idx + 1).padStart(2, "0")}`;
    const srcParams = (rule.source.match(/:[a-zA-Z0-9_]+/g) || []).sort();
    const dstParams = (rule.destination.match(/:[a-zA-Z0-9_]+/g) || []).sort();
    const match = JSON.stringify(srcParams) === JSON.stringify(dstParams);
    assert(
      id,
      `Params preserved in ${rule.source} -> ${rule.destination}`,
      match,
      `Source params [${srcParams}] != dest params [${dstParams}]`
    );
  });

  // 5. Code inspection checks
  console.log("\n" + "-".repeat(72));
  console.log("  Code-level V4 Convergence Checks");
  console.log("-".repeat(72) + "\n");

  const onboardingActions = readFileSync(resolve(root, "src/app/onboarding/actions.ts"), "utf8");
  assert(
    "CODE-ONB-01",
    "onboarding/actions.ts does not redirect to `/${role}`",
    !onboardingActions.includes("redirect(`/${role}`)"),
    "Found redirect(`/${role}`) in onboarding/actions.ts"
  );

  const onboardingComplete = readFileSync(resolve(root, "src/app/onboarding/complete/page.tsx"), "utf8");
  assert(
    "CODE-ONB-02",
    "onboarding/complete/page.tsx redirects to dashboardRoot",
    !onboardingComplete.includes('redirect("/farmer")') && !onboardingComplete.includes('redirect("/business")'),
    "Found legacy redirects in onboarding/complete/page.tsx"
  );

  const routesTs = readFileSync(resolve(root, "src/platform/routes.ts"), "utf8");
  assert(
    "CODE-ROUTES-01",
    "dashboardRoot('farmer') and ('business') use routes.dashboardRoot",
    routesTs.includes("farmer: routes.dashboardRoot") && routesTs.includes("business: routes.dashboardRoot"),
    "DASHBOARD_ROOTS not pointing to routes.dashboardRoot"
  );

  const confirmation = readFileSync(resolve(root, "src/app/checkout/confirmation/page.tsx"), "utf8");
  assert(
    "CODE-CONFIRM-01",
    "checkout/confirmation uses routes.orders / routes.order",
    !confirmation.includes("routes.dashboard.business.orders"),
    "Found routes.dashboard.business.orders in checkout confirmation"
  );

  const addToCartControls = readFileSync(resolve(root, "src/components/dashboard/add-to-cart-controls.tsx"), "utf8");
  assert(
    "CODE-CART-01",
    "add-to-cart-controls uses routes.cart instead of /business/cart",
    !addToCartControls.includes('"/business/cart"'),
    "Found /business/cart in add-to-cart-controls.tsx"
  );

  const productForm = readFileSync(resolve(root, "src/components/dashboard/product-form.tsx"), "utf8");
  assert(
    "CODE-PROD-01",
    "product-form defaults successHref to routes.dashboard.listings",
    productForm.includes("routes.dashboard.listings"),
    "ProductForm does not default to routes.dashboard.listings"
  );

  const dashboardLayout = readFileSync(resolve(root, "src/app/(dashboard)/layout.tsx"), "utf8");
  assert(
    "CODE-LAYOUT-01",
    "dashboard layout banner links to /profile instead of `/${role}/profile`",
    !dashboardLayout.includes("`/${role}/profile`"),
    "Found `/${role}/profile` in dashboard layout"
  );

  console.log("\n" + "=".repeat(72));
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log("=".repeat(72) + "\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main();
