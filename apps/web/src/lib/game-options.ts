import 'server-only';
import { listGames } from '@/lib/repositories/games';

/** Slug + name pairs used to populate game selectors across the CMS. */
export async function getGameOptions(limit = 200): Promise<Array<{ slug: string; name: string }>> {
  const res = await listGames({ pageSize: Math.min(limit, 60), sort: 'name' });
  return res.items.map((g) => ({ slug: g.slug, name: g.name }));
}
