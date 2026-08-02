import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import type { PublishStatus } from '@modverse/shared';
import { guardAdminRoute } from '@/lib/auth';
import { isDemoMode } from '@/lib/env';

/**
 * Shared plumbing for the admin CRUD routes.
 *
 * Every content module (wallpapers, reviews, blog, news) needs the same
 * sequence: verify the admin session, parse JSON, validate against a Zod
 * schema, write, then revalidate the affected public paths. Centralising it
 * keeps the individual route files small and guarantees none of them
 * accidentally skips the auth check.
 */

export const ok = <T,>(data: T, status = 200) => NextResponse.json({ ok: true, data }, { status });

export const fail = (code: string, message: string, status = 400, details?: unknown) =>
  NextResponse.json({ ok: false, error: { code, message, details } }, { status });

export const DEMO_MESSAGE =
  'Demo mode: Supabase is not configured, so changes cannot be saved. Add credentials to enable writing.';

/** Returns a response to short-circuit with, or null when the request may proceed. */
export async function requireAdminJson(): Promise<NextResponse | null> {
  return guardAdminRoute();
}

export function guardDemo(): NextResponse | null {
  if (isDemoMode()) return fail('demo_mode', DEMO_MESSAGE, 503);
  return null;
}

/**
 * Parses and validates a JSON body.
 *
 * Typed against the schema's OUTPUT so Zod defaults (status, arrays, flags)
 * are present and non-optional downstream — the input type still allows them
 * to be omitted by the caller.
 */
export async function parseBody<S extends z.ZodTypeAny>(
  req: NextRequest,
  schema: S,
): Promise<{ data: z.output<S>; error: null } | { data: null; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { data: null, error: fail('bad_json', 'Request body is not valid JSON.', 400) };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 10).map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    return {
      data: null,
      error: fail('validation_error', `Validation failed: ${issues.map((i) => `${i.path} ${i.message}`).join('; ')}`, 422, issues),
    };
  }
  return { data: parsed.data, error: null };
}

/** Revalidates the public pages affected by a content change. */
export function revalidateContent(kind: 'wallpaper' | 'review' | 'post' | 'game', slug?: string | null): void {
  const paths: string[] = ['/'];

  switch (kind) {
    case 'wallpaper':
      paths.push('/wallpapers', '/sitemap.xml');
      if (slug) paths.push(`/wallpapers/${slug}`);
      break;
    case 'review':
      paths.push('/reviews', '/sitemap.xml');
      if (slug) paths.push(`/reviews/${slug}`);
      break;
    case 'post':
      paths.push('/blog', '/sitemap.xml');
      if (slug) paths.push(`/blog/${slug}`);
      break;
    case 'game':
      paths.push('/browse', '/sitemap.xml');
      if (slug) paths.push(`/game/${slug}`, `/download/${slug}`);
      break;
  }

  for (const p of paths) {
    try {
      revalidatePath(p);
    } catch {
      // revalidatePath throws outside a request scope; never fatal.
    }
  }
}

/**
 * Applies publishing rules consistently:
 * - publishing for the first time stamps publishedAt
 * - scheduling clears publishedAt so the cron can claim it
 */
export function normalisePublishing<
  T extends { status: PublishStatus; publishedAt?: string | null; scheduledFor?: string | null },
>(input: T): T {
  const now = new Date().toISOString();
  const out: T = { ...input };

  if (out.status === 'published' && !out.publishedAt) out.publishedAt = now;

  if (out.status === 'scheduled') {
    out.publishedAt = null;
    // A scheduled item with no date can never be picked up by the cron,
    // so treat it as a draft rather than stranding it.
    if (!out.scheduledFor) out.status = 'draft' as T['status'];
  }

  if (out.status === 'draft') out.publishedAt = null;

  return out;
}
