import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminClient } from '@/lib/supabase/server';
import { safeCompare } from '@modverse/shared/crypto';
import { isDemoMode } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vercel Cron target: promotes any game or post whose scheduled time has
 * arrived, then revalidates the affected pages.
 *
 * Vercel signs cron invocations with CRON_SECRET; we also accept the agent
 * key so the same endpoint can be triggered from the agent host.
 */
function authorised(req: NextRequest): boolean {
  const header = req.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const cronSecret = process.env.CRON_SECRET;
  const agentKey = process.env.AGENT_API_KEY;

  if (cronSecret && token && safeCompare(token, cronSecret)) return true;
  if (agentKey && token && safeCompare(token, agentKey)) return true;
  // Vercel's own cron requests carry this header in production.
  return req.headers.get('x-vercel-cron') === '1';
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json({ ok: false, error: { code: 'unauthorized', message: 'Invalid cron token.' } }, { status: 401 });
  }

  if (isDemoMode()) return NextResponse.json({ ok: true, data: { published: [], demo: true } });

  const db = getAdminClient();
  if (!db) return NextResponse.json({ ok: true, data: { published: [] } });

  const { data, error } = await db.rpc('publish_due_content');
  if (error) {
    console.error('[cron.publish-scheduled]', error.message);
    return NextResponse.json({ ok: false, error: { code: 'db_error', message: error.message } }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{ kind: string; id: string; slug: string }>;
  for (const row of rows) {
    revalidatePath(row.kind === 'game' ? `/game/${row.slug}` : `/blog/${row.slug}`);
  }
  if (rows.length) {
    revalidatePath('/');
    revalidatePath('/browse');
    revalidatePath('/blog');
  }

  return NextResponse.json({ ok: true, data: { published: rows, count: rows.length } });
}
