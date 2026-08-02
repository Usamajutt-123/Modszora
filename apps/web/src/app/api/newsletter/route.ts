import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAdminClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { isDemoMode } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email().max(180),
  source: z.string().max(60).optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'newsletter', { windowMs: 60_000, max: 5 });
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'bad_json', message: 'Invalid request.' } }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: 'invalid_email', message: 'Please enter a valid email address.' } },
      { status: 422 },
    );
  }

  const email = parsed.data.email.toLowerCase().trim();

  if (isDemoMode()) {
    return NextResponse.json({ ok: true, data: { subscribed: true, demo: true } });
  }

  const db = getAdminClient();
  if (!db) {
    return NextResponse.json(
      { ok: false, error: { code: 'not_configured', message: 'Newsletter is unavailable right now.' } },
      { status: 503 },
    );
  }

  // Stored in `settings` under a dedicated key so no extra table is needed.
  const { data: existing } = await db.from('settings').select('value').eq('key', 'newsletter').maybeSingle();
  const list: string[] = Array.isArray((existing?.value as any)?.emails) ? (existing!.value as any).emails : [];

  if (!list.includes(email)) list.push(email);

  const { error } = await db
    .from('settings')
    .upsert({ key: 'newsletter', value: { emails: list, updatedAt: new Date().toISOString() } }, { onConflict: 'key' });

  if (error) {
    console.error('[newsletter]', error.message);
    return NextResponse.json({ ok: false, error: { code: 'db_error', message: 'Subscription failed.' } }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { subscribed: true } });
}
