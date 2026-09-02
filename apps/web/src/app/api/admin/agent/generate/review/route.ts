import { type NextRequest } from 'next/server';
import { reviewGenerateRequestSchema } from '@modverse/shared';
import { callAgent } from '@/lib/agent-client';
import { fail, ok, parseBody, requireAdminJson } from '@/lib/api-helpers';
import { generateAutoReview } from '@/lib/ai-generator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Synchronous review generation — populated into the editor.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { data, error } = await parseBody(req, reviewGenerateRequestSchema);
  if (error) return error;

  // 1. If external agent URL is set, try calling it
  if (process.env.NEXT_PUBLIC_AGENT_URL) {
    const result = await callAgent('generate/review', { method: 'POST', body: data, timeoutMs: 110_000 });
    if (result.ok) return ok(result.data);
  }

  // 2. Otherwise run direct in-app Gemini generation
  try {
    const gameName = data.gameName || (data.gameSlug || 'Game').replace(/-mod-apk$/i, '').replace(/-/g, ' ');
    const review = await generateAutoReview({
      slug: data.gameSlug || 'game-mod-apk',
      name: gameName,
    });
    return ok({
      action: data.action,
      source: 'gemini',
      review,
      gameName,
    });
  } catch (err) {
    return fail('generation_error', err instanceof Error ? err.message : 'Review generation failed', 500);
  }
}
