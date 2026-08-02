import { type NextRequest } from 'next/server';
import { wallpaperSchema } from '@modverse/shared';
import { adminListWallpapers, adminUpsertWallpaper } from '@/lib/repositories/cms';
import { fail, guardDemo, ok, parseBody, requireAdminJson, normalisePublishing, revalidateContent } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const result = await adminListWallpapers({
    q: sp.get('q') ?? undefined,
    status: sp.get('status') ?? undefined,
    category: sp.get('category') ?? undefined,
    page: Number(sp.get('page') ?? 1) || 1,
    pageSize: Math.min(Number(sp.get('pageSize') ?? 24) || 24, 100),
    sort: (sp.get('sort') as never) ?? 'newest',
  });
  return ok(result);
}

export async function POST(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;
  const { data, error } = await parseBody(req, wallpaperSchema);
  if (error) return error;

  const demo = guardDemo();
  if (demo) return demo;

  const result = await adminUpsertWallpaper(normalisePublishing(data));
  if (!result.ok) return fail('db_error', result.error ?? 'Could not save wallpaper.', 500);

  revalidateContent('wallpaper', result.slug);
  return ok({ id: result.id, slug: result.slug }, 201);
}
