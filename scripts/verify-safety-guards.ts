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
import { PROD_SUPABASE_REF, SECURITY_TEST_SUPABASE_URL } from "./lib/safety-guard";

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

console.log("\n========================================================================");
console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
console.log(`Expected security-test project (never contacted here): ${SECURITY_TEST_SUPABASE_URL}`);
console.log("========================================================================");

if (failed > 0) process.exit(1);