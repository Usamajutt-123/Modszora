import type { Metadata } from 'next';
import { WallpaperEditor } from '@/components/admin/WallpaperEditor';
import { getGameOptions } from '@/lib/game-options';

export const metadata: Metadata = { title: 'New Wallpaper' };
export const dynamic = 'force-dynamic';

export default async function NewWallpaperPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const game = Array.isArray(sp.game) ? sp.game[0] : sp.game;
  const games = await getGameOptions();
  return <WallpaperEditor games={games} presetGameSlug={game ?? null} />;
}
