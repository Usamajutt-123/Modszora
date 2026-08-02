import { type NextRequest } from 'next/server';
import { mediaQuerySchema } from '@modverse/shared';
import { listMedia, mediaFolderCounts } from '@/lib/repositories/cms';
import { ok, requireAdminJson } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const parsed = mediaQuerySchema.safeParse({
    q: sp.get('q') ?? undefined,
    folder: sp.get('folder') ?? undefined,
    page: sp.get('page') ?? 1,
    pageSize: sp.get('pageSize') ?? 40,
    sort: sp.get('sort') ?? 'newest',
  });
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 40, sort: 'newest' as const };

  const [items, folders] = await Promise.all([listMedia(query), mediaFolderCounts()]);
  return ok({ ...items, folders });
}
