// =============================================================================
// UMA Market — checkout rate-limit verification suite
//
// STATIC + PURE SUITE — no network, no database, no auth, no mutation.
// Safe to run anywhere: npx tsx scripts/verify-place-order-rate-limit.ts
//
// Guards the mutation-level rate-limit bypass:
//   1. `placeV4Checkout` is the ONLY public server mutation that reaches a
//      checkout RPC, and it consumes the checkout budget
//      (`checkoutRateLimit`, keyed `checkout:${userId}`) before the RPC. The
//      retired V2 mutations (`placeOrder`, `placeMultiFarmerCheckout`) must not
//      reappear as a second, unthrottled entry point.
//   2. The limiter's own semantics: exactly `limit` requests are admitted per
//      window, the request after that is rejected, independent keys never
//      share state, and a rejection never extends the window.
//   3. The checkout limiter contract (key, limit, window) is unchanged.
//
// Limiter state is isolated per test case by using a fresh user id for each
// case, so no case can observe another case's counters.
//
// Exit code 0 = all assertions passed.
// =============================================================================

import * as fs from "fs";
import * as path from "path";
import { checkoutRateLimit, rateLimit } from "../src/lib/rate-limit";

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

/** Configured checkout budget: 10 attempts per 60s window, per user. */
const CHECKOUT_LIMIT = 10;
const CHECKOUT_WINDOW_MS = 60_000;

let caseSeq = 0;
/** A fresh user id per case = a fresh limiter key = no cross-case state. */
function freshUser(label: string): string {
  caseSeq += 1;
  return `verify-rl-${label}-${caseSeq}`;
}

// =============================================================================
section("SECTION 1 — checkout limiter semantics (behavioural)");
// =============================================================================

// RL-1 / RL-2: every request BELOW the configured limit is admitted.
{
  const u = freshUser("below-limit");
  const results = Array.from({ length: CHECKOUT_LIMIT - 1 }, () => checkoutRateLimit(u));
  const allAllowed = results.every((r) => r.success);
  check("RL-1", `Requests 1..${CHECKOUT_LIMIT - 1} (below limit) are all admitted`, allAllowed,
    `rejected early at index ${results.findIndex((r) => !r.success)}`);
  check("RL-2", `First request reports remaining === ${CHECKOUT_LIMIT - 1}`,
    results[0].remaining === CHECKOUT_LIMIT - 1,
    `Got remaining=${results[0].remaining}`);
}

// RL-3: the window admits EXACTLY `limit` requests — the last one reports 0.
{
  const u = freshUser("at-limit");
  const admitted: boolean[] = [];
  for (let i = 0; i < CHECKOUT_LIMIT; i++) admitted.push(checkoutRateLimit(u).success);
  check("RL-3", `Exactly ${CHECKOUT_LIMIT} requests are admitted within one window`,
    admitted.every(Boolean) && admitted.length === CHECKOUT_LIMIT,
    `Admitted ${admitted.filter(Boolean).length}/${CHECKOUT_LIMIT}`);
}

// RL-4 / RL-5: the request ABOVE the limit is rejected and cannot extend the window.
{
  const u = freshUser("above-limit");
  for (let i = 0; i < CHECKOUT_LIMIT - 1; i++) checkoutRateLimit(u); // 1..9
  const atLimit = checkoutRateLimit(u); // exactly at the limit: the 10th
  const aboveLimit = checkoutRateLimit(u); // one past the limit: the 11th
  check("RL-4", `Request ${CHECKOUT_LIMIT + 1} (above limit) is rejected`,
    !aboveLimit.success && aboveLimit.remaining === 0,
    `Got success=${aboveLimit.success} remaining=${aboveLimit.remaining}`);
  check("RL-5", "The rejected request does not extend the window (resetAt frozen)",
    atLimit.resetAt === aboveLimit.resetAt,
    `resetAt moved from ${atLimit.resetAt} to ${aboveLimit.resetAt}`);
  check("RL-5b", `Request ${CHECKOUT_LIMIT} (at limit) is still admitted by source semantics`,
    atLimit.success && atLimit.remaining === 0,
    `Got success=${atLimit.success} remaining=${atLimit.remaining}`);
}

// RL-6: independent keys never share state — saturating A leaves B untouched.
{
  const a = freshUser("isolate-a");
  for (let i = 0; i < CHECKOUT_LIMIT + 1; i++) checkoutRateLimit(a);
  const b = freshUser("isolate-b");
  const first = checkoutRateLimit(b);
  check("RL-6", "A saturated key does not leak into an independent key",
    first.success && first.remaining === CHECKOUT_LIMIT - 1,
    `Got success=${first.success} remaining=${first.remaining}`);
}

// RL-7: two independent cases with the same shape produce identical results,
// regardless of the order in which they run.
{
  const run = (label: string) => {
    const u = freshUser(label);
    const first = checkoutRateLimit(u);
    for (let i = 1; i < CHECKOUT_LIMIT + 1; i++) checkoutRateLimit(u);
    const overflow = checkoutRateLimit(u);
    return { firstOk: first.success, firstRemaining: first.remaining, overflowOk: overflow.success };
  };
  const one = run("order-1");
  const two = run("order-2");
  check("RL-7", "Independent cases are order-independent and deterministic",
    one.firstOk === two.firstOk &&
      one.firstRemaining === two.firstRemaining &&
      one.overflowOk === two.overflowOk &&
      one.firstOk === true &&
      one.overflowOk === false,
    `case1=${JSON.stringify(one)} case2=${JSON.stringify(two)}`);
}

// RL-8: the underlying window/limit helper honours a caller-supplied window,
// proving checkoutRateLimit is not accidentally relying on a default.
{
  const u = freshUser("window");
  const key = `checkout:${u}`;
  const first = rateLimit(key, 2, CHECKOUT_WINDOW_MS);
  const second = rateLimit(key, 2, CHECKOUT_WINDOW_MS);
  const third = rateLimit(key, 2, CHECKOUT_WINDOW_MS);
  check("RL-8", "Shared helper admits exactly the caller's limit, then rejects",
    first.success && second.success && !third.success,
    `Got ${first.success}/${second.success}/${third.success}`);
}

// =============================================================================
section("SECTION 2 — checkout limiter contract preserved (source of rate-limit.ts)");
// =============================================================================

const rlSrc = fs
  .readFileSync(path.resolve(process.cwd(), "src/lib/rate-limit.ts"), "utf-8")
  .replace(/\r\n/g, "\n");

check("CL-1", "checkoutRateLimit keys on checkout:${userId} (one budget per user)",
  rlSrc.includes("rateLimit(`checkout:${userId}`"),
  "checkout: key prefix not found — keying strategy changed");
check("CL-2", `checkoutRateLimit keeps limit=${CHECKOUT_LIMIT}, window=${CHECKOUT_WINDOW_MS}ms`,
  /rateLimit\(`checkout:\$\{userId\}`, 10, 60_000\)/.test(rlSrc),
  "Configured limit/window changed");
check("CL-3", "The generic rateLimit helper is still the single limiter implementation",
  (rlSrc.match(/export function rateLimit\(/g) ?? []).length === 1 &&
    !/["'`]@upstash\//.test(rlSrc),
  "Limiter implementation was replaced or duplicated");

// =============================================================================
section("SECTION 3 — checkout is protected at the mutation boundary (source)");
// =============================================================================

const ACTIONS = "src/app/checkout/actions.ts";
const actionsSrc = fs
  .readFileSync(path.resolve(process.cwd(), ACTIONS), "utf-8")
  .replace(/\r\n/g, "\n");

/**
 * Blanks out comments and string/template literals while preserving offsets,
 * so braces can be counted without being fooled by a `}` inside a message.
 */
function blank(src: string): string {
  const out = src.split("");
  const n = src.length;
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
    if (c === "\\") { blankChar(i); blankChar(i + 1); i += 2; continue; }
    if (c === mode) { mode = "code"; blankChar(i); i += 1; continue; }
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

const checkoutBody = functionSource(actionsSrc, "placeV4Checkout");

check("PO-1", "actions.ts defines the placeV4Checkout mutation",
  checkoutBody !== null,
  "export async function placeV4Checkout( not found");

if (checkoutBody) {
  const limiterAt = checkoutBody.indexOf("checkoutRateLimit(");
  const rpcAt = checkoutBody.indexOf('supabase.rpc("place_v4_checkout_orders"');

  check("PO-2", "placeV4Checkout invokes the shared checkoutRateLimit helper",
    limiterAt !== -1,
    "checkoutRateLimit( not found inside placeV4Checkout — mutation bypasses the checkout budget");

  check("PO-3", "placeV4Checkout returns RATE_LIMITED when the limiter denies",
    limiterAt !== -1 &&
      checkoutBody.includes('checkoutError("RATE_LIMITED")'),
    "RATE_LIMITED response missing from placeV4Checkout");

  check("PO-4", "The limiter runs BEFORE the place_v4_checkout_orders RPC (guard precedes mutation)",
    limiterAt !== -1 && rpcAt !== -1 && limiterAt < rpcAt,
    `limiterAt=${limiterAt} rpcAt=${rpcAt}`);

  check("PO-5", "placeV4Checkout does not inline its own limiter implementation",
    !/\brateLimit\(/.test(checkoutBody),
    "A bare rateLimit( call was inlined instead of reusing checkoutRateLimit");
}

check("PO-6", "actions.ts imports the shared helper from @/lib/rate-limit",
  actionsSrc.includes('import { checkoutRateLimit } from "@/lib/rate-limit"'),
  "Shared checkoutRateLimit import missing");

// The retired V2 checkout must not come back as a second entry point. Every
// application file that reaches a checkout RPC is a public mutation surface, so
// exactly one file — the canonical V4 action — may do so.
const CHECKOUT_RPC = /\.rpc\(\s*["'`](place_order|place_checkout_orders|place_v4_checkout_orders)["'`]/;
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}
const rpcCallers = sourceFiles(path.resolve(process.cwd(), "src"))
  .filter((file) => CHECKOUT_RPC.test(fs.readFileSync(file, "utf-8")))
  .map((file) => path.relative(process.cwd(), file).replace(/\\/g, "/"));

check("PO-7", "Only the canonical V4 action calls a checkout RPC (no second mutation)",
  rpcCallers.length === 1 && rpcCallers[0] === ACTIONS,
  `checkout RPC callers: ${rpcCallers.join(", ") || "<none>"}`);

check("PO-8", "Retired V2 checkout mutations are not redefined",
  !/export async function (placeOrder|placeMultiFarmerCheckout)\s*\(/.test(actionsSrc) &&
    !fs.existsSync(path.resolve(process.cwd(), "src/app/(dashboard)/business/checkout/actions.ts")),
  "Legacy placeOrder / placeMultiFarmerCheckout mutation is back");

// =============================================================================
section("SUMMARY");
// =============================================================================

console.log(`\n  TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}\n`);
process.exit(failed > 0 ? 1 : 0);
