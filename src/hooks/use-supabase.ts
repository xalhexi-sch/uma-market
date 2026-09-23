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
 * the freshest Clerk JWT. This avoids the stale-closure problem that
 * occurs when `useSession().session` is captured inside `useMemo`:
 * the session reference doesn't change when Clerk rotates the JWT
 * (~60s), causing `session.getToken()` to return an expired token
 * for long-running operations like Storage uploads.
 */
export function useSupabase() {
  const { getToken, userId } = useAuth();

  const supabase = useMemo(
    () =>
      createClient(
        async () => (await getToken()) ?? null
      ),
    // getToken is a stable function from useAuth — safe to include.
    // Re-create client only when the authenticated user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId]
  );

  return supabase;
}

