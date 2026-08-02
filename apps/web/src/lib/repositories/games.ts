import 'server-only';
import { cache } from 'react';
import type { GameCategory, GameCollection, GameRecord, Paginated, SearchQuery } from '@modverse/shared';
import { DEFAULT_PAGE_SIZE } from '@modverse/shared';
import { getReadClient } from '@/lib/supabase/server';
import { isDemoMode } from '@/lib/env';
import { rowToGame } from '@/lib/mappers';
import { demoGames } from '@/data/fixtures.generated';

/**
 * Games repository.
 *
 * Every function works in two modes:
 *  • Supabase configured → real SQL with indexes, FTS and pagination.
 *  • Demo mode           → the same queries executed against fixtures,
 *                          so the UI is identical with zero setup.
 */

const SELECT = '*';

/* ───────────────────────── demo helpers ───────────────────────── */

function demoPublished(): GameRecord[] {
  return demoGames.filter((g) => g.status === 'published');
}

function sortDemo(items: GameRecord[], sort: SearchQuery['sort']): GameRecord[] {
  const arr = [...items];
  switch (sort) {
    case 'popular':
      return arr.sort((a, b) => b.downloads - a.downloads);
    case 'downloads':
      return arr.sort((a, b) => b.downloads - a.downloads);
    case 'rating':
      return arr.sort((a, b) => b.rating - a.rating);
    case 'name':
      return arr.sort((a, b) => a.name.localeCompare(b.name));
    case 'trending':
      return arr.sort((a, b) => trendScore(b) - trendScore(a));
    case 'newest':
    default:
      return arr.sort(
        (a, b) => new Date(b.publishedAt ?? b.createdAt).getTime() - new Date(a.publishedAt ?? a.createdAt).getTime(),
      );
  }
}

/** Mirrors the SQL `trending_score()` function so demo ordering matches prod. */
function trendScore(g: GameRecord): number {
  const ageDays = Math.max((Date.now() - new Date(g.publishedAt ?? g.createdAt).getTime()) / 86_400_000, 0.5);
  return (g.downloads * 1.5 + g.views * 0.4) / Math.pow(ageDays + 2, 1.25) + g.rating * 12;
}

function paginate<T>(items: T[], page: number, pageSize: number): Paginated<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
    hasMore: safePage < totalPages,
  };
}

/* ───────────────────────── queries ───────────────────────── */

export const getGameBySlug = cache(async (slug: string): Promise<GameRecord | null> => {
  if (isDemoMode()) return demoGames.find((g) => g.slug === slug) ?? null;
  const db = getReadClient();
  if (!db) return null;
  const { data, error } = await db.from('games').select(SELECT).eq('slug', slug).maybeSingle();
  if (error) {
    console.error('[games.getGameBySlug]', error.message);
    return null;
  }
  return data ? rowToGame(data) : null;
});

export const getGameByPackage = cache(async (packageName: string): Promise<GameRecord | null> => {
  if (isDemoMode()) return demoGames.find((g) => g.packageName === packageName) ?? null;
  const db = getReadClient();
  if (!db) return null;
  const { data } = await db.from('games').select(SELECT).eq('package_name', packageName).maybeSingle();
  return data ? rowToGame(data) : null;
});

export const listGames = cache(async (query: Partial<SearchQuery> = {}): Promise<Paginated<GameRecord>> => {
  const {
    q,
    category,
    collection,
    developer,
    androidVersion,
    genre,
    tag,
    minRating,
    sort = 'newest',
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = query;

  if (isDemoMode()) {
    let items = demoPublished();
    if (q) {
      const needle = q.toLowerCase();
      items = items.filter(
        (g) =>
          g.name.toLowerCase().includes(needle) ||
          g.developer.toLowerCase().includes(needle) ||
          g.tags.some((t) => t.toLowerCase().includes(needle)) ||
          g.shortDescription.toLowerCase().includes(needle),
      );
    }
    if (category) items = items.filter((g) => g.category === category);
    if (collection) items = items.filter((g) => g.collections.includes(collection));
    if (developer) items = items.filter((g) => g.developer.toLowerCase() === developer.toLowerCase());
    if (androidVersion) items = items.filter((g) => g.androidVersion === androidVersion);
    if (genre) items = items.filter((g) => g.genres.some((x) => x.toLowerCase() === genre.toLowerCase()));
    if (tag) items = items.filter((g) => g.tags.some((x) => x.toLowerCase() === tag.toLowerCase()));
    if (minRating) items = items.filter((g) => g.rating >= minRating);
    return paginate(sortDemo(items, sort), page, pageSize);
  }

  const db = getReadClient();
  if (!db) return paginate([], page, pageSize);

  let builder = db.from('games').select(SELECT, { count: 'exact' }).eq('status', 'published');

  if (q) builder = builder.textSearch('search_vector', q, { type: 'websearch', config: 'english' });
  if (category) builder = builder.eq('category', category);
  if (collection) builder = builder.contains('collections', [collection]);
  if (developer) builder = builder.ilike('developer', developer);
  if (androidVersion) builder = builder.eq('android_version', androidVersion);
  if (genre) builder = builder.contains('genres', [genre]);
  if (tag) builder = builder.contains('tags', [tag]);
  if (minRating) builder = builder.gte('rating', minRating);

  switch (sort) {
    case 'popular':
    case 'downloads':
      builder = builder.order('downloads', { ascending: false });
      break;
    case 'rating':
      builder = builder.order('rating', { ascending: false }).order('rating_count', { ascending: false });
      break;
    case 'name':
      builder = builder.order('name', { ascending: true });
      break;
    case 'trending':
      // Approximate the SQL trend function with a cheap composite ordering.
      builder = builder.order('updated_date', { ascending: false, nullsFirst: false }).order('downloads', { ascending: false });
      break;
    default:
      builder = builder.order('published_at', { ascending: false, nullsFirst: false });
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await builder.range(from, from + pageSize - 1);
  if (error) {
    console.error('[games.listGames]', error.message);
    return paginate([], page, pageSize);
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items: (data ?? []).map(rowToGame),
    page,
    pageSize,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
});

export const getCollection = cache(
  async (collection: GameCollection, limit = 12): Promise<GameRecord[]> => {
    const sortByCollection: Record<GameCollection, SearchQuery['sort']> = {
      trending: 'trending',
      latest: 'newest',
      popular: 'popular',
      'mod-menu': 'popular',
      premium: 'rating',
      offline: 'popular',
      'editors-choice': 'rating',
      'recently-updated': 'newest',
    };
    const res = await listGames({ collection, sort: sortByCollection[collection], pageSize: limit, page: 1 });
    return res.items;
  },
);

export const getFeaturedGames = cache(async (limit = 5): Promise<GameRecord[]> => {
  if (isDemoMode()) return demoPublished().filter((g) => g.featured).slice(0, limit);
  const db = getReadClient();
  if (!db) return [];
  const { data } = await db
    .from('games')
    .select(SELECT)
    .eq('status', 'published')
    .eq('featured', true)
    .order('downloads', { ascending: false })
    .limit(limit);
  return (data ?? []).map(rowToGame);
});

export const getRelatedGames = cache(async (slug: string, limit = 8): Promise<GameRecord[]> => {
  const base = await getGameBySlug(slug);
  if (!base) return [];

  if (isDemoMode()) {
    return demoPublished()
      .filter((g) => g.slug !== slug)
      .map((g) => {
        const tagOverlap = g.tags.filter((t) => base.tags.includes(t)).length;
        const score =
          (g.category === base.category ? 2 : 0) +
          tagOverlap +
          (g.developer.toLowerCase() === base.developer.toLowerCase() ? 1 : 0);
        return { g, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.g.downloads - a.g.downloads)
      .slice(0, limit)
      .map((x) => x.g);
  }

  const db = getReadClient();
  if (!db) return [];
  const { data, error } = await db.rpc('related_games', { p_slug: slug, p_limit: limit });
  if (error) {
    // Fallback: same category.
    const { data: fallback } = await db
      .from('games')
      .select(SELECT)
      .eq('status', 'published')
      .eq('category', base.category)
      .neq('slug', slug)
      .order('downloads', { ascending: false })
      .limit(limit);
    return (fallback ?? []).map(rowToGame);
  }
  return (data ?? []).map(rowToGame);
});

export const getRecommendedGames = cache(async (slug: string, limit = 6): Promise<GameRecord[]> => {
  const base = await getGameBySlug(slug);
  const pool = await listGames({ sort: 'trending', pageSize: limit + 8 });
  return pool.items.filter((g) => g.slug !== slug && g.category !== base?.category).slice(0, limit);
});

export const getAllGameSlugs = cache(async (): Promise<Array<{ slug: string; updatedAt: string }>> => {
  if (isDemoMode()) return demoPublished().map((g) => ({ slug: g.slug, updatedAt: g.updatedAt }));
  const db = getReadClient();
  if (!db) return [];
  const { data } = await db.from('games').select('slug, updated_at').eq('status', 'published').limit(50000);
  return (data ?? []).map((r: any) => ({ slug: r.slug, updatedAt: r.updated_at }));
});

export const getDevelopers = cache(async (): Promise<Array<{ name: string; count: number }>> => {
  if (isDemoMode()) {
    const map = new Map<string, number>();
    for (const g of demoPublished()) map.set(g.developer, (map.get(g.developer) ?? 0) + 1);
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }
  const db = getReadClient();
  if (!db) return [];
  const { data } = await db.from('games').select('developer').eq('status', 'published').limit(10000);
  const map = new Map<string, number>();
  for (const row of data ?? []) map.set((row as any).developer, (map.get((row as any).developer) ?? 0) + 1);
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
});

export const getCategoryCounts = cache(async (): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {};
  if (isDemoMode()) {
    for (const g of demoPublished()) counts[g.category] = (counts[g.category] ?? 0) + 1;
    return counts;
  }
  const db = getReadClient();
  if (!db) return counts;
  const { data } = await db.from('games').select('category').eq('status', 'published').limit(50000);
  for (const row of data ?? []) counts[(row as any).category] = (counts[(row as any).category] ?? 0) + 1;
  return counts;
});

export const getAllTags = cache(async (limit = 60): Promise<Array<{ tag: string; count: number }>> => {
  const map = new Map<string, number>();
  const source = isDemoMode() ? demoPublished() : (await listGames({ pageSize: 60, page: 1 })).items;
  for (const g of source) for (const t of g.tags) map.set(t, (map.get(t) ?? 0) + 1);
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
});

export const searchSuggestions = cache(async (term: string, limit = 8): Promise<GameRecord[]> => {
  if (!term.trim()) return [];
  const res = await listGames({ q: term, pageSize: limit, sort: 'popular' });
  return res.items;
});

/** Games in a given category, used by /category/[slug]. */
export const getGamesByCategory = cache(
  async (category: GameCategory, page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<Paginated<GameRecord>> =>
    listGames({ category, page, pageSize, sort: 'popular' }),
);
