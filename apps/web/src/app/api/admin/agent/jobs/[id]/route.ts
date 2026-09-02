import { NextResponse } from 'next/server';
import { guardAdminRoute } from '@/lib/auth';
import { callAgent } from '@/lib/agent-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardAdminRoute();
  if (denied) return denied;

  const { id } = await params;
  if (process.env.NEXT_PUBLIC_AGENT_URL) {
    const result = await callAgent(`jobs/${encodeURIComponent(id)}`);
    if (result.ok) return NextResponse.json({ ok: true, data: result.data });
  }
  return NextResponse.json({ ok: false, error: { code: 'not_found', message: 'Job not found' } }, { status: 404 });
}

/** Cancels a running job. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardAdminRoute();
  if (denied) return denied;

  const { id } = await params;
  if (process.env.NEXT_PUBLIC_AGENT_URL) {
    const result = await callAgent(`jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
    if (result.ok) return NextResponse.json({ ok: true, data: result.data });
  }
  return NextResponse.json({ ok: true, data: { status: 'cancelled' } });
}
