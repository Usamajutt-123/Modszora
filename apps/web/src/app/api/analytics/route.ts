import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAdminClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { isDemoMode } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const eventSchema = z.object({
  kind: z.enum(['view', 'download', 'search', 'click']),
  slug: z.string().max(140).optional(),
  entity: z.string().max(40).default('game'),
  meta: z.record(z.unknown()).optional(),
});

/**
 * Beacon endpoint for view/download counters.
 * Increments the denormalised counter on `games` and appends a raw event
 * row for the admin analytics charts.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'analytics', { windowMs: 60_000, max: 60 });
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 422 });

  const event = parsed.data;
  if (isDemoMode()) return NextResponse.json({ ok: true, data: { recorded: false, demo: true } });

  const db = getAdminClient();
  if (!db) return NextResponse.json({ ok: true, data: { recorded: false } });

  // Atomic counter bump (never read-modify-write).
  if (event.slug && (event.kind === 'view' || event.kind === 'download')) {
    const { error } = await db.rpc('increment_metric', {
      p_slug: event.slug,
      p_field: event.kind === 'view' ? 'views' : 'downloads',
      p_amount: 1,
    });
    if (error) console.error('[analytics.increment]', error.message);
  }

  await db.from('analytics_events').insert({
    kind: event.kind,
    entity: event.entity,
    slug: event.slug ?? null,
    referrer: req.headers.get('referer')?.slice(0, 500) ?? null,
    country: req.headers.get('x-vercel-ip-country') ?? null,
    device: /mobile/i.test(req.headers.get('user-agent') ?? '') ? 'mobile' : 'desktop',
    meta: event.meta ?? null,
  });

  return NextResponse.json({ ok: true, data: { recorded: true } });
}
