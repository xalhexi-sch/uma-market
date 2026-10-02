// =============================================================================
// UMA Market — Shared database-safety guard for verification scripts
//
// Single source of truth for "which Supabase project is this suite allowed to
// touch?" and "where does it load credentials from?".
//
// RULES (AGENTS.md §7, docs/security/SECURITY-TEST-ENVIRONMENT.md §9):
//   1. Credentials are loaded EXCLUSIVELY from .env.security-test.local.
//      .env.local points at production and must never be read by a test script.
//   2. The resolved project URL must match the security-test project EXACTLY.
//   3. Anything else — production ref, unknown ref, missing URL — aborts with a
//      non-zero exit status BEFORE any Supabase client is constructed, so no
//      connection and no mutation can occur.
//   4. Never prints secrets. Only the project ref / host is logged.
import * as fs from "node:fs";
import * as path from "node:path";

// =============================================================================

/** Live production Supabase project. Mutating this is STRICTLY FORBIDDEN. */
export const PROD_SUPABASE_REF = "odnpkqjytrmciwmcehff";

/** Dedicated, isolated security-test Supabase project. */
export const SECURITY_TEST_SUPABASE_REF = "xckdihprwjdwutglytwu";

export const SECURITY_TEST_SUPABASE_URL = `https://${SECURITY_TEST_SUPABASE_REF}.supabase.co`;

/** Env file holding the isolated security-test credentials. */
export const SECURITY_TEST_ENV_FILE = ".env.security-test.local";

/** Exit status used for every safety abort. Distinct from assertion failures (1). */
export const SAFETY_ABORT_EXIT_CODE = 2;

export interface SecurityTestEnv {
  supabaseUrl: string;
  anonKey: string;
  secretKey: string;
  clerkPublishableKey: string;
  clerkSecretKey: string;
  clerkWebhookSigningSecret: string;
}

function abort(scriptName: string, title: string, lines: string[]): never {
  console.error("=".repeat(72));
  console.error(`  SAFETY ABORT (${scriptName}): ${title}`);
  for (const line of lines) console.error(`  ${line}`);
  console.error("=".repeat(72));
  process.exit(SAFETY_ABORT_EXIT_CODE);
}

function validateProjectUrl(scriptName: string, supabaseUrl: string): void {
  // Production check first, so the operator gets the most specific message.
  if (supabaseUrl.includes(PROD_SUPABASE_REF)) {
    abort(scriptName, "PRODUCTION DATABASE DETECTED", [
      `Resolved NEXT_PUBLIC_SUPABASE_URL points at production project '${PROD_SUPABASE_REF}'.`,
      "Mutation tests against production are STRICTLY FORBIDDEN.",
      `This suite loads credentials from ${SECURITY_TEST_ENV_FILE} only.`,
    ]);
  }

  // Exact-match check: an unknown project ref is never trusted.
  if (supabaseUrl !== SECURITY_TEST_SUPABASE_URL) {
    abort(scriptName, "UNKNOWN SUPABASE PROJECT", [
      `Expected : ${SECURITY_TEST_SUPABASE_URL}`,
      `Active   : ${supabaseUrl || "(not set)"}`,
      "Verification scripts only run against the documented security-test project.",
    ]);
  }
}

/**
 * Loads the isolated security-test environment and fails closed.
 *
 * Precedence:
 *   1. An already-set `NEXT_PUBLIC_SUPABASE_URL` in the process environment is
 *      authoritative and validated immediately, before any file is read. This is
 *      what lets CI prove the production guard without materialising credentials.
 *   2. Otherwise credentials are loaded from `.env.security-test.local`, whose
 *      project URL is then validated with exactly the same rules.
 *
 * `process.loadEnvFile` is used instead of a third-party loader so the guard adds
 * no dependency, and it follows the usual semantics: values already present in
 * `process.env` win, so an operator can still inject overrides explicitly.
 */
export function loadSecurityTestEnv(scriptName: string): SecurityTestEnv {
  const preconfiguredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (preconfiguredUrl) {
    validateProjectUrl(scriptName, preconfiguredUrl);
  }

  const envPath = `${process.cwd()}/${SECURITY_TEST_ENV_FILE}`;

  try {
    process.loadEnvFile(envPath);
  } catch {
    abort(scriptName, "SECURITY-TEST ENV FILE NOT FOUND", [
      `${SECURITY_TEST_ENV_FILE} is required and must exist at the repository root.`,
      "It must contain credentials for the isolated security-test Supabase project:",
      `  NEXT_PUBLIC_SUPABASE_URL=${SECURITY_TEST_SUPABASE_URL}`,
      "See docs/security/SECURITY-TEST-ENVIRONMENT.md.",
    ]);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  validateProjectUrl(scriptName, supabaseUrl);

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

  if (!anonKey || !secretKey) {
    abort(scriptName, "MISSING SUPABASE CREDENTIALS", [
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY must both be set in ${SECURITY_TEST_ENV_FILE}.`,
    ]);
  }

  return {
    supabaseUrl,
    anonKey,
    secretKey,
    clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
    clerkSecretKey: process.env.CLERK_SECRET_KEY ?? "",
    clerkWebhookSigningSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET ?? "",
  };
}

/**
 * Requires a Supabase CLI link that targets the security-test project.
 *
 * `supabase db query --linked` executes SQL through the Management API using
 * whatever project the CLI is linked to. Without this assertion the suite could
 * read PostgreSQL metadata from an arbitrary (possibly production) project.
 */
export function assertSupabaseCliLinkedToSecurityTest(scriptName: string): void {
  const refFile = path.join(process.cwd(), "supabase", ".temp", "project-ref");

  let linkedRef: string;
  try {
    linkedRef = fs.readFileSync(refFile, "utf8").trim();
  } catch {
    abort(scriptName, "SUPABASE CLI NOT LINKED", [
      `Missing ${path.relative(process.cwd(), refFile)} — 'supabase db query --linked' would be undetermined.`,
      `Link the CLI to the security-test project:  npx supabase link --project-ref ${SECURITY_TEST_SUPABASE_REF}`,
    ]);
  }

  if (linkedRef !== SECURITY_TEST_SUPABASE_REF) {
    abort(scriptName, "SUPABASE CLI LINKED TO THE WRONG PROJECT", [
      `supabase/.temp/project-ref = '${linkedRef}'`,
      `Expected '${SECURITY_TEST_SUPABASE_REF}'.`,
      `Re-link with:  npx supabase link --project-ref ${SECURITY_TEST_SUPABASE_REF}`,
    ]);
  }
}