import { APP_TIME_ZONE, APP_TIME_ZONE_OFFSET } from "@/lib/constants";

// Intl formatters are expensive to construct; create them once per process.
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
}); // en-CA formats as YYYY-MM-DD
const hourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  hourCycle: "h23",
});

/** The Manila calendar day (YYYY-MM-DD) that an instant falls on. */
export function manilaDayKey(instant: Date | string): string {
  return dayKeyFormatter.format(
    typeof instant === "string" ? new Date(instant) : instant,
  );
}

/** Hour of day (0–23) on the Manila clock for an instant. */
export function manilaHour(instant: Date = new Date()): number {
  return Number(hourFormatter.format(instant));
}

/** Shift a YYYY-MM-DD day key by n calendar days (n may be negative). */
export function addDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** The ISO instant at which the given Manila day starts (00:00 +08:00). */
export function manilaDayStartIso(dayKey: string): string {
  return `${dayKey}T00:00:00${APP_TIME_ZONE_OFFSET}`;
}

/** Time-of-day greeting based on the current Manila hour. */
export function getManilaGreeting(): string {
  const hour = manilaHour();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}
