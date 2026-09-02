import { type NextRequest } from 'next/server';
import { blogGenerateRequestSchema } from '@modverse/shared';
import { callAgent } from '@/lib/agent-client';
import { fail, ok, parseBody, requireAdminJson } from '@/lib/api-helpers';
import { generateAutoBlog } from '@/lib/ai-generator';
import { adminUpsertPost } from '@/lib/repositories/cms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { data, error } = await parseBody(req, blogGenerateRequestSchema);
  if (error) return error;

  // 1. If external agent URL is set, try calling it
  if (process.env.NEXT_PUBLIC_AGENT_URL) {
    const result = await callAgent('generate/blog', { method: 'POST', body: data, timeoutMs: 30_000 });
    if (result.ok) return ok(result.data, 202);
  }

  // 2. Otherwise run direct in-app Gemini generation
  try {
    const post = await generateAutoBlog({
      template: data.template,
      games: data.gameNames,
      isNews: data.isNews,
    });
    if (data.topic) {
      post.title = data.topic;
    }
    const saved = await adminUpsertPost(post);
    return ok({ action: 'created', slug: saved.slug || post.slug, title: post.title, post }, 200);
  } catch (err) {
    return fail('generation_error', err instanceof Error ? err.message : 'Blog generation failed', 500);
  }
}
