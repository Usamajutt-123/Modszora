import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GameEditor } from '@/components/admin/GameEditor';
import { adminGetGame } from '@/lib/repositories/cms';

export const metadata: Metadata = { title: 'Edit Game' };
export const dynamic = 'force-dynamic';

/** Manual game update â€” full edit form for an existing listing. */
export default async function ManageGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await adminGetGame(id);
  if (!game) notFound();
  return <GameEditor initial={game} id={game.id} />;
}