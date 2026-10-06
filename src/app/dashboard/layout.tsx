import type { ReactNode } from "react";
import { redirectIfAccountInactive } from "@/platform/account-gate";

/**
 * Account-status gate for /dashboard/*. It runs here, outside this segment's
 * loading.tsx Suspense boundary, so a revoked account gets a real 307 to
 * /sign-in?revoked=true before any streamed content is sent.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await redirectIfAccountInactive();
  return children;
}
