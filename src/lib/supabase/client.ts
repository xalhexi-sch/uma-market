import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Returns a Supabase browser client wired to the active session.
 *
 * Always supply `accessToken` in authenticated contexts so that
 * Supabase can enforce RLS using the Clerk session JWT.
 *
 * Usage in client components: use the `useSupabase()` hook instead,
 * which wires the Clerk session token automatically.
 *
 * Note: RLS policies must use `auth.jwt()->>'sub'` (Clerk user ID),
 * NOT `auth.uid()` (which is Supabase Auth-specific).
 */
export function createClient(
  accessToken?: () => Promise<string | null>
) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      accessToken,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
