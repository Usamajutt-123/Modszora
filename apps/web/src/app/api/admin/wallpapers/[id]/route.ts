import { type NextRequest } from 'next/server';
import { wallpaperSchema } from '@modverse/shared';
import { adminDeleteWallpaper, adminGetWallpaper, adminUpsertWallpaper } from '@/lib/repositories/cms';
import { fail, guardDemo, ok, parseBody, requireAdminJson, normalisePublishing, revalidateContent } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminJson();
  if (denied) return denied;
  const { id } = await params;
  const item = await adminGetWallpaper(id);
  if (!item) return fail('not_found', 'Wallpaper not found.', 404);
  return ok(item);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminJson();
  if (denied) return denied;
  const { id } = await params;
  const { data, error } = await parseBody(req, wallpaperSchema);
  if (error) return error;

  const demo = guardDemo();
  if (demo) return demo;

  const result = await adminUpsertWallpaper(normalisePublishing(data), id);
  if (!result.ok) return fail('db_error', result.error ?? 'Could not update wallpaper.', 500);

  revalidateContent('wallpaper', result.slug);
  return ok({ id: result.id, slug: result.slug });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminJson();
  if (denied) return denied;
  const demo = guardDemo();
  if (demo) return demo;

  const { id } = await params;
  const existing = await adminGetWallpaper(id);
  const deleted = await adminDeleteWallpaper(id);
  if (!deleted) return fail('db_error', 'Could not delete wallpaper.', 500);

  revalidateContent('wallpaper', existing?.slug);
  return ok({ deleted: true });
}
