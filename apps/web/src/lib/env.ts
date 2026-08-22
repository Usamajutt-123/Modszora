import { z } from 'zod';

/**
 * Environment access with validation.
 *
 * The site is designed to boot in three modes:
 *  1. Full  — Supabase + OpenAI + Agent configured (production).
 *  2. Partial — Supabase only (agent features degrade gracefully).
 *  3. Demo  — nothing configured; the app serves bundled fixture data so
 *     the UI is fully explorable locally without any credentials.
 */

const serverSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_SITE_NAME: z.string().default('MODSzora'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('modverse'),
  ADMIN_EMAILS: z.string().default(''),
  AGENT_API_KEY: z.string().optional(),
  SECRETS_ENCRYPTION_KEY: z.string().optional(),
  NEXT_PUBLIC_AGENT_URL: z.string().url().optional(),
  OPENAI_API_KEY: z.string().optional(),
  NEXT_PUBLIC_GA_ID: z.string().optional(),
  NEXT_PUBLIC_ADSENSE_CLIENT: z.string().optional(),
  NEXT_PUBLIC_ADSTERRA_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_ADSTERRA_KEY_LEADERBOARD: z.string().optional(),
  NEXT_PUBLIC_ADSTERRA_KEY_RECTANGLE: z.string().optional(),
  NEXT_PUBLIC_ADSTERRA_KEY_SIDEBAR: z.string().optional(),
  NEXT_PUBLIC_ADSTERRA_KEY_IN_ARTICLE: z.string().optional(),
  NEXT_PUBLIC_ADSTERRA_KEY_MOBILE: z.string().optional(),
  NEXT_PUBLIC_ADSTERRA_NATIVE_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_ADSTERRA_NATIVE_KEY: z.string().optional(),
  NEXT_PUBLIC_ADSTERRA_SOCIALBAR_SRC: z.string().optional(),
  NEXT_PUBLIC_ADSTERRA_POPUNDER_SRC: z.string().optional(),
  NEXT_PUBLIC_MONETAG_ZONE_ID: z.string().optional(),
});

type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

function read(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    AGENT_API_KEY: process.env.AGENT_API_KEY || undefined,
    SECRETS_ENCRYPTION_KEY: process.env.SECRETS_ENCRYPTION_KEY || undefined,
    NEXT_PUBLIC_AGENT_URL: process.env.NEXT_PUBLIC_AGENT_URL || undefined,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || undefined,
    NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID || undefined,
    NEXT_PUBLIC_ADSENSE_CLIENT: process.env.NEXT_PUBLIC_ADSENSE_CLIENT || undefined,
    NEXT_PUBLIC_ADSTERRA_DOMAIN: process.env.NEXT_PUBLIC_ADSTERRA_DOMAIN || undefined,
    NEXT_PUBLIC_ADSTERRA_KEY_LEADERBOARD: process.env.NEXT_PUBLIC_ADSTERRA_KEY_LEADERBOARD || undefined,
    NEXT_PUBLIC_ADSTERRA_KEY_RECTANGLE: process.env.NEXT_PUBLIC_ADSTERRA_KEY_RECTANGLE || undefined,
    NEXT_PUBLIC_ADSTERRA_KEY_SIDEBAR: process.env.NEXT_PUBLIC_ADSTERRA_KEY_SIDEBAR || undefined,
    NEXT_PUBLIC_ADSTERRA_KEY_IN_ARTICLE: process.env.NEXT_PUBLIC_ADSTERRA_KEY_IN_ARTICLE || undefined,
    NEXT_PUBLIC_ADSTERRA_KEY_MOBILE: process.env.NEXT_PUBLIC_ADSTERRA_KEY_MOBILE || undefined,
    NEXT_PUBLIC_ADSTERRA_NATIVE_DOMAIN: process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_DOMAIN || undefined,
    NEXT_PUBLIC_ADSTERRA_NATIVE_KEY: process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_KEY || undefined,
    NEXT_PUBLIC_ADSTERRA_SOCIALBAR_SRC: process.env.NEXT_PUBLIC_ADSTERRA_SOCIALBAR_SRC || undefined,
    NEXT_PUBLIC_ADSTERRA_POPUNDER_SRC: process.env.NEXT_PUBLIC_ADSTERRA_POPUNDER_SRC || undefined,
    NEXT_PUBLIC_MONETAG_ZONE_ID: process.env.NEXT_PUBLIC_MONETAG_ZONE_ID || undefined,
  });

  if (!parsed.success) {
    // Never crash the render for optional config — log and fall back to defaults.
    console.warn('[env] Invalid environment variables:', parsed.error.flatten().fieldErrors);
    cached = serverSchema.parse({});
    return cached;
  }
  cached = parsed.data;
  return cached;
}

export const env = new Proxy({} as ServerEnv, {
  get: (_t, key: string) => read()[key as keyof ServerEnv],
});

/** True when Supabase is fully configured for read access. */
export function hasSupabase(): boolean {
  const e = read();
  return Boolean(e.NEXT_PUBLIC_SUPABASE_URL && e.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** True when privileged (service-role) operations are possible. */
export function hasServiceRole(): boolean {
  const e = read();
  return Boolean(e.NEXT_PUBLIC_SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY);
}

/** Demo mode = no database configured; fixtures are served instead. */
export function isDemoMode(): boolean {
  return !hasSupabase();
}

export function adminEmails(): string[] {
  return read()
    .ADMIN_EMAILS.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  const fromVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : null;

  return (fromVercel || 'http://localhost:3000').replace(/\/+$/, '');
}
