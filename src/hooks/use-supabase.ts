"use client";

import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Returns a Supabase browser client wired to the active Clerk session.
 *
 * The Clerk session JWT is passed as the Supabase `accessToken`, enabling
 * Supabase RLS to identify the user via `auth.jwt()->>'sub'`.
 *
 * Uses `useAuth().getToken()` — a stable function that always returns
 * the freshest Clerk JWT. `skipCache: true` forces Clerk to mint a new
 * token on every call, preventing the "exp claim timestamp check failed"
 * error that occurs when Clerk's internal cache returns a token whose
 * `exp` is in the past (Clerk session tokens expire every ~60s).
 *
 * This is critical for multi-file uploads and other long-running
 * operations where multiple sequential Supabase requests may span
 * the Clerk token lifetime.
 */
export function useSupabase() {
  const { getToken, userId } = useAuth();

  const supabase = useMemo(
    () =>
      createClient(async () => {
        // Prevent calling Clerk's client-side getToken() during Next.js SSR pass
        if (typeof window === "undefined") return null;
        return (await getToken({ skipCache: true })) ?? null;
      }),
    // getToken is a stable function from useAuth — safe to include.
    // Re-create client only when the authenticated user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId]
  );

  return supabase;
}
