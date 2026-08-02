import { type NextRequest } from 'next/server';
import { reviewSchema } from '@modverse/shared';
import { adminDeleteReview, adminGetReview, adminUpsertReview } from '@/lib/repositories/cms';
import { fail, guardDemo, ok, parseBody, requireAdminJson, normalisePublishing, revalidateContent } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminJson();
  if (denied) return denied;
  const { id } = await params;
  const item = await adminGetReview(id);
  if (!item) return fail('not_found', 'Review not found.', 404);
  return ok(item);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminJson();
  if (denied) return denied;
  const { id } = await params;
  const { data, error } = await parseBody(req, reviewSchema);
  if (error) return error;

  const demo = guardDemo();
  if (demo) return demo;

  const result = await adminUpsertReview(normalisePublishing(data), id);
  if (!result.ok) return fail('db_error', result.error ?? 'Could not update review.', 500);

  revalidateContent('review', result.slug);
  if (data.gameSlug) revalidateContent('game', data.gameSlug);
  return ok({ id: result.id, slug: result.slug });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminJson();
  if (denied) return denied;
  const demo = guardDemo();
  if (demo) return demo;

  const { id } = await params;
  const existing = await adminGetReview(id);
  const deleted = await adminDeleteReview(id);
  if (!deleted) return fail('db_error', 'Could not delete review.', 500);

  revalidateContent('review', existing?.slug);
  return ok({ deleted: true });
}
