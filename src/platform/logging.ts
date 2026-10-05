/**
 * UMA Platform — Structured Logging
 *
 * Thin wrapper over console that adds structured context (userId, action,
 * resourceId, etc.) without pulling in a logging dependency.
 *
 * All log calls emit JSON-parseable lines to stdout/stderr so they can be
 * ingested by Vercel / any structured-log collector. Secrets are never logged.
 *
 * Usage:
 *   log.info("order.created", { orderId, userId });
 *   log.warn("rate_limit.hit", { userId, action: "checkout" });
 *   log.error("checkout.failed", error, { userId });
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  event: string;
  ts: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, event: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    event,
    ts: new Date().toISOString(),
    ...context,
  };

  const line = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "debug":
      if (process.env.NODE_ENV === "development") console.debug(line);
      break;
    default:
      console.log(line);
  }
}

function errorContext(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      errorName: err.name,
      errorMessage: err.message,
      // Stack only in dev to avoid noise in production log aggregation.
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    };
  }
  return { errorMessage: String(err) };
}

export const log = {
  debug(event: string, context?: Record<string, unknown>): void {
    emit("debug", event, context);
  },

  info(event: string, context?: Record<string, unknown>): void {
    emit("info", event, context);
  },

  warn(event: string, context?: Record<string, unknown>): void {
    emit("warn", event, context);
  },

  error(event: string, err: unknown, context?: Record<string, unknown>): void {
    emit("error", event, { ...errorContext(err), ...context });
  },
};
