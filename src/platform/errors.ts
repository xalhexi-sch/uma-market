/**
 * UMA Platform — Error Boundaries
 *
 * Provides typed errors that the action wrapper can classify and safely
 * surface to users without leaking internals.
 *
 * Usage:
 *   throw new AppError("NOT_FOUND", "Product not found");
 *   throw new AppError("UNAUTHORIZED");               // uses default message
 *   throw new AppError("FORBIDDEN", "Account suspended", { userId });
 */

// ── Error codes ────────────────────────────────────────────────────────────────
// Keep this list small and stable. Each code maps to an HTTP-like category.

export const ERROR_CODES = {
  // Auth / identity
  UNAUTHENTICATED: "UNAUTHENTICATED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE",

  // Input
  VALIDATION: "VALIDATION",
  NOT_FOUND: "NOT_FOUND",

  // Business logic
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",

  // System
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Sign in to continue.",
  UNAUTHORIZED: "You don't have permission to do this.",
  FORBIDDEN: "Access denied.",
  ACCOUNT_INACTIVE: "Your account is not active.",
  VALIDATION: "Invalid input.",
  NOT_FOUND: "Not found.",
  CONFLICT: "This action conflicts with the current state.",
  RATE_LIMITED: "Too many requests. Please try again shortly.",
  INTERNAL: "Something went wrong. Please try again.",
};

// ── AppError ───────────────────────────────────────────────────────────────────

export class AppError extends Error {
  readonly code: ErrorCode;
  /** Optional structured context for server-side logging (never sent to client). */
  readonly context?: Record<string, unknown>;

  constructor(code: ErrorCode, message?: string, context?: Record<string, unknown>) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
    this.context = context;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns a user-safe message for any error.
 * AppErrors surface their message; unknown errors are replaced with a generic message.
 */
export function safeErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  return DEFAULT_MESSAGES.INTERNAL;
}

/**
 * Returns the error code if the error is an AppError, otherwise INTERNAL.
 */
export function errorCode(error: unknown): ErrorCode {
  if (error instanceof AppError) return error.code;
  return "INTERNAL";
}
