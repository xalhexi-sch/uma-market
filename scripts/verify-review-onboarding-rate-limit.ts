// =============================================================================
// UMA Market — review / onboarding rate-limit verification suite
//
// STATIC + PURE SUITE — no network, no database, no auth, no mutation.
// Safe to run anywhere: npx tsx scripts/verify-review-onboarding-rate-limit.ts
//
// Guards the targeted abuse limits on the two Task-3A-2 mutation endpoints:
//   1. The review-submission mutations (`createSellerReview` and
//      `createProductReview` in review-actions.ts — the repository's
//      `submitOrderReview` surface, confirmed by task owner) BOTH consume ONE
//      shared per-user budget (`reviewRateLimit`, keyed `review:${userId}`,
//      10 attempts / 60s).
//   2. `completeOnboarding` consumes `onboardingRateLimit`
//      (keyed `onboarding:${userId}`, 5 attempts / 300s).
//   3. The limiter's own semantics: exactly `limit` requests are admitted per
//      window, the request after that is rejected, independent keys never
//      share state, and a rejection never extends the window.
//   4. Placement: auth/role authorization runs BEFORE the limiter, and the
//      limiter runs before validation/mutation in each action.
//   5. No second/inlined limiter implementation, and the pre-existing
//      checkout/message/product limiter contracts are unchanged.
//
// Limiter state is isolated per test case by using a fresh user id for each
// case, so no case can observe another case's counters.
//
// Exit code 0 = all assertions passed.
// =============================================================================

import * as fs from "fs";
import * as path from "path";
import * as rl from "../src/lib/rate-limit";

let passed = 0;
let failed = 0;

function check(id: string, name: string, condition: boolean, detail: string): void {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${id.padEnd(8)} ${name}`);
  } else {
    failed++;
    console.log(`  [FAIL] ${id.padEnd(8)} ${name}`);
    console.log(`           >> ${detail}`);
  }
}

function section(title: string): void {
  console.log(`\n${"=".repeat(74)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(74));
}

/** Configured budgets: review 10/60s, onboarding 5/300s, per user. */
const REVIEW_LIMIT = 10;
const ONBOARDING_LIMIT = 5;

type Limiter = (userId: string) => rl.RateLimitResult;

/** Resolves a preset from the shared limiter module, or null when absent. */
function requireLimiter(name: string): Limiter | null {
  const fn = (rl as unknown as Record<string, unknown>)[name];
  return typeof fn === "function" ? (fn as Limiter) : null;
}

let caseSeq = 0;
/** A fresh user id per case = a fresh limiter key = no cross-case state. */
function freshUser(label: string): string {
  caseSeq += 1;
  return `verify-rl-review-ob-${label}-${caseSeq}`;
}

/**
 * Full behavioural contract for one preset: admission up to the limit,
 * rejection past it, frozen window on rejection, per-key isolation, and
 * determinism across independent cases. Each case uses its own user id.
 */
function limiterContractSuite(
  prefix: string,
  presetName: string,
  limiter: Limiter | null,
  limit: number
): void {
  if (!limiter) {
    check(`${prefix}-1`, `Requests 1..${limit - 1} (below limit) are all admitted`, false,
      `${presetName} preset is absent from src/lib/rate-limit.ts`);
    check(`${prefix}-2`, `Exactly ${limit} requests are admitted within one window`, false,
      `${presetName} preset is absent from src/lib/rate-limit.ts`);
    check(`${prefix}-3`, `Request ${limit + 1} (above limit) is rejected`, false,
      `${presetName} preset is absent from src/lib/rate-limit.ts`);
    check(`${prefix}-4`, "The rejected request does not extend the window (resetAt frozen)", false,
      `${presetName} preset is absent from src/lib/rate-limit.ts`);
    check(`${prefix}-5`, "A saturated key does not leak into an independent key", false,
      `${presetName} preset is absent from src/lib/rate-limit.ts`);
    check(`${prefix}-6`, "Independent cases are order-independent and deterministic", false,
      `${presetName} preset is absent from src/lib/rate-limit.ts`);
    return;
  }

  // {prefix}-1: every request BELOW the limit is admitted.
  {
    const u = freshUser(`${prefix.toLowerCase()}-below`);
    const results = Array.from({ length: limit - 1 }, () => limiter(u));
    check(`${prefix}-1`, `Requests 1..${limit - 1} (below limit) are all admitted`,
      results.every((r) => r.success),
      `rejected early at index ${results.findIndex((r) => !r.success)}`);
  }

  // {prefix}-2: the window admits EXACTLY `limit` requests.
  {
    const u = freshUser(`${prefix.toLowerCase()}-at`);
    const admitted: boolean[] = [];
    for (let i = 0; i < limit; i++) admitted.push(limiter(u).success);
    check(`${prefix}-2`, `Exactly ${limit} requests are admitted within one window`,
      admitted.every(Boolean) && admitted.length === limit,
      `Admitted ${admitted.filter(Boolean).length}/${limit}`);
  }

  // {prefix}-3 / {prefix}-4: request past the limit is rejected without moving resetAt.
  {
    const u = freshUser(`${prefix.toLowerCase()}-above`);
    for (let i = 0; i < limit - 1; i++) limiter(u); // 1..limit-1
    const atLimit = limiter(u); // exactly at the limit
    const aboveLimit = limiter(u); // one past the limit
    check(`${prefix}-3`, `Request ${limit + 1} (above limit) is rejected`,
      !aboveLimit.success && aboveLimit.remaining === 0,
      `Got success=${aboveLimit.success} remaining=${aboveLimit.remaining}`);
    check(`${prefix}-4`, "The rejected request does not extend the window (resetAt frozen)",
      atLimit.resetAt === aboveLimit.resetAt,
      `resetAt moved from ${atLimit.resetAt} to ${aboveLimit.resetAt}`);
  }

  // {prefix}-5: independent keys never share state — saturating A leaves B untouched.
  {
    const a = freshUser(`${prefix.toLowerCase()}-iso-a`);
    for (let i = 0; i < limit + 1; i++) limiter(a);
    const b = freshUser(`${prefix.toLowerCase()}-iso-b`);
    const first = limiter(b);
    check(`${prefix}-5`, "A saturated key does not leak into an independent key",
      first.success && first.remaining === limit - 1,
      `Got success=${first.success} remaining=${first.remaining}`);
  }

  // {prefix}-6: two independent cases with the same shape produce identical results.
  {
    const run = (label: string) => {
      const u = freshUser(label);
      const first = limiter(u);
      for (let i = 1; i < limit + 1; i++) limiter(u);
      const overflow = limiter(u);
      return { firstOk: first.success, firstRemaining: first.remaining, overflowOk: overflow.success };
    };
    const one = run(`${prefix.toLowerCase()}-case-1`);
    const two = run(`${prefix.toLowerCase()}-case-2`);
    check(`${prefix}-6`, "Independent cases are order-independent and deterministic",
      one.firstOk === two.firstOk &&
        one.firstRemaining === two.firstRemaining &&
        one.overflowOk === two.overflowOk &&
        one.firstOk === true &&
        one.overflowOk === false,
      `case1=${JSON.stringify(one)} case2=${JSON.stringify(two)}`);
  }
}

// =============================================================================
section("SECTION 1 — review limiter semantics (behavioural, keyed per user)");
// =============================================================================

limiterContractSuite("RV", "reviewRateLimit", requireLimiter("reviewRateLimit"), REVIEW_LIMIT);

// =============================================================================
section("SECTION 2 — onboarding limiter semantics (behavioural, keyed per user)");
// =============================================================================

limiterContractSuite("ON", "onboardingRateLimit", requireLimiter("onboardingRateLimit"), ONBOARDING_LIMIT);

// =============================================================================
section("SECTION 3 — limiter module contract (source of rate-limit.ts)");
// =============================================================================

const rlSrc = fs
  .readFileSync(path.resolve(process.cwd(), "src/lib/rate-limit.ts"), "utf-8")
  .replace(/\r\n/g, "\n");

check("SC-1", "reviewRateLimit preset exists: key review:${userId}, 10 per 60s",
  /rateLimit\(`review:\$\{userId\}`, 10, 60_000\)/.test(rlSrc),
  "reviewRateLimit preset line not found (key/limit/window mismatch or missing)");
check("SC-2", "onboardingRateLimit preset exists: key onboarding:${userId}, 5 per 300s",
  /rateLimit\(`onboarding:\$\{userId\}`, 5, 300_000\)/.test(rlSrc),
  "onboardingRateLimit preset line not found (key/limit/window mismatch or missing)");
check("SC-3", "The generic rateLimit helper is still the single limiter implementation",
  (rlSrc.match(/export function rateLimit\(/g) ?? []).length === 1 &&
    !/["'`]@upstash\//.test(rlSrc),
  "Limiter implementation was replaced or duplicated");
check("SC-4", "Pre-existing checkout/message/product limiter contracts are unchanged",
  rlSrc.includes("rateLimit(`checkout:${userId}`, 10, 60_000)") &&
    rlSrc.includes("rateLimit(`message:${userId}`, 50, 60_000)") &&
    rlSrc.includes("rateLimit(`product-create:${userId}`, 20, 300_000)"),
  "A pre-existing preset line changed");

// =============================================================================
section("SECTION 4 — review mutations are protected at the boundary (source)");
// =============================================================================

const REVIEW_ACTIONS = "src/app/(dashboard)/business/orders/review-actions.ts";
const reviewSrc = fs
  .readFileSync(path.resolve(process.cwd(), REVIEW_ACTIONS), "utf-8")
  .replace(/\r\n/g, "\n");

/**
 * Blanks out comments and string/template literals while preserving offsets,
 * so braces can be counted without being fooled by a `}` inside a message.
 */
function blank(src: string): string {
  const out = src.split("");
  const n = out.length;
  let i = 0;
  let mode: "code" | "line" | "block" | "'" | '"' | "`" = "code";
  const blankChar = (idx: number) => {
    if (out[idx] !== "\n") out[idx] = " ";
  };
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (mode === "code") {
      if (c === "/" && d === "/") { blankChar(i); blankChar(i + 1); mode = "line"; i += 2; continue; }
      if (c === "/" && d === "*") { blankChar(i); blankChar(i + 1); mode = "block"; i += 2; continue; }
      if (c === "'" || c === '"' || c === "`") { mode = c; blankChar(i); i += 1; continue; }
      i += 1; continue;
    }
    if (mode === "line") {
      if (c === "\n") { mode = "code"; i += 1; continue; }
      blankChar(i); i += 1; continue;
    }
    if (mode === "block") {
      if (c === "*" && d === "/") { blankChar(i); blankChar(i + 1); mode = "code"; i += 2; continue; }
      blankChar(i); i += 1; continue;
    }
    if (c === "\\") { blankChar(i); if (i + 1 < n && src[i + 1] !== "\n") out[i + 1] = " "; i += 2; continue; }
    if (c === mode) { blankChar(i); mode = "code"; i += 1; continue; }
    blankChar(i); i += 1; continue;
  }
  return out.join("");
}

/** Returns the source of an exported async function, up to the next declaration. */
function functionSource(src: string, name: string): string | null {
  const header = new RegExp(`export async function ${name}\\s*\\(`).exec(src);
  if (!header) return null;
  const masked = blank(src);
  const tail = masked.slice(header.index + header[0].length);
  const next = /\n(?:export\s+)?(?:async\s+)?function\s/.exec(tail);
  const end = next ? header.index + header[0].length + next.index : src.length;
  return src.slice(header.index, end);
}

const sellerBody = functionSource(reviewSrc, "createSellerReview");
const productBody = functionSource(reviewSrc, "createProductReview");

check("RV-S1", "review-actions.ts still defines both review-submission mutations",
  sellerBody !== null && productBody !== null,
  `createSellerReview=${sellerBody !== null} createProductReview=${productBody !== null}`);

check("RV-S2", "review-actions.ts imports the shared reviewRateLimit helper",
  reviewSrc.includes('import { reviewRateLimit } from "@/lib/rate-limit"'),
  "Shared reviewRateLimit import missing");

check("RV-S3", "Both review mutations draw from the SAME shared budget (2 calls)",
  (reviewSrc.match(/reviewRateLimit\(/g) ?? []).length === 2,
  `reviewRateLimit calls=${(reviewSrc.match(/reviewRateLimit\(/g) ?? []).length}, expected 2`);

if (sellerBody && productBody) {
  for (const [label, body, dbMarker] of [
    ["createSellerReview", sellerBody, '.from("orders")'],
    ["createProductReview", productBody, '.from("orders")'],
  ] as const) {
    const authAt = body.indexOf("await auth()");
    const roleAt = body.indexOf('user_role !== "business"');
    const profileAt = body.indexOf("assertActiveProfile(");
    const limiterAt = body.indexOf("reviewRateLimit(");
    const dbAt = body.indexOf(dbMarker);

    check(`RV-S4`, `${label}: auth + role + active-profile checks precede the limiter`,
      authAt !== -1 && roleAt !== -1 && profileAt !== -1 && limiterAt !== -1 &&
        authAt < limiterAt && roleAt < limiterAt && profileAt < limiterAt,
      `auth=${authAt} role=${roleAt} profile=${profileAt} limiter=${limiterAt}`);

    check(`RV-S5`, `${label}: the limiter runs BEFORE any database work`,
      limiterAt !== -1 && dbAt !== -1 && limiterAt < dbAt,
      `limiterAt=${limiterAt} dbAt=${dbAt}`);
  }
}

check("RV-S6", "No inlined/bare rateLimit( call was added to review-actions.ts",
  !/\brateLimit\(/.test(reviewSrc),
  "A bare rateLimit( call was inlined instead of reusing reviewRateLimit");

// =============================================================================
section("SECTION 5 — completeOnboarding is protected at the boundary (source)");
// =============================================================================

const ONBOARDING_ACTIONS = "src/app/onboarding/actions.ts";
const onboardingSrc = fs
  .readFileSync(path.resolve(process.cwd(), ONBOARDING_ACTIONS), "utf-8")
  .replace(/\r\n/g, "\n");

const onboardingBody = functionSource(onboardingSrc, "completeOnboarding");

check("ON-S1", "actions.ts still defines completeOnboarding",
  onboardingBody !== null,
  "completeOnboarding not found");

check("ON-S2", "onboarding/actions.ts imports the shared onboardingRateLimit helper",
  onboardingSrc.includes('import { onboardingRateLimit } from "@/lib/rate-limit"'),
  "Shared onboardingRateLimit import missing");

if (onboardingBody) {
  const firstLimiterAt = onboardingBody.indexOf("onboardingRateLimit(");
  const limiterCalls = onboardingBody.match(/onboardingRateLimit\(/g) ?? [];
  const authAt = onboardingBody.indexOf("await auth()");
  const signInAt = onboardingBody.indexOf('redirect("/sign-in")');
  const adminAt = onboardingBody.indexOf('redirect("/admin")');
  const roleMismatchAt = onboardingBody.indexOf("could not be verified");
  const disallowedRoleAt = onboardingBody.indexOf("cannot use public onboarding");
  const updateUserAt = onboardingBody.indexOf("updateUser(");
  const upsertAt = onboardingBody.indexOf(".upsert(");

  check("ON-S3", "completeOnboarding invokes the shared onboardingRateLimit helper",
    firstLimiterAt !== -1,
    "onboardingRateLimit( not found inside completeOnboarding — mutation bypasses the budget");

  check("ON-S4", "auth (and the unauthenticated sign-in redirect) precede the limiter",
    firstLimiterAt !== -1 && authAt !== -1 && signInAt !== -1 &&
      authAt < firstLimiterAt && signInAt < firstLimiterAt,
    `auth=${authAt} signIn=${signInAt} limiter=${firstLimiterAt}`);

  check("ON-S5", "Obvious unauthorized rejections precede the limiter (no budget consumed)",
    firstLimiterAt !== -1 && adminAt !== -1 && roleMismatchAt !== -1 && disallowedRoleAt !== -1 &&
      adminAt < firstLimiterAt && roleMismatchAt < firstLimiterAt && disallowedRoleAt < firstLimiterAt,
    `admin=${adminAt} roleMismatch=${roleMismatchAt} disallowedRole=${disallowedRoleAt} limiter=${firstLimiterAt}`);

  check("ON-S6", "The limiter runs BEFORE the Clerk metadata update and profile upsert",
    firstLimiterAt !== -1 && updateUserAt !== -1 && upsertAt !== -1 &&
      firstLimiterAt < updateUserAt && firstLimiterAt < upsertAt,
    `limiter=${firstLimiterAt} updateUser=${updateUserAt} upsert=${upsertAt}`);

  // Both code paths (existing-role recovery and new-role onboarding) must be guarded.
  const elseAt = onboardingBody.indexOf("} else {");
  const guardInIfBranch =
    firstLimiterAt !== -1 && elseAt !== -1 && firstLimiterAt < elseAt;
  const guardInElseBranch =
    elseAt !== -1 &&
    onboardingBody.indexOf("onboardingRateLimit(", elseAt) !== -1;
  check("ON-S7", "Both branches (role recovery AND first-time onboarding) are rate-limited",
    guardInIfBranch && guardInElseBranch && limiterCalls.length >= 2,
    `calls=${limiterCalls.length} guardInIf=${guardInIfBranch} guardInElse=${guardInElseBranch}`);

  check("ON-S8", "No inlined/bare rateLimit( call was added to completeOnboarding",
    !/\brateLimit\(/.test(onboardingBody),
    "A bare rateLimit( call was inlined instead of reusing onboardingRateLimit");
}

// =============================================================================
section("SUMMARY");
// =============================================================================

console.log(`\n  TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}\n`);
process.exit(failed > 0 ? 1 : 0);
