import { redirect } from "next/navigation";
import { requireActiveBusiness, type ActiveBusinessContext } from "@/platform/business-context";
import { AppError } from "@/platform/errors";
import { routes } from "@/platform/routes";

/**
 * Resolves the server-validated active business for a /dashboard/* page,
 * redirecting the way /dashboard does when there is none. Capability checks
 * (e.g. SELL) stay with the page, which renders its own explanation.
 */
export async function requireWorkspaceBusiness(): Promise<ActiveBusinessContext> {
  try {
    return await requireActiveBusiness();
  } catch (err: unknown) {
    if (err instanceof AppError && (err.code === "UNAUTHENTICATED" || err.code === "UNAUTHORIZED")) {
      redirect(routes.signIn);
    }
    redirect(routes.onboarding);
  }
}
