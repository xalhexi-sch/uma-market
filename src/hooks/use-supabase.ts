"use client";

import { useSession } from "@clerk/nextjs";
import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Returns a Supabase browser client wired to the active Clerk session.
 *
 * The Clerk session JWT is passed as the Supabase `accessToken`, enabling
 * Supabase RLS to identify the user via `auth.jwt()->>'sub'`.
 *
 * Use this hook in client components instead of calling `createClient()`
 * directly — it handles the token lifecycle automatically.
 *
 * Note: the returned client instance is stable across renders as long as
 * the session object identity doesn't change.
 */
export function useSupabase() {
  const { session } = useSession();

  const supabase = useMemo(
    () =>
      createClient(
        async () => {
          if (!session) return null;
          return (await session.getToken()) ?? null;
        }
      ),
    // Re-create the client only when the session changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.id]
  );

  return supabase;
}
