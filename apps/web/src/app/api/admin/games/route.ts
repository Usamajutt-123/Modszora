import { type NextRequest } from 'next/server';
import { gameSchema } from '@modverse/shared';
import { adminUpsertGame } from '@/lib/repositories/cms';
import { listAdminGames } from '@/lib/repositories/admin';
import { fail, guardDemo, ok, parseBody, requireAdminJson, normalisePublishing, revalidateContent } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Manual game CRUD for the admin panel.
 *
 * Additive to the agent pipeline: /api/agent/publish is unchanged and still
 * owns automated publishing. Both paths validate against the same
 * `gameSchema` and write through the same mapper, so records are identical
 * regardless of origin.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const result = await listAdminGames({
    q: sp.get('q') ?? undefined,
    status: sp.get('status') ?? undefined,
    page: Number(sp.get('page') ?? 1) || 1,
    pageSize: Math.min(Number(sp.get('pageSize') ?? 20) || 20, 100),
  });
  return ok(result);
}

export async function POST(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { data, error } = await parseBody(req, gameSchema);
  if (error) return error;

  const demo = guardDemo();
  if (demo) return demo;

  const result = await adminUpsertGame(normalisePublishing(data));
  if (!result.ok) return fail('db_error', result.error ?? 'Could not save game.', 409);

  revalidateContent('game', result.slug);
  return ok({ id: result.id, slug: result.slug }, 201);
}