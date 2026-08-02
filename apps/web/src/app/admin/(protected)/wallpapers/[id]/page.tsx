import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { WallpaperEditor } from '@/components/admin/WallpaperEditor';
import { adminGetWallpaper } from '@/lib/repositories/cms';
import { getGameOptions } from '@/lib/game-options';

export const metadata: Metadata = { title: 'Edit Wallpaper' };
export const dynamic = 'force-dynamic';

export default async function EditWallpaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [wallpaper, games] = await Promise.all([adminGetWallpaper(id), getGameOptions()]);
  if (!wallpaper) notFound();
  return <WallpaperEditor initial={wallpaper} id={wallpaper.id} games={games} />;
}
