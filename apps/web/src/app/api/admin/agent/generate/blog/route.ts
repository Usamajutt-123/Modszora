import { type NextRequest } from 'next/server';
import { blogGenerateRequestSchema } from '@modverse/shared';
import { callAgent } from '@/lib/agent-client';
import { fail, ok, parseBody, requireAdminJson } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { data, error } = await parseBody(req, blogGenerateRequestSchema);
  if (error) return error;

  const result = await callAgent('generate/blog', { method: 'POST', body: data, timeoutMs: 30_000 });
  if (!result.ok) return fail('agent_error', result.error ?? 'Agent request failed.', result.status);
  return ok(result.data, 202);
}
