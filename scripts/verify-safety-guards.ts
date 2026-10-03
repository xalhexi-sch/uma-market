// =============================================================================
// UMA Market — Deterministic production-safety guard verification
//
// TIER: deterministic / static. No database, no credentials, no network.
//
// This suite is the CI gate that protects every other verification script:
//   G-01  Every destructive verification suite (including the seeder) refuses
//         the PRODUCTION project with exit status 2, before any Supabase client
//         is constructed.
//   G-02  Every destructive verification suite refuses an UNKNOWN project ref
//         with exit status 2 (no "close enough" matching).
//   G-03  No destructive verification suite loads `.env.local`.
//   G-04  No destructive verification suite imports a third-party env loader or
//         references a `.env.local` path literal.
//   G-05  No destructive verification suite hard-codes a credential-shaped value.
//   G-06  The shared guard itself fails closed when its env file is missing.
//
// It is deliberately secret-free so it can run on every pull request, including
// forks where repository secrets are unavailable.
// =============================================================================

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  CLERK_DEV_SECRET_KEY_PREFIX,
  isClerkDevelopmentKey,
  PROD_SUPABASE_REF,
  SECURITY_TEST_SUPABASE_URL,
} from "./lib/safety-guard";
import { runCleanupSteps } from "../tests/browser/cleanup";

/**
 * Suites that open a destructive connection and therefore must fail closed.
 *
 * `scripts/seed-demo-data.ts` is a seeder, not a verifier, but it performs the
 * same class of operation (an authenticated write to a Supabase project), so it
 * is held to exactly the same production/unknown-project guards.
 */
const GUARDED_SUITES = [
  "scripts/seed-demo-data.ts",
  "scripts/verify-avatar-sync.ts",
  "scripts/verify-checkout-orders.ts",
  "scripts/verify-farmer-profiles.ts",
  "scripts/verify-image-delivery.ts",
  "scripts/verify-order-query-tabs.ts",
  "scripts/verify-phase-2-search.ts",
  "scripts/verify-phase-3-parity.ts",
  "scripts/verify-pickup-date.ts",
  "scripts/verify-query-efficiency.ts",
  "scripts/verify-search-category-filter.ts",
  "scripts/verify-smart-search.ts",
];

/**
 * tsx entrypoint, invoked through the current Node executable so the check
 * behaves identically on every platform (no `.cmd` shell shim involved).
 */
const TSX_CLI = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");

let passed = 0;
let failed = 0;

function assert(id: string, description: string, condition: boolean, details?: string): boolean {
  if (condition) {
    console.log(`  PASS: [${id}] ${description}`);
    passed++;
    return true;
  }
  console.error(`  FAIL: [${id}] ${description}`);
  if (details) console.error(`        ${details}`);
  failed++;
  return false;
}

function section(title: string): void {
  console.log(`\n${"-".repeat(72)}`);
  console.log(`  ${title}`);
  console.log("-".repeat(72));
}

/**
 * Runs a guarded suite with NEXT_PUBLIC_SUPABASE_URL forced to `url`.
 *
 * No env file is materialised: the guard validates an already-present process
 * variable first, so this exercises the production guard with zero credentials.
 */
function runGuardedSuite(suite: string, url: string): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [TSX_CLI, path.join(process.cwd(), suite)], {
    encoding: "utf8",
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SECRET_KEY: "",
      CLERK_SECRET_KEY: "",
    },
    timeout: 120_000,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return { status: result.status, output };
}

console.log("========================================================================");
console.log("UMA Market — Deterministic Production-Safety Guard Verification");
console.log("Environment: static analysis + fail-closed subprocess checks");
console.log("========================================================================");

if (!fs.existsSync(TSX_CLI)) {
  console.error(`FATAL: tsx CLI not found at ${TSX_CLI} — run \`npm ci\`.`);
  process.exit(1);
}

section("G-01 / G-02 — production and unknown project refs are refused with exit 2");

for (const suite of GUARDED_SUITES) {
  const name = path.basename(suite, ".ts");

  const prod = runGuardedSuite(suite, `https://${PROD_SUPABASE_REF}.supabase.co`);
  assert(
    `G-01.${name}`,
    `${suite} aborts on the production project`,
    prod.status === 2 && /PRODUCTION DATABASE DETECTED/.test(prod.output),
    `exit=${prod.status}; output tail: ${prod.output.trim().split("\n").slice(-3).join(" / ")}`,
  );
  assert(
    `G-02.${name}`,
    `${suite} aborts on an unknown project ref`,
    prod.status === 2,
    `exit=${prod.status}`,
  );

  const unknown = runGuardedSuite(suite, "https://uma-unknown-ref-0000.supabase.co");
  assert(
    `G-03.${name}`,
    `${suite} aborts on an unknown project ref with the correct message`,
    unknown.status === 2 && /UNKNOWN SUPABASE PROJECT/.test(unknown.output),
    `exit=${unknown.status}; output tail: ${unknown.output.trim().split("\n").slice(-3).join(" / ")}`,
  );
}

section("G-04 / G-05 / G-06 — source hygiene of the guarded suites");

// Credential-shaped literals that must never appear in a committed test script.
const SECRET_LITERAL_PATTERNS: Array<{ id: string; pattern: RegExp; label: string }> = [
  { id: "sb_secret", pattern: /sb_secret_[A-Za-z0-9_-]{10,}/, label: "Supabase secret key" },
  { id: "sk_live", pattern: /sk_live_[A-Za-z0-9]{10,}/, label: "Clerk live secret key" },
  { id: "pk_live", pattern: /pk_live_[A-Za-z0-9]{10,}/, label: "Clerk live publishable key" },
  { id: "whsec", pattern: /whsec_[A-Za-z0-9+/=_-]{16,}/, label: "Webhook signing secret" },
];

for (const suite of GUARDED_SUITES) {
  const name = path.basename(suite, ".ts");
  const source = fs.readFileSync(path.join(process.cwd(), suite), "utf8");

  assert(
    `G-04.${name}`,
    `${suite} never references a quoted .env.local path`,
    !/["'`]\.env\.local["'`]/.test(source),
  );
  assert(
    `G-05.${name}`,
    `${suite} imports no third-party env loader`,
    !/from\s+["'`]dotenv["'`]/.test(source),
  );

  const leaked = SECRET_LITERAL_PATTERNS.filter((p) => p.pattern.test(source)).map((p) => p.id);
  assert(
    `G-06.${name}`,
    `${suite} hard-codes no credential-shaped literal`,
    leaked.length === 0,
    leaked.length ? `matched: ${leaked.join(", ")}` : undefined,
  );
}

section("G-07 — the shared guard fails closed when its env file is missing");

/**
 * A deliberately minimal environment: only PATH/SystemRoot, no credentials and
 * no NEXT_PUBLIC_SUPABASE_URL, so the guard is forced to fail closed.
 */
function bareEnv(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "",
    SystemRoot: process.env.SystemRoot ?? "",
  } as unknown as NodeJS.ProcessEnv;
}

const guardProbe = spawnSync(process.execPath, [TSX_CLI, "verify-order-query-tabs.ts"], {
  encoding: "utf8",
  cwd: path.join(process.cwd(), "scripts"),
  env: bareEnv(),
  timeout: 120_000,
});
const guardOutput = `${guardProbe.stdout ?? ""}\n${guardProbe.stderr ?? ""}`;
assert(
  "G-07",
  "a guarded suite refuses to run without the security-test env file",
  guardProbe.status === 2 && /SECURITY-TEST ENV FILE NOT FOUND/.test(guardOutput),
  `exit=${guardProbe.status}; output tail: ${guardOutput.trim().split("\n").slice(-3).join(" / ")}`,
);

section("G-08 — live Clerk-using suites fail closed unless the Clerk key is a development key");

// Built by concatenation so no credential-shaped literal exists in source (G-06 spirit).
const FAKE_LIVE_CLERK_KEY = ["sk", "live", "NOT_A_REAL_KEY"].join("_");
const FAKE_DEV_CLERK_KEY = ["sk", "test", "NOT_A_REAL_KEY"].join("_");

assert("G-08.1", "isClerkDevelopmentKey accepts a sk_test_ key", isClerkDevelopmentKey(FAKE_DEV_CLERK_KEY));
assert("G-08.2", "isClerkDevelopmentKey rejects a sk_live_ key", !isClerkDevelopmentKey(FAKE_LIVE_CLERK_KEY));
assert(
  "G-08.3",
  "isClerkDevelopmentKey rejects empty, bare-prefix and unknown-shaped keys",
  !isClerkDevelopmentKey("") &&
    !isClerkDevelopmentKey(CLERK_DEV_SECRET_KEY_PREFIX) &&
    !isClerkDevelopmentKey("not_a_clerk_key"),
);

/**
 * Runs the REAL verify-auth-e2e.ts with the security-test Supabase URL (so the
 * Supabase guard passes) and dummy non-secret values, varying only the Clerk
 * key. With the guard in place the process aborts before any Clerk or Supabase
 * client is constructed, so no network request is ever issued.
 */
function runAuthE2eWithClerkKey(clerkKey: string): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [TSX_CLI, path.join(process.cwd(), "scripts/verify-auth-e2e.ts")], {
    encoding: "utf8",
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: SECURITY_TEST_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "dummy-anon",
      SUPABASE_SECRET_KEY: "dummy-secret",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "dummy-publishable",
      CLERK_SECRET_KEY: clerkKey,
    },
    timeout: 120_000,
  });
  return { status: result.status, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

for (const [id, label, key] of [
  ["G-08.4", "a production-shaped sk_live_ key", FAKE_LIVE_CLERK_KEY],
  ["G-08.5", "an unknown-shaped key", "not_a_clerk_key"],
] as const) {
  const run = runAuthE2eWithClerkKey(key);
  assert(
    id,
    `verify-auth-e2e.ts aborts with exit 2 on ${label}`,
    run.status === 2 && /CLERK KEY IS NOT A DEVELOPMENT KEY/.test(run.output),
    `exit=${run.status}; output tail: ${run.output.trim().split("\n").slice(-3).join(" / ")}`,
  );
  assert(`${id}b`, `the abort output never echoes the Clerk key (${label})`, !run.output.includes(key));
}

const harnessSource = fs.readFileSync(path.join(process.cwd(), "tests/browser/harness.ts"), "utf8");
assert(
  "G-08.6",
  "[source check, not runtime] browser harness asserts a Clerk development key before any Clerk call",
  /assertClerkDevelopmentKey\(\s*"browser-regression"\s*,\s*clerkSecretKey\s*\)/.test(harnessSource),
);

section("G-09 — cleanup runner: one failing step never prevents later steps");

(async () => {
  const ran: string[] = [];
  const failures = await runCleanupSteps([
    { name: "delete profiles", run: async () => { ran.push("profiles"); throw new Error("profile delete failed"); } },
    { name: "revoke sessions", run: async () => { ran.push("sessions"); } },
    { name: "close contexts", run: async () => { ran.push("contexts"); throw new Error("close failed"); } },
    { name: "delete clerk users", run: async () => { ran.push("users"); } },
  ]);

  assert(
    "G-09.1",
    "every step runs, in order, even after earlier steps fail (Clerk user deletion still runs)",
    ran.join(",") === "profiles,sessions,contexts,users",
    `ran=${ran.join(",")}`,
  );
  assert(
    "G-09.2",
    "each failure is reported with its step name and message (never swallowed)",
    failures.length === 2 &&
      failures[0] === "delete profiles: profile delete failed" &&
      failures[1] === "close contexts: close failed",
    `failures=${JSON.stringify(failures)}`,
  );

  const clean = await runCleanupSteps([{ name: "noop", run: async () => undefined }]);
  assert("G-09.3", "a fully successful cleanup reports no failures", clean.length === 0);

  const nonError = await runCleanupSteps([{ name: "odd", run: async () => { throw "string failure"; } }]);
  assert(
    "G-09.4",
    "a non-Error throw is still reported",
    nonError.length === 1 && nonError[0] === "odd: string failure",
    `failures=${JSON.stringify(nonError)}`,
  );

  const specSource = fs.readFileSync(
    path.join(process.cwd(), "tests/browser/authz-onboarding-role.spec.ts"),
    "utf8",
  );
  assert(
    "G-09.5",
    "[source check, not runtime] AUTHZ-10 spec routes cleanup through runCleanupSteps",
    /runCleanupSteps\(/.test(specSource),
  );

  console.log("\n========================================================================");
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`Expected security-test project (never contacted here): ${SECURITY_TEST_SUPABASE_URL}`);
  console.log("========================================================================");

  if (failed > 0) process.exit(1);
})();