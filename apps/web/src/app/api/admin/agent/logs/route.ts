import { NextResponse, type NextRequest } from 'next/server';
import { guardAdminRoute } from '@/lib/auth';
import { callAgent } from '@/lib/agent-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await guardAdminRoute();
  if (denied) return denied;

  const qs = req.nextUrl.searchParams.toString();
  const result = await callAgent(`logs${qs ? `?${qs}` : ''}`);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: { code: 'agent_unreachable', message: result.error } }, { status: result.status });
  }
  return NextResponse.json({ ok: true, data: result.data });
}
