// =============================================================================
// UMA Market — Phase 3: Overview presentation helpers
//
// Self-check for the pure formatting layer (range wording + delta arithmetic).
// Pure functions only: no credentials, no database, no network.
//
// Run: npx tsx scripts/verify-overview-format.ts
// =============================================================================

import assert from "node:assert/strict";
import { resolveOverviewRange } from "../src/lib/overview-range";
import {
  describeDelta,
  describeRange,
  formatDayKeyLong,
  formatDayKeyShort,
  formatPeso,
  formatPesoExact,
} from "../src/lib/overview-format";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name} — ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

console.log("==============================================================================");
console.log("UMA Market — Overview format helpers");
console.log("==============================================================================\n");

// ── Range wording ────────────────────────────────────────────────────────────

check("7d resolves to 'Last 7 days'", () => {
  assert.equal(describeRange(resolveOverviewRange({})).long, "Last 7 days");
});

check("30d resolves to 'Last 30 days'", () => {
  assert.equal(describeRange(resolveOverviewRange({ range: "30d" })).long, "Last 30 days");
});

check("mtd resolves to 'Month to date · <Month Year>'", () => {
  const label = describeRange(resolveOverviewRange({ range: "mtd" })).long;
  assert.match(label, /^Month to date · [A-Z][a-z]+ \d{4}$/);
});

check("phrase lowercases only the head, so month names keep their casing", () => {
  assert.equal(describeRange(resolveOverviewRange({})).phrase, "last 7 days");
  assert.equal(
    describeRange(resolveOverviewRange({ range: "custom", from: "2026-10-01", to: "2026-10-05" })).phrase,
    "oct 1 – Oct 5, 2026",
  );
  // A range label is never lowercased by the caller — that is what `phrase`
  // exists for, since "oct 1 – Oct 5" would misread a date as a word.
  const custom = describeRange(resolveOverviewRange({ range: "custom", from: "2026-10-01", to: "2026-10-05" }));
  assert.ok(custom.long.includes("Oct"));
});

check("short labels are 7D / 30D / MTD / Custom", () => {
  assert.equal(describeRange(resolveOverviewRange({})).short, "7D");
  assert.equal(describeRange(resolveOverviewRange({ range: "30d" })).short, "30D");
  assert.equal(describeRange(resolveOverviewRange({ range: "mtd" })).short, "MTD");
  assert.equal(
    describeRange(resolveOverviewRange({ range: "custom", from: "2026-10-01", to: "2026-10-05" })).short,
    "Custom",
  );
});

check("custom window within one month collapses the shared month and year", () => {
  const label = describeRange(
    resolveOverviewRange({ range: "custom", from: "2026-10-01", to: "2026-10-05" }),
  ).long;
  // "Oct 1 – Oct 5, 2026" — start omits the month it already shares.
  assert.equal(label, "Oct 1 – Oct 5, 2026");
});

check("custom window spanning two months repeats the start month", () => {
  const label = describeRange(
    resolveOverviewRange({ range: "custom", from: "2026-09-28", to: "2026-10-05" }),
  ).long;
  assert.equal(label, "Sep 28, 2026 – Oct 5, 2026");
});

check("invalid custom params fall back to 7d rather than a broken range", () => {
  const range = resolveOverviewRange({ range: "custom", from: "2026-02-31", to: "2026-03-05" });
  assert.equal(range.key, "7d");
  assert.equal(range.dayKeys.length, 7);
});

// ── Day-key rendering (must not shift across the UTC boundary) ──────────────

check("day keys render at their own UTC midnight", () => {
  assert.equal(formatDayKeyShort("2026-10-05"), "Oct 5");
  assert.equal(formatDayKeyLong("2026-10-05"), "Oct 5, 2026");
  // A Manila day key starts at 00:00 +08:00; formatting the naive Date in the
  // server's local zone would shift it to the previous day.
  assert.equal(formatDayKeyShort("2026-01-01"), "Jan 1");
});

// ── Delta arithmetic ────────────────────────────────────────────────────────

check("increase renders a signed percentage", () => {
  assert.deepEqual(describeDelta(120, 100), { direction: "up", label: "+20%" });
});

check("decrease renders a minus sign, not a hyphen-minus", () => {
  assert.deepEqual(describeDelta(92, 100), { direction: "down", label: "−8%" });
});

check("no change renders flat with an empty label (no '0%' noise)", () => {
  assert.deepEqual(describeDelta(100, 100), { direction: "flat", label: "" });
});

check("growth from zero reads 'new', never Infinity or NaN", () => {
  assert.deepEqual(describeDelta(5, 0), { direction: "up", label: "new" });
});

check("zero to zero stays flat rather than claiming +0%", () => {
  assert.deepEqual(describeDelta(0, 0), { direction: "flat", label: "" });
});

check("every delta direction is one of up/down/flat for negative and mixed inputs", () => {
  for (const [current, previous] of [
    [0, 10],
    [10, 0],
    [-5, 10],
    [7, 3],
  ] as Array<[number, number]>) {
    const delta = describeDelta(current, previous);
    assert.ok(["up", "down", "flat"].includes(delta.direction));
    assert.ok(!delta.label.includes("NaN"), "label must never contain NaN");
    assert.ok(!delta.label.includes("Infinity"), "label must never contain Infinity");
  }
});

// ── Currency ────────────────────────────────────────────────────────────────

check("peso formatting drops cents in tiles and keeps them on totals", () => {
  assert.equal(formatPeso(1234.56), "₱1,235");
  assert.equal(formatPesoExact(1234.5), "₱1,234.50");
  assert.equal(formatPeso(0), "₱0");
});

console.log("\n==============================================================================");
console.log(`Verification Complete: ${passed} check(s) passed`);
console.log("==============================================================================");