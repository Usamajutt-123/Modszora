import { NextResponse, type NextRequest } from 'next/server';
import { manualIngestSchema } from '@modverse/shared';
import { guardAdminRoute } from '@/lib/auth';
import { callAgent } from '@/lib/agent-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Manual mode: admin pastes a game URL, the agent does the rest. */
export async function POST(req: NextRequest) {
  const denied = await guardAdminRoute();
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'bad_json', message: 'Invalid JSON body.' } }, { status: 400 });
  }

  const parsed = manualIngestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: 'validation_error', message: 'Invalid request.', details: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  const body = { ...parsed.data, dryRun: (raw as Record<string, unknown>)?.dryRun };
  const result = await callAgent('ingest', { method: 'POST', body, timeoutMs: 30_000 });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: { code: 'agent_error', message: result.error } }, { status: result.status });
  }
  return NextResponse.json({ ok: true, data: result.data }, { status: 202 });
}
