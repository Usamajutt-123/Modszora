import type { Metadata } from 'next';
import { ReviewEditor } from '@/components/admin/ReviewEditor';
import { getGameOptions } from '@/lib/game-options';

export const metadata: Metadata = { title: 'New Review' };
export const dynamic = 'force-dynamic';

export default async function NewReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const game = Array.isArray(sp.game) ? sp.game[0] : sp.game;
  const games = await getGameOptions();
  return <ReviewEditor games={games} presetGameSlug={game ?? null} />;
}
