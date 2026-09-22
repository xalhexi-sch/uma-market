import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";

/**
 * Server-side Supabase client for Server Components, Server Actions,
 * and Route Handlers.
 *
 * Uses the Clerk session JWT as the Supabase accessToken — enabling
 * Supabase RLS to identify the user via `auth.jwt()->>'sub'`.
 *
 * Do NOT use this client in unauthenticated contexts. For public
 * data reads, pass no accessToken (caller must handle accordingly).
 *
 * Setup required (one-time, in Supabase Dashboard):
 *   Authentication → Sign In / Providers → Third Party Auth → Add Clerk
 *   Paste your Clerk domain (e.g. thankful-terrapin-2971.clerk.accounts.dev)
 *
 * Setup required (one-time, in Clerk Dashboard):
 *   Sessions → Customize session token → Add:
 *   { "role": "{{user.public_metadata.role}}" }
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { getToken } = await auth();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      accessToken: async () => (await getToken()) ?? null,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — mutations only allowed
            // in Server Actions or Route Handlers.
          }
        },
      },
    }
  );
}
