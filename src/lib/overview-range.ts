import { addDays, manilaDayKey, manilaDayStartIso } from "@/lib/time";

// ── Overview date-range model ──────────────────────────────────────
//
// One shared model for every Overview widget: the URL search params select
// the range, `resolveOverviewRange` turns it into an absolute Manila
// calendar window, and all queries/charts consume the same result — so no
// widget can silently fall back to a different time scope.

export const OVERVIEW_RANGE_KEYS = ["7d", "30d", "mtd", "custom"] as const;
export type OverviewRangeKey = (typeof OVERVIEW_RANGE_KEYS)[number];

export interface OverviewDateRange {
  key: OverviewRangeKey;
  /** Inclusive window start (ISO instant, Manila day boundary). */
  startIso: string;
  /** Exclusive window end (ISO instant, Manila day boundary). */
  endIso: string;
  /** Manila calendar days covered, ascending — exactly one chart bucket per day. */
  dayKeys: string[];
  /** Previous window of equal length, for delta comparisons. */
  previous: { startIso: string; endIso: string };
}

export interface OverviewRangeParams {
  range?: string;
  from?: string;
  to?: string;
}

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Rejects malformed or non-existent dates (e.g. 2026-02-31 normalizes away). */
function isValidDayKey(value: string): boolean {
  return DAY_KEY_PATTERN.test(value) && addDays(value, 0) === value;
}

function buildRange(key: OverviewRangeKey, dayKeys: string[]): OverviewDateRange {
  const startIso = manilaDayStartIso(dayKeys[0]);
  const endIso = manilaDayStartIso(addDays(dayKeys[dayKeys.length - 1], 1));
  const lengthMs = dayKeys.length * 86_400_000;
  return {
    key,
    startIso,
    endIso,
    dayKeys,
    previous: {
      startIso: new Date(new Date(startIso).getTime() - lengthMs).toISOString(),
      endIso: startIso,
    },
  };
}

function keysBack(days: number, throughKey: string): string[] {
  const keys: string[] = [];
  for (let i = days; i >= 0; i--) keys.push(addDays(throughKey, -i));
  return keys;
}

function keysBetween(fromKey: string, toKey: string): string[] {
  const keys: string[] = [];
  for (let key = fromKey; key <= toKey; key = addDays(key, 1)) keys.push(key);
  return keys;
}

/**
 * Resolves URL search params into the shared Overview window.
 *
 * - `?range=7d`  (default) — the last 7 Manila days including today
 * - `?range=30d` — the last 30 Manila days including today
 * - `?range=mtd`  — Manila month-to-date (1st of month through today)
 * - `?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD` — inclusive custom window
 *
 * Invalid or missing params fall back to the default window (URL input is
 * user-controlled, not a data error).
 */
export function resolveOverviewRange(params: OverviewRangeParams): OverviewDateRange {
  const todayKey = manilaDayKey(new Date());

  switch (params.range) {
    case "30d":
      return buildRange("30d", keysBack(29, todayKey));
    case "mtd": {
      const firstOfMonth = `${todayKey.slice(0, 8)}01`;
      return buildRange("mtd", keysBetween(firstOfMonth, todayKey));
    }
    case "custom": {
      const { from, to } = params;
      if (from && to && isValidDayKey(from) && isValidDayKey(to) && from <= to) {
        return buildRange("custom", keysBetween(from, to));
      }
      return buildRange("7d", keysBack(6, todayKey));
    }
    default:
      return buildRange("7d", keysBack(6, todayKey));
  }
}
