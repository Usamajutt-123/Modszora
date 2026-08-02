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
  const result = await callAgent('analyze', { method: 'POST', body, timeoutMs: 30_000 });
  if (!result.ok) return fail('agent_error', result.error ?? 'Agent request failed.', result.status);
  return ok(result.data, 202);
}
