/**
 * UMA Platform — Server Action Infrastructure
 *
 * Provides the standard `ActionResult<T>` return type and the `createAction()`
 * wrapper that every server action should use.
 *
 * The wrapper handles:
 *  1. Catching AppErrors → classified { success: false, error, code }
 *  2. Catching unknown errors → generic "Something went wrong" + server log
 *  3. Returning { success: true, data } on happy path
 *
 * Usage:
 *   // In a "use server" file:
 *   import { createAction } from "@/platform/actions";
 *   import { requireActiveRole } from "@/platform/auth";
 *
 *   export const createProduct = createAction(async (data: ProductFormData) => {
 *     const user = await requireActiveRole("farmer");
 *     // ... business logic ...
 *     return { id: newProduct.id };
 *   });
 *
 * The existing action files can be migrated one at a time. Until then,
 * the old { success, error } pattern keeps working unchanged.
 */

import { AppError, safeErrorMessage, errorCode, type ErrorCode } from "@/platform/errors";
import { log } from "@/platform/logging";

// ── ActionResult ───────────────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code: ErrorCode };

// ── createAction ───────────────────────────────────────────────────────────────

/**
 * Wraps a server action handler, providing:
 *  - Typed ActionResult return
 *  - AppError → classified user-safe response
 *  - Unknown error → generic message + structured log
 *
 * The handler function receives the same arguments as the exported action.
 * If the handler returns a value, it becomes `data` in the success result.
 * If the handler returns void/undefined, `data` is `undefined`.
 */
export function createAction<TArgs extends unknown[], TResult = void>(
  handler: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<ActionResult<TResult>> {
  return async (...args: TArgs): Promise<ActionResult<TResult>> => {
    try {
      const data = await handler(...args);
      return { success: true, data };
    } catch (error) {
      if (error instanceof AppError) {
        // Structured log for observability, but keep it concise.
        if (error.code === "INTERNAL") {
          log.error("action.error", error, error.context);
        } else {
          log.info("action.rejected", {
            code: error.code,
            message: error.message,
            ...error.context,
          });
        }

        return {
          success: false,
          error: safeErrorMessage(error),
          code: errorCode(error),
        };
      }

      // Unknown / unexpected error — never leak internals.
      log.error("action.unexpected", error);

      return {
        success: false,
        error: safeErrorMessage(error),
        code: "INTERNAL",
      };
    }
  };
}
