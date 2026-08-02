import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { env, hasServiceRole, hasSupabase } from '@/lib/env';

/**
 * Three client flavours:
 *  - `getServerClient()`  — respects RLS, reads the admin session cookie.
 *  - `getAdminClient()`   — service role, bypasses RLS (server only!).
 *  - `getPublicClient()`  — anon, no cookies, safe for ISR/static rendering.
 */

export async function getServerClient(): Promise<SupabaseClient | null> {
  if (!hasSupabase()) return null;
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL as string, env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — middleware refreshes the session instead.
        }
      },
    },
  });
}

/** Service-role client. NEVER expose the result of this to the browser. */
export function getAdminClient(): SupabaseClient | null {
  if (!hasServiceRole()) return null;
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL as string, env.SUPABASE_SERVICE_ROLE_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-modverse-role': 'service' } },
  });
}

/** Cookie-free anon client — usable during static generation / ISR. */
export function getPublicClient(): SupabaseClient | null {
  if (!hasSupabase()) return null;
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL as string, env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Preferred read client: service role when available (so scheduled/draft
 * content is visible to admin screens), else anon.
 */
export function getReadClient(): SupabaseClient | null {
  return getAdminClient() ?? getPublicClient();
}
