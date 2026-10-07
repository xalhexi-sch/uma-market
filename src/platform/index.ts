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

// Business context & membership authorization (V4)
export {
  ACTIVE_BUSINESS_COOKIE,
  getActiveBusinessCookie,
  setActiveBusinessCookie,
  getUserBusinessMemberships,
  resolveActiveBusinessContext,
  getActiveBusinessContext,
  getActiveBusinessIdentity,
  requireActiveBusiness,
  requireBusinessMembership,
  requireBusinessRole,
  requireCanBuy,
  requireCanSell,
  switchActiveBusiness,
  type ActiveBusinessContext,
  type ActiveBusinessIdentity,
  type BusinessMembershipOption,
} from "./business-context";

// Business Actions (V4)
export {
  createBusinessAction,
  switchBusinessAction,
  type CreateBusinessInput,
  type BusinessActionResult,
} from "./business-actions";

// V4 Business Cart Actions
export {
  addToBusinessCart,
  updateBusinessCartItemQuantity,
  removeFromBusinessCart,
} from "./cart-actions";

// Business Member Actions & Queries (V4)
export {
  getBusinessMembers,
  getBusinessPendingInvitations,
  type BusinessMemberDetail,
  type BusinessInvitationDetail,
} from "./member-queries";

export {
  inviteBusinessStaffAction,
  removeBusinessMemberAction,
  revokeBusinessInvitationAction,
  type MemberActionResult,
} from "./member-actions";

