import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { guardAdminRoute } from '@/lib/auth';
import { callAgent } from '@/lib/agent-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  action: z.enum(['discover', 'check-updates', 'recommend']),
  sources: z.array(z.string()).optional(),
  limitPerSource: z.number().int().min(1).max(50).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  autoIngest: z.boolean().optional(),
});

/** Fires a one-off agent task from the dashboard. */
export async function POST(req: NextRequest) {
  const denied = await guardAdminRoute();
  if (denied) return denied;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: { code: 'validation_error', message: 'Invalid action.' } }, { status: 422 });
  }

  const { action, ...payload } = parsed.data;
  const result = await callAgent(action, { method: 'POST', body: payload });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: { code: 'agent_error', message: result.error } }, { status: result.status });
  }
  return NextResponse.json({ ok: true, data: result.data }, { status: 202 });
}
