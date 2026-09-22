import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client.
 *
 * ⚠️  SERVER-ONLY. Never import this in client components or expose
 * the service-role key to the browser. It bypasses all RLS policies.
 *
 * Allowed uses:
 *  - Clerk webhook handler (sync user to profiles table)
 *  - Admin-only Server Actions that need cross-user data access
 *
 * For normal authenticated reads/writes, use `createClient()` from
 * `@/lib/supabase/server` instead.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
