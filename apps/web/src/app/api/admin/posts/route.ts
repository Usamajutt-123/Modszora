import { type NextRequest } from 'next/server';
import { blogPostSchema } from '@modverse/shared';
import { adminListPosts, adminUpsertPost } from '@/lib/repositories/cms';
import { fail, guardDemo, ok, parseBody, requireAdminJson, normalisePublishing, revalidateContent } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const isNewsParam = sp.get('isNews');
  const result = await adminListPosts({
    q: sp.get('q') ?? undefined,
    status: sp.get('status') ?? undefined,
    category: sp.get('category') ?? undefined,
    isNews: isNewsParam === null ? undefined : isNewsParam === 'true',
    page: Number(sp.get('page') ?? 1) || 1,
    pageSize: Math.min(Number(sp.get('pageSize') ?? 24) || 24, 100),
    sort: (sp.get('sort') as never) ?? 'newest',
  });
  return ok(result);
}

export async function POST(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;
  const { data, error } = await parseBody(req, blogPostSchema);
  if (error) return error;

  const demo = guardDemo();
  if (demo) return demo;

  const result = await adminUpsertPost(normalisePublishing(data));
  if (!result.ok) return fail('db_error', result.error ?? 'Could not save post.', 500);

  revalidateContent('post', result.slug);
  return ok({ id: result.id, slug: result.slug }, 201);
}
