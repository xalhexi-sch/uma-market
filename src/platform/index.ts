/**
 * UMA Platform Layer — Public API
 *
 * Re-exports the foundation modules so consumers can import from
 * `@/platform` directly instead of reaching into individual files.
 *
 * Example:
 *   import { requireActiveRole, createAction, routes, AppError, log } from "@/platform";
 */

// Auth & authorization
export {
  requireUser,
  requireRole,
  requireActiveUser,
  requireActiveRole,
  type AuthenticatedUser,
  type ActiveUser,
} from "./auth";

// Server action wrapper & result type
export {
  createAction,
  type ActionResult,
} from "./actions";

// Error types
export {
  AppError,
  safeErrorMessage,
  errorCode,
  ERROR_CODES,
  type ErrorCode,
} from "./errors";

// Structured logging
export { log } from "./logging";

// Routes
export { routes, dashboardRoot } from "./routes";
