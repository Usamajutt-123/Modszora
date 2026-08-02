import { type NextRequest } from 'next/server';
import { reviewGenerateRequestSchema } from '@modverse/shared';
import { callAgent } from '@/lib/agent-client';
import { fail, ok, parseBody, requireAdminJson } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Synchronous review generation — the editor waits for the result, so this
 * gets a longer timeout than the queued generators.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { data, error } = await parseBody(req, reviewGenerateRequestSchema);
  if (error) return error;

  const result = await callAgent('generate/review', { method: 'POST', body: data, timeoutMs: 110_000 });
  if (!result.ok) return fail('agent_error', result.error ?? 'Agent request failed.', result.status);
  return ok(result.data);
}
