import { CURRENCY } from "@/lib/constants";
import type { OverviewDateRange } from "@/lib/overview-range";

// ── Overview presentation helpers ───────────────────────────────────
//
// Range-aware wording and delta arithmetic for the Overview dashboards.
// Every function here is pure so the wording can never drift from the
// resolved window that produced the numbers.

const MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const MONTH_DAY_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const FULL_MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Renders a `YYYY-MM-DD` day key at its own UTC midnight (never shifted). */
function atDayKeyUtc(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00Z`);
}

/** e.g. "Oct 5" from a Manila day key. */
export function formatDayKeyShort(dayKey: string): string {
  return MONTH_DAY.format(atDayKeyUtc(dayKey));
}

/** e.g. "Oct 5, 2026" from a Manila day key. */
export function formatDayKeyLong(dayKey: string): string {
  return MONTH_DAY_YEAR.format(atDayKeyUtc(dayKey));
}

/**
 * Human wording for a resolved Overview window.
 *
 * `short` labels the range control; `long` is what the rest of the page
 * says out loud ("Last 7 days", "Month to date", "Oct 1 – Oct 5, 2026").
 * A custom window collapses shared month/year so it reads naturally.
 */
export function describeRange(range: OverviewDateRange): {
  short: string;
  long: string;
  /** Same wording, lowercase only at the head — safe mid-sentence. */
  phrase: string;
} {
  const first = range.dayKeys[0];
  const last = range.dayKeys[range.dayKeys.length - 1];

  const { short, long } = ((): { short: string; long: string } => {
    switch (range.key) {
      case "30d":
        return { short: "30D", long: "Last 30 days" };
      case "mtd":
        return {
          short: "MTD",
          long: `Month to date · ${FULL_MONTH_YEAR.format(atDayKeyUtc(first))}`,
        };
      case "custom": {
        const start = atDayKeyUtc(first);
        const end = atDayKeyUtc(last);
        const sameMonth =
          start.getUTCFullYear() === end.getUTCFullYear() &&
          start.getUTCMonth() === end.getUTCMonth();
        return {
          short: "Custom",
          long: sameMonth
            ? `${MONTH_DAY.format(start)} – ${MONTH_DAY_YEAR.format(end)}`
            : `${MONTH_DAY_YEAR.format(start)} – ${MONTH_DAY_YEAR.format(end)}`,
        };
      }
      default:
        return { short: "7D", long: "Last 7 days" };
    }
  })();

  return { short, long, phrase: long.charAt(0).toLowerCase() + long.slice(1) };
}

/** Peso amount with no cents — dashboard tiles only. */
export function formatPeso(value: number): string {
  return `${CURRENCY}${value.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/** Peso amount with cents — line items and order totals. */
export function formatPesoExact(value: number): string {
  return `${CURRENCY}${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
  })}`;
}

export interface Delta {
  direction: "up" | "down" | "flat";
  /** Short label such as "+12%", "−8%", or "new". Empty when flat. */
  label: string;
}

/**
 * Percentage change against the previous window of equal length.
 *
 * A previous value of zero has no meaningful percentage: growth from
 * nothing reads "new", and zero-to-zero reads flat rather than "0%".
 */
export function describeDelta(current: number, previous: number): Delta {
  if (previous === 0) {
    return current > 0
      ? { direction: "up", label: "new" }
      : { direction: "flat", label: "" };
  }

  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return { direction: "flat", label: "" };

  return {
    direction: percent > 0 ? "up" : "down",
    label: `${percent > 0 ? "+" : "−"}${Math.abs(percent)}%`,
  };
}

