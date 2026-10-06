/**
 * UMA Market V4 migration parity gate.
 *
 * The default mode reads local migration files only. Remote modes are explicit
 * and first require the Supabase CLI link to match the selected project ref.
 * The only remote command this verifier can run is `migration list`, which is
 * read-only. It never applies migrations or invokes SQL/RPC operations.
 *
 * Usage:
 *   npm run verify:v4-db-parity                         # local source checks
 *   npm run verify:v4-db-parity -- --security-test     # read-only test ledger
 *   npm run verify:v4-db-parity -- --production        # explicit prod ledger
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { PROD_SUPABASE_REF, SECURITY_TEST_SUPABASE_REF } from "./lib/safety-guard";

const REQUIRED_MIGRATIONS = [
  "20261005000001",
  "20261005000002",
  "20261005000003",
  "20261005000004",
  "20261005000005",
  "20261006000001",
  "20261006100000",
  "20261006200000",
  "20261007000000",
  "20261008000000",
  "20261009000000",
  "20261010000000",
  "20261011000000",
] as const;

const BASE_DEPENDENCIES = [
  "20260922000001", // initial schema: profiles, products, carts, orders, messages
  "20260924000002", // legacy checkout RPCs retired by the final V4 migration
  "20261002000005", // notification foundation
  "20261002000006", // latest order/review notification trigger definitions
] as const;

const DEPENDENCIES: Record<string, readonly string[]> = {
  "20261005000002": ["20261005000001"],
  "20261005000003": ["20261005000002", "20260924000002"],
  "20261005000004": ["20261005000003"],
  "20261005000005": ["20260922000001", "20261005000004"],
  "20261006000001": ["20260924000002", "20261005000005"],
  "20261006100000": ["20261005000005", "20261006000001"],
  "20261006200000": ["20261005000005", "20261006000001"],
  "20261007000000": ["20261005000005", "20261006100000"],
  "20261008000000": ["20261002000005", "20261002000006", "20261006200000"],
  "20261009000000": ["20261007000000"],
  "20261010000000": ["20261005000005", "20261006000001"],
  "20261011000000": ["20260924000002", "20261006000001"],
};

type RemoteMode = "local-only" | "security-test" | "production";

interface MigrationFile {
  version: string;
  name: string;
  filePath: string;
  sql: string;
}

interface CheckResult {
  passed: boolean;
  id: string;
  label: string;
  detail?: string;
}

const results: CheckResult[] = [];

function assert(id: string, label: string, passed: boolean, detail?: string): void {
  results.push({ id, label, passed, detail });
  const prefix = passed ? "PASS" : "FAIL";
  console.log(`  ${prefix}: [${id}] ${label}`);
  if (!passed && detail) console.error(`        ${detail}`);
}

function failClosed(message: string): never {
  console.error(`FAIL CLOSED: ${message}`);
  process.exit(2);
}

function parseMode(args: string[]): RemoteMode {
  if (args.length > 1 || args.some((arg) => !["--local-only", "--security-test", "--production"].includes(arg))) {
    failClosed("Use at most one of --local-only, --security-test, or --production.");
  }
  const flag = args[0];
  if (flag === "--security-test") return "security-test";
  if (flag === "--production") return "production";
  return "local-only";
}

/** Remove SQL comments without interpreting comment markers inside SQL strings. */
function stripSqlComments(source: string): string {
  let output = "";
  let index = 0;
  let blockDepth = 0;
  let quote: "single" | "double" | null = null;
  let dollarTag: string | null = null;

  while (index < source.length) {
    if (dollarTag) {
      if (source.startsWith(dollarTag, index)) {
        output += dollarTag;
        index += dollarTag.length;
        dollarTag = null;
      } else {
        output += source[index];
        index += 1;
      }
      continue;
    }

    if (blockDepth > 0) {
      if (source.startsWith("/*", index)) {
        blockDepth += 1;
        index += 2;
      } else if (source.startsWith("*/", index)) {
        blockDepth -= 1;
        index += 2;
      } else {
        if (source[index] === "\n") output += "\n";
        index += 1;
      }
      continue;
    }

    const char = source[index];
    const next = source[index + 1];

    if (quote === "single") {
      output += char;
      if (char === "'" && next === "'") {
        output += next;
        index += 2;
      } else {
        if (char === "'") quote = null;
        index += 1;
      }
      continue;
    }

    if (quote === "double") {
      output += char;
      if (char === '"' && next === '"') {
        output += next;
        index += 2;
      } else {
        if (char === '"') quote = null;
        index += 1;
      }
      continue;
    }

    if (source.startsWith("--", index)) {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (source.startsWith("/*", index)) {
      blockDepth = 1;
      index += 2;
      continue;
    }
    if (char === "'") {
      quote = "single";
      output += char;
      index += 1;
      continue;
    }
    if (char === '"') {
      quote = "double";
      output += char;
      index += 1;
      continue;
    }
    if (char === "$") {
      const match = source.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        dollarTag = match[0];
        output += dollarTag;
        index += dollarTag.length;
        continue;
      }
    }

    output += char;
    index += 1;
  }

  return output;
}

function loadMigrationFiles(migrationsDir: string): {
  files: MigrationFile[];
  byVersion: Map<string, MigrationFile>;
  duplicateVersions: string[];
  invalidNames: string[];
} {
  const names = fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
  const byVersion = new Map<string, MigrationFile>();
  const files: MigrationFile[] = [];
  const duplicateVersions: string[] = [];
  const invalidNames: string[] = [];

  for (const name of names) {
    const match = name.match(/^(\d{14})_.+\.sql$/);
    if (!match) {
      invalidNames.push(name);
      continue;
    }
    const version = match[1];
    const filePath = path.join(migrationsDir, name);
    const file: MigrationFile = {
      version,
      name,
      filePath,
      sql: stripSqlComments(fs.readFileSync(filePath, "utf8")),
    };
    files.push(file);
    if (byVersion.has(version)) duplicateVersions.push(version);
    else byVersion.set(version, file);
  }

  return { files, byVersion, duplicateVersions, invalidNames };
}

function runLocalChecks(migrationsDir: string): {
  files: MigrationFile[];
  byVersion: Map<string, MigrationFile>;
  succeeded: boolean;
} {
  if (!fs.existsSync(migrationsDir)) failClosed(`Migration directory not found: ${migrationsDir}`);

  const { files, byVersion, duplicateVersions, invalidNames } = loadMigrationFiles(migrationsDir);
  assert("LOCAL-01", "migration files use unique 14-digit versions", duplicateVersions.length === 0 && invalidNames.length === 0,
    [...duplicateVersions.map((v) => `duplicate ${v}`), ...invalidNames.map((n) => `invalid filename ${n}`)].join(", "));

  const missingVersions = [...BASE_DEPENDENCIES, ...REQUIRED_MIGRATIONS]
    .filter((version, index, all) => all.indexOf(version) === index && !byVersion.has(version));
  assert("LOCAL-02", "all required release and baseline migration files exist", missingVersions.length === 0,
    missingVersions.length ? `missing: ${missingVersions.join(", ")}` : undefined);

  const requiredOrder = [...REQUIRED_MIGRATIONS];
  const ordered = requiredOrder.every((version, index) => index === 0 || requiredOrder[index - 1] < version);
  assert("LOCAL-03", "required release migrations are in strictly increasing version order", ordered);

  const dependencyFailures: string[] = [];
  for (const [consumer, dependencies] of Object.entries(DEPENDENCIES)) {
    for (const dependency of dependencies) {
      if (!byVersion.has(dependency)) dependencyFailures.push(`${consumer} requires missing ${dependency}`);
      else if (dependency >= consumer) dependencyFailures.push(`${consumer} depends on non-prior migration ${dependency}`);
    }
  }
  assert("LOCAL-04", "declared migration dependencies exist and never point forward", dependencyFailures.length === 0,
    dependencyFailures.join("; "));

  const getSql = (version: string): string => byVersion.get(version)?.sql ?? "";
  const sqlChecks: Array<{ id: string; label: string; sql: string; pattern: RegExp }> = [
    {
      id: "OBJ-01", label: "overview aggregation RPCs are defined with the expected access grants",
      sql: getSql("20261005000001") + "\n" + getSql("20261005000002"),
      pattern: /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_farmer_overview_metrics\s*\([\s\S]*?CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_business_overview_metrics\s*\([\s\S]*?GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_farmer_overview_metrics\s*\([\s\S]*?\)\s+TO\s+authenticated[\s\S]*?GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_business_overview_metrics\s*\([\s\S]*?\)\s+TO\s+authenticated/i,
    },
    {
      id: "OBJ-02", label: "businesses and OWNER/STAFF memberships are defined with RLS",
      sql: getSql("20261005000005"),
      pattern: /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.businesses\s*\([\s\S]*?CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.business_members\s*\([\s\S]*?CHECK\s*\(\s*role\s+IN\s*\(\s*'OWNER'\s*,\s*'STAFF'\s*\)\s*\)[\s\S]*?ALTER\s+TABLE\s+public\.businesses\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY[\s\S]*?ALTER\s+TABLE\s+public\.business_members\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
    },
    {
      id: "OBJ-03", label: "V4 cart foundation scopes cart rows and uniqueness by business",
      sql: getSql("20261005000005"),
      pattern: /ALTER\s+TABLE\s+public\.cart_items[\s\S]*?ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+business_id\s+UUID\s+REFERENCES\s+public\.businesses[\s\S]*?CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_cart_items_business_product[\s\S]*?ON\s+public\.cart_items\s*\(\s*business_id\s*,\s*product_id\s*\)[\s\S]*?CREATE\s+POLICY\s+"cart_items: member manages business cart or legacy own"/i,
    },
    {
      id: "OBJ-04", label: "V4 checkout RPC checks membership/capability and is executable by authenticated",
      sql: getSql("20261006000001"),
      pattern: /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.place_v4_checkout_orders\s*\(\s*p_business_id\s+UUID[\s\S]*?public\.business_members[\s\S]*?v_business\.can_buy\s+IS\s+NOT\s+TRUE[\s\S]*?INSERT\s+INTO\s+public\.order_items[\s\S]*?GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.place_v4_checkout_orders\s*\(\s*UUID\s*,\s*JSONB\s*\)\s+TO\s+authenticated/i,
    },
    {
      id: "OBJ-05", label: "producer listing RPCs and append-only inventory ledger are defined",
      sql: getSql("20261006100000"),
      pattern: /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.inventory_movements\s*\([\s\S]*?quantity_delta[\s\S]*?CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_business_listing\s*\([\s\S]*?CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.adjust_business_inventory\s*\(/i,
    },
    {
      id: "OBJ-06", label: "unified business conversations have canonical uniqueness, message context, and RLS",
      sql: getSql("20261006200000"),
      pattern: /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.conversations\s*\([\s\S]*?UNIQUE\s*\(\s*business_a_id\s*,\s*business_b_id\s*\)[\s\S]*?ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+conversation_id\s+UUID\s+REFERENCES\s+public\.conversations[\s\S]*?CREATE\s+POLICY\s+"conversations: members can view their conversations"/i,
    },
    {
      id: "OBJ-07", label: "business provisioning function is restricted to the service role and profile trigger",
      sql: getSql("20261007000000"),
      pattern: /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.provision_owner_business\s*\(p_clerk_id\s+TEXT\)[\s\S]*?GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.provision_owner_business\s*\(TEXT\)\s+TO\s+service_role[\s\S]*?CREATE\s+TRIGGER\s+trg_profiles_provision_owner_business/i,
    },
    {
      id: "OBJ-08", label: "notification triggers converge on canonical V4 URLs",
      sql: getSql("20261008000000"),
      pattern: /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.trigger_order_notification\s*\(\)[\s\S]*?\/dashboard\/orders[\s\S]*?\/orders\/['"]\s*\|\|\s*NEW\.id[\s\S]*?CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.trigger_message_notification\s*\(\)[\s\S]*?\/messages[\s\S]*?CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.trigger_review_notification\s*\(\)[\s\S]*?\/dashboard\/orders/i,
    },
    {
      id: "OBJ-09", label: "F9 owner RLS hardening blocks direct client capability/status/identity changes",
      sql: getSql("20261009000000"),
      pattern: /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.trigger_guard_business_client_writes\s*\(\)[\s\S]*?current_user\s+NOT\s+IN\s*\(\s*'authenticated'\s*,\s*'anon'\s*\)[\s\S]*?NEW\.legacy_clerk_id\s+IS\s+DISTINCT\s+FROM\s+OLD\.legacy_clerk_id[\s\S]*?NEW\.can_buy\s+IS\s+DISTINCT\s+FROM\s+OLD\.can_buy[\s\S]*?NEW\.can_sell\s+IS\s+DISTINCT\s+FROM\s+OLD\.can_sell[\s\S]*?NEW\.status\s+IS\s+DISTINCT\s+FROM\s+OLD\.status[\s\S]*?CREATE\s+TRIGGER\s+trg_businesses_20_guard_client_writes\s+BEFORE\s+UPDATE\s+ON\s+public\.businesses/i,
    },
    {
      id: "OBJ-10", label: "direct authenticated order_items INSERT policy is removed and not reintroduced",
      sql: getSql("20261005000003"),
      pattern: /DROP\s+POLICY\s+IF\s+EXISTS\s+"order_items: business inserts"\s+ON\s+public\.order_items/i,
    },
    {
      id: "OBJ-11", label: "product moderation has a row-level active/approved invariant",
      sql: getSql("20261005000003") + "\n" + getSql("20261005000004"),
      pattern: /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+moderation_status[\s\S]*?CREATE\s+TRIGGER\s+trg_protect_product_moderation[\s\S]*?ADD\s+CONSTRAINT\s+products_active_requires_approval\s+CHECK\s*\(\s*status\s*<>\s*'active'\s+OR\s+moderation_status\s*=\s*'approved'\s*\)/i,
    },
    {
      id: "OBJ-12", label: "legacy checkout RPC EXECUTE is revoked from all roles while V4 checkout remains granted",
      sql: getSql("20261011000000") + "\n" + getSql("20261006000001"),
      pattern: /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.place_checkout_orders\s*\(\s*JSONB\s*\)\s+FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated\s*,\s*service_role[\s\S]*?REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.place_order\s*\(\s*TEXT\s*,\s*TEXT\s*,\s*TEXT\s*,\s*TEXT\s*,\s*DATE\s*,\s*JSONB\s*\)\s+FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated\s*,\s*service_role[\s\S]*?GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.place_v4_checkout_orders/i,
    },
  ];

  for (const check of sqlChecks) {
    assert(check.id, check.label, check.pattern.test(check.sql));
  }

  const laterOrderItemInsertPolicy = files.some((file) =>
    file.version > "20261005000003" &&
    /CREATE\s+POLICY\s+[\s\S]{0,180}?ON\s+public\.order_items\s+FOR\s+(?:INSERT|ALL)\b/i.test(file.sql),
  );
  assert("OBJ-13", "no later migration adds an order_items INSERT or ALL policy", !laterOrderItemInsertPolicy);

  const legacyGrantReturned = files.some((file) =>
    file.version > "20261011000000" &&
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.(?:place_checkout_orders|place_order)\s*\(/i.test(file.sql),
  );
  assert("OBJ-14", "no later migration restores client EXECUTE grants on legacy checkout RPCs", !legacyGrantReturned);

  const succeeded = results.every((result) => result.passed);
  return { files, byVersion, succeeded };
}

function readLinkedProjectRef(repoRoot: string): string {
  const linkedProjectPath = path.join(repoRoot, "supabase", ".temp", "project-ref");
  if (!fs.existsSync(linkedProjectPath)) failClosed("Supabase CLI has no linked project reference; no remote query was attempted.");
  const linkedRef = fs.readFileSync(linkedProjectPath, "utf8").trim();
  if (!/^[a-z0-9]{20}$/.test(linkedRef)) failClosed("Supabase CLI linked project reference is malformed; no remote query was attempted.");
  return linkedRef;
}

function listRemoteMigrations(repoRoot: string, expectedRef: string): Set<string> {
  const linkedRef = readLinkedProjectRef(repoRoot);
  if (linkedRef !== expectedRef) {
    failClosed(`Linked project ref '${linkedRef}' does not match the selected target '${expectedRef}'; no database query was attempted.`);
  }

  const cliEntry = path.join(repoRoot, "node_modules", "supabase", "dist", "supabase.js");
  if (!fs.existsSync(cliEntry)) failClosed("Pinned local Supabase CLI entry point is missing; no remote query was attempted.");

  const result = spawnSync(process.execPath, [
    cliEntry,
    "migration",
    "list",
    "--linked",
    "--output-format",
    "json",
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 60_000,
    windowsHide: true,
  });

  if (result.error || result.status !== 0) {
    failClosed(`Read-only Supabase migration listing failed (exit ${result.status ?? "unknown"}); parity is unknown.`);
  }

  const marker = result.stdout.indexOf('{"migrations"');
  if (marker < 0) failClosed("Supabase CLI returned no migration ledger JSON; parity is unknown.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout.slice(marker));
  } catch {
    failClosed("Supabase CLI migration ledger JSON could not be parsed; parity is unknown.");
  }

  if (!parsed || typeof parsed !== "object" || !("migrations" in parsed) || !Array.isArray(parsed.migrations)) {
    failClosed("Supabase CLI returned an unexpected migration ledger shape; parity is unknown.");
  }

  const remoteVersions = new Set<string>();
  for (const row of parsed.migrations) {
    if (!row || typeof row !== "object" || !("remote" in row)) {
      failClosed("Supabase CLI returned an invalid migration ledger row; parity is unknown.");
    }
    const remote = row.remote;
    if (remote === null || remote === undefined || remote === "") continue;
    if (typeof remote !== "string" || !/^\d{14}$/.test(remote)) {
      failClosed("Supabase CLI returned an invalid remote migration version; parity is unknown.");
    }
    if (remoteVersions.has(remote)) failClosed(`Remote migration ledger contains duplicate version ${remote}.`);
    remoteVersions.add(remote);
  }
  return remoteVersions;
}

function checkRemoteParity(mode: Exclude<RemoteMode, "local-only">, repoRoot: string): boolean {
  const expectedRef = mode === "production" ? PROD_SUPABASE_REF : SECURITY_TEST_SUPABASE_REF;
  const remoteVersions = listRemoteMigrations(repoRoot, expectedRef);
  const remoteRequirements = [...BASE_DEPENDENCIES, ...REQUIRED_MIGRATIONS];
  const missing = remoteRequirements.filter((version) => !remoteVersions.has(version));
  for (const version of remoteRequirements) {
    assert(`REMOTE-${version}`, `${mode} has required migration ${version}`, remoteVersions.has(version));
  }
  if (missing.length) {
    console.error(`  Missing on ${mode}: ${missing.join(", ")}`);
    return false;
  }
  return true;
}

function main(): void {
  const mode = parseMode(process.argv.slice(2));
  const repoRoot = process.cwd();
  const migrationsDir = path.join(repoRoot, "supabase", "migrations");

  console.log("============================================================");
  console.log("UMA Market V4 — Migration Parity Gate");
  console.log(`Mode: ${mode}`);
  console.log(mode === "local-only"
    ? "Database access: none; production parity is NOT VERIFIED in this mode."
    : `Database access: read-only migration ledger for ${mode}.`);
  console.log("============================================================");

  const local = runLocalChecks(migrationsDir);
  if (!local.succeeded) {
    console.error("Local V4 migration checks failed; remote parity was not queried.");
    process.exitCode = 1;
    return;
  }

  let remotePassed = true;
  if (mode === "local-only") {
    console.log("PRODUCTION PARITY: NOT CHECKED (local source verification only).");
    console.log("============================================================");
    console.log(`Local source checks: ${results.every((result) => result.passed) ? "PASS" : "FAIL"} (${results.filter((result) => result.passed).length}/${results.length}).`);
    console.log("Overall result: INCOMPLETE; production parity is unverified.");
    console.log("============================================================");
    process.exitCode = 2;
    return;
  } else {
    remotePassed = checkRemoteParity(mode, repoRoot);
  }

  const failed = results.filter((result) => !result.passed);
  console.log("============================================================");
  console.log(`Result: ${failed.length === 0 && remotePassed ? "PASS" : "FAIL"} (${results.length - failed.length}/${results.length} checks passed)`);
  if (mode === "production" && remotePassed && failed.length === 0) console.log("Production V4 migration parity: PASS.");
  if (mode === "security-test" && remotePassed && failed.length === 0) console.log("Security-test V4 migration parity: PASS; production remains unverified.");
  console.log("============================================================");
  process.exitCode = failed.length === 0 && remotePassed ? 0 : 1;
}

main();
