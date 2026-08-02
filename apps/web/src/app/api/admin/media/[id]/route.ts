import { type NextRequest } from 'next/server';
import { deleteMedia } from '@/lib/repositories/cms';
import { fail, guardDemo, ok, requireAdminJson } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminJson();
  if (denied) return denied;
  const demo = guardDemo();
  if (demo) return demo;

  const { id } = await params;
  const result = await deleteMedia(id);
  if (!result.ok) return fail('delete_failed', result.error ?? 'Could not delete asset.', 500);
  return ok({ deleted: true });
}
