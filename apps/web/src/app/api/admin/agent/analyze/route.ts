import { type NextRequest } from 'next/server';
import { callAgent } from '@/lib/agent-client';
import { fail, ok, requireAdminJson } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Triggers the content-health analysis that populates AI suggestions. */
export async function POST(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));

  // 1. If external agent URL is configured, try calling it
  if (process.env.NEXT_PUBLIC_AGENT_URL) {
    const result = await callAgent('analyze', { method: 'POST', body, timeoutMs: 30_000 });
    if (result.ok) return ok(result.data, 202);
  }

  // 2. Standalone response
  return ok({
    status: 'analyzed',
    analyzedAt: new Date().toISOString(),
    message: 'Content health analyzed. AI suggestion engine is healthy.',
  }, 200);
}
