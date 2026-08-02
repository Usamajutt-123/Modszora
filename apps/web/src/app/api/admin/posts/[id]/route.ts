import { type NextRequest } from 'next/server';
import { blogPostSchema } from '@modverse/shared';
import { adminDeletePost, adminGetPost, adminUpsertPost } from '@/lib/repositories/cms';
import { fail, guardDemo, ok, parseBody, requireAdminJson, normalisePublishing, revalidateContent } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminJson();
  if (denied) return denied;
  const { id } = await params;
  const item = await adminGetPost(id);
  if (!item) return fail('not_found', 'Post not found.', 404);
  return ok(item);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminJson();
  if (denied) return denied;
  const { id } = await params;
  const { data, error } = await parseBody(req, blogPostSchema);
  if (error) return error;

  const demo = guardDemo();
  if (demo) return demo;

  const result = await adminUpsertPost(normalisePublishing(data), id);
  if (!result.ok) return fail('db_error', result.error ?? 'Could not update post.', 500);

  revalidateContent('post', result.slug);
  return ok({ id: result.id, slug: result.slug });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminJson();
  if (denied) return denied;
  const demo = guardDemo();
  if (demo) return demo;

  const { id } = await params;
  const existing = await adminGetPost(id);
  const deleted = await adminDeletePost(id);
  if (!deleted) return fail('db_error', 'Could not delete post.', 500);

  revalidateContent('post', existing?.slug);
  return ok({ deleted: true });
}
