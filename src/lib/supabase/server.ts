import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

/**
 * Server-side Supabase client for Server Components, Server Actions,
 * and Route Handlers.
 *
 * Uses the Clerk session JWT as the Supabase accessToken — enabling
 * Supabase RLS to identify the user via `auth.jwt()->>'sub'`.
 *
 * Server-side tokens are always freshly minted (no cache), so unlike
 * the client-side hook, `skipCache` is not needed here.
 *
 * Configured with persistSession: false to avoid onAuthStateChange conflict
 * with custom accessToken provider.
 */
export async function createClient() {
  const { getToken } = await auth();

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      accessToken: async () => (await getToken()) ?? null,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
