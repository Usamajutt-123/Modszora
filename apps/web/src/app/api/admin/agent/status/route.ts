import { NextResponse } from 'next/server';
import { guardAdminRoute } from '@/lib/auth';
import { callAgent } from '@/lib/agent-client';
import type { AgentStatusSnapshot } from '@modverse/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await guardAdminRoute();
  if (denied) return denied;

  const result = await callAgent<AgentStatusSnapshot>('status');
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: { code: 'agent_unreachable', message: result.error } },
      { status: result.status },
    );
  }
  return NextResponse.json({ ok: true, data: result.data });
}
