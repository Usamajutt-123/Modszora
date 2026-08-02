import { type NextRequest } from 'next/server';
import { gameSchema } from '@modverse/shared';
import { adminDeleteGame, adminGetGame, adminUpsertGame } from '@/lib/repositories/cms';
import { fail, guardDemo, ok, parseBody, requireAdminJson, normalisePublishing, revalidateContent } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { id } = await params;
  const game = await adminGetGame(id);
  if (!game) return fail('not_found', 'Game not found.', 404);
  return ok(game);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { id } = await params;
  const { data, error } = await parseBody(req, gameSchema);
  if (error) return error;

  const demo = guardDemo();
  if (demo) return demo;

  const result = await adminUpsertGame(normalisePublishing(data), id);
  if (!result.ok) return fail('db_error', result.error ?? 'Could not update game.', 409);

  revalidateContent('game', result.slug);
  return ok({ id: result.id, slug: result.slug });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const demo = guardDemo();
  if (demo) return demo;

  const { id } = await params;
  const existing = await adminGetGame(id);
  const deleted = await adminDeleteGame(id);
  if (!deleted) return fail('db_error', 'Could not delete game.', 500);

  revalidateContent('game', existing?.slug);
  return ok({ deleted: true });
}