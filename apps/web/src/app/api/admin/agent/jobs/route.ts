import { NextResponse, type NextRequest } from 'next/server';
import { guardAdminRoute } from '@/lib/auth';
import { callAgent } from '@/lib/agent-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await guardAdminRoute();
  if (denied) return denied;

  if (process.env.NEXT_PUBLIC_AGENT_URL) {
    const qs = req.nextUrl.searchParams.toString();
    const result = await callAgent(`jobs${qs ? `?${qs}` : ''}`);
    if (result.ok) return NextResponse.json({ ok: true, data: result.data });
  }

  // Fallback when running standalone in-app
  return NextResponse.json({ ok: true, data: { jobs: [] } });
}
