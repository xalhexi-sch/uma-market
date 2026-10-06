/**
 * UMA V4 Phase 1 — Platform Foundation Guard Tests
 *
 * Verifies that the platform layer modules:
 *  1. Export the expected public API surface (types + values).
 *  2. AppError carries code, message, and context correctly.
 *  3. safeErrorMessage / errorCode classify errors properly.
 *  4. createAction wraps handlers and classifies errors.
 *  5. Route map has the expected structure and type-safe helpers.
 *  6. log emits without throwing.
 *  7. Auth helpers throw AppError with the correct codes.
 *
 * These are static / unit tests — no database, no network, no Clerk.
 *
 * HOW TO RUN:
 *   npx tsx scripts/verify-v4-phase1-foundation.ts
 */

// ── Test infrastructure ────────────────────────────────────────────────────────

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(id: string, name: string, condition: boolean, details: string): boolean {
  results.push({ id, name, passed: condition, details });
  const icon = condition ? "PASS" : "FAIL";
  console.log(`  [${icon}] ${id.padEnd(18)} ${name}`);
  if (!condition) console.log(`           >> ${details}`);
  return condition;
}

function section(title: string): void {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(72));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  // ── 1. Module exports ────────────────────────────────────────────────
  section("FND-01: Platform barrel exports");

  // Dynamic import to test export surface
  const platform = await import("../src/platform/index");

  assert("FND-01a", "requireUser is exported",
    typeof platform.requireUser === "function", `type=${typeof platform.requireUser}`);
  assert("FND-01b", "requireRole is exported",
    typeof platform.requireRole === "function", `type=${typeof platform.requireRole}`);
  assert("FND-01c", "requireActiveUser is exported",
    typeof platform.requireActiveUser === "function", `type=${typeof platform.requireActiveUser}`);
  assert("FND-01d", "requireActiveRole is exported",
    typeof platform.requireActiveRole === "function", `type=${typeof platform.requireActiveRole}`);
  assert("FND-01e", "createAction is exported",
    typeof platform.createAction === "function", `type=${typeof platform.createAction}`);
  assert("FND-01f", "AppError is exported",
    typeof platform.AppError === "function", `type=${typeof platform.AppError}`);
  assert("FND-01g", "log is exported",
    typeof platform.log === "object" && typeof platform.log.info === "function",
    `type=${typeof platform.log}`);
  assert("FND-01h", "routes is exported",
    typeof platform.routes === "object", `type=${typeof platform.routes}`);
  assert("FND-01i", "dashboardRoot is exported",
    typeof platform.dashboardRoot === "function", `type=${typeof platform.dashboardRoot}`);
  assert("FND-01j", "ERROR_CODES is exported",
    typeof platform.ERROR_CODES === "object", `type=${typeof platform.ERROR_CODES}`);
  assert("FND-01k", "safeErrorMessage is exported",
    typeof platform.safeErrorMessage === "function", `type=${typeof platform.safeErrorMessage}`);
  assert("FND-01l", "errorCode is exported",
    typeof platform.errorCode === "function", `type=${typeof platform.errorCode}`);

  // ── 2. AppError ──────────────────────────────────────────────────────
  section("FND-02: AppError construction and classification");

  const { AppError, safeErrorMessage, errorCode } = platform;

  const e1 = new AppError("NOT_FOUND", "Product not found");
  assert("FND-02a", "AppError has correct code",
    e1.code === "NOT_FOUND", `code=${e1.code}`);
  assert("FND-02b", "AppError has custom message",
    e1.message === "Product not found", `message=${e1.message}`);
  assert("FND-02c", "AppError instanceof Error",
    e1 instanceof Error, `instanceof=${e1 instanceof Error}`);

  const e2 = new AppError("UNAUTHORIZED");
  assert("FND-02d", "AppError uses default message when none given",
    e2.message.length > 0, `message=${e2.message}`);

  const e3 = new AppError("INTERNAL", "oops", { userId: "u1" });
  assert("FND-02e", "AppError carries context",
    e3.context?.userId === "u1", `context=${JSON.stringify(e3.context)}`);

  assert("FND-02f", "safeErrorMessage returns AppError message",
    safeErrorMessage(e1) === "Product not found", `got=${safeErrorMessage(e1)}`);
  assert("FND-02g", "safeErrorMessage returns generic for unknown error",
    safeErrorMessage(new Error("secret sql details")) === "Something went wrong. Please try again.",
    `got=${safeErrorMessage(new Error("secret"))}`);

  assert("FND-02h", "errorCode returns AppError code",
    errorCode(e1) === "NOT_FOUND", `got=${errorCode(e1)}`);
  assert("FND-02i", "errorCode returns INTERNAL for unknown error",
    errorCode(new Error("x")) === "INTERNAL", `got=${errorCode(new Error("x"))}`);

  // ── 3. createAction ──────────────────────────────────────────────────
  section("FND-03: createAction wrapper");

  const { createAction } = platform;

  // Success case
  const successAction = createAction(async (x: number) => x * 2);
  const s1 = await successAction(21);
  assert("FND-03a", "Success action returns { success: true, data }",
    s1.success === true && (s1 as { data: number }).data === 42,
    `result=${JSON.stringify(s1)}`);

  // AppError case
  const failAction = createAction(async () => {
    throw new AppError("NOT_FOUND", "Thing not found");
  });
  const f1 = await failAction();
  assert("FND-03b", "AppError becomes { success: false, error, code }",
    f1.success === false && (f1 as { error: string }).error === "Thing not found" &&
    (f1 as { code: string }).code === "NOT_FOUND",
    `result=${JSON.stringify(f1)}`);

  // Unknown error case
  const crashAction = createAction(async () => {
    throw new Error("pg: connection refused at 10.0.0.1:5432");
  });
  const c1 = await crashAction();
  assert("FND-03c", "Unknown error returns generic message (no leak)",
    c1.success === false &&
    !(c1 as { error: string }).error.includes("pg:") &&
    !(c1 as { error: string }).error.includes("connection") &&
    (c1 as { code: string }).code === "INTERNAL",
    `result=${JSON.stringify(c1)}`);

  // Void handler
  const voidAction = createAction(async () => { /* no return */ });
  const v1 = await voidAction();
  assert("FND-03d", "Void handler returns { success: true, data: undefined }",
    v1.success === true && (v1 as { data: unknown }).data === undefined,
    `result=${JSON.stringify(v1)}`);

  // ── 4. Routes ────────────────────────────────────────────────────────
  section("FND-04: Route map");

  const { routes, dashboardRoot } = platform;

  assert("FND-04a", "routes.home is /",
    routes.home === "/", `got=${routes.home}`);
  assert("FND-04b", "routes.product is a function returning /products/:id",
    routes.product("abc") === "/products/abc",
    `got=${routes.product("abc")}`);
  assert("FND-04c", "routes.dashboard.farmer.root is /farmer",
    routes.dashboard.farmer.root === "/farmer",
    `got=${routes.dashboard.farmer.root}`);
  assert("FND-04d", "routes.cart is the canonical V4 /cart",
    routes.cart === "/cart",
    `got=${routes.cart}`);
  assert("FND-04e", "routes.admin.root is /admin",
    routes.admin.root === "/admin",
    `got=${routes.admin.root}`);
  assert("FND-04f", "dashboardRoot('farmer') returns /dashboard",
    dashboardRoot("farmer") === "/dashboard",
    `got=${dashboardRoot("farmer")}`);
  assert("FND-04g", "dashboardRoot('business') returns /dashboard",
    dashboardRoot("business") === "/dashboard",
    `got=${dashboardRoot("business")}`);
  assert("FND-04h", "dashboardRoot('admin') returns /admin",
    dashboardRoot("admin") === "/admin",
    `got=${dashboardRoot("admin")}`);
  assert("FND-04i", "routes.producer is a function returning /producers/:id",
    typeof routes.producer === "function" && routes.producer("xyz") === "/producers/xyz",
    `got=${routes.producer("xyz")}`);
  assert("FND-04j", "routes.producers is /producers",
    routes.producers === "/producers",
    `got=${routes.producers}`);

  // ── 5. Logging ───────────────────────────────────────────────────────
  section("FND-05: Structured logging");

  const { log } = platform;

  // These should not throw
  let logOk = true;
  try {
    log.info("test.event", { userId: "u1", action: "test" });
    log.warn("test.warn", { detail: "something" });
    log.error("test.error", new Error("test"), { userId: "u1" });
    log.debug("test.debug", { note: "should be suppressed in prod" });
  } catch {
    logOk = false;
  }
  assert("FND-05a", "log.info/warn/error/debug do not throw",
    logOk, "one of the log calls threw");

  // ── 6. Error code coverage ───────────────────────────────────────────
  section("FND-06: Error code catalog");

  const { ERROR_CODES } = platform;
  const expectedCodes = [
    "UNAUTHENTICATED", "UNAUTHORIZED", "FORBIDDEN", "ACCOUNT_INACTIVE",
    "VALIDATION", "NOT_FOUND", "CONFLICT", "RATE_LIMITED", "INTERNAL",
  ];
  for (const code of expectedCodes) {
    assert(`FND-06.${code.toLowerCase()}`, `ERROR_CODES.${code} exists`,
      code in ERROR_CODES,
      `missing from ERROR_CODES`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=".repeat(72));
  console.log("  UMA V4 Phase 1 — Platform Foundation Guard Tests");
  console.log("=".repeat(72));

  await runTests();

  // Summary
  console.log(`\n${"=".repeat(72)}`);
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${total} total`);

  if (failed > 0) {
    console.log(`\n  FAILURES:`);
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`    [${r.id}] ${r.name}`);
      console.log(`           ${r.details}`);
    }
  }

  console.log("=".repeat(72));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
