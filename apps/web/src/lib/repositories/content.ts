import 'server-only';
import { cache } from 'react';
import type { BlogPost, Paginated, Review, Wallpaper } from '@modverse/shared';
import { getReadClient } from '@/lib/supabase/server';
import { isDemoMode } from '@/lib/env';
import { rowToPost, rowToReview, rowToWallpaper } from '@/lib/mappers';
import { demoPosts, demoReviews, demoWallpapers } from '@/data/fixtures.generated';

type WallpaperRecord = Wallpaper & { id: string; createdAt: string };
type ReviewRecord = Review & { id: string };
type PostRecord = BlogPost & { id: string };

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

/* ═══════════════════════ wallpapers ═══════════════════════ */

export const listWallpapers = cache(
  async (opts: { category?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<WallpaperRecord>> => {
    const { category, page = 1, pageSize = 24 } = opts;

    if (isDemoMode()) {
      let items = demoWallpapers.filter((w) => w.status === 'published');
      if (category) items = items.filter((w) => w.category === category);
      return paginate(items, page, pageSize);
    }

    const db = getReadClient();
    if (!db) return paginate([], page, pageSize);
    let builder = db.from('wallpapers').select('*', { count: 'exact' }).eq('status', 'published');
    if (category) builder = builder.eq('category', category);
    const from = (page - 1) * pageSize;
    const { data, count } = await builder.order('created_at', { ascending: false }).range(from, from + pageSize - 1);
    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items: (data ?? []).map(rowToWallpaper),
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages,
    };
  },
);

export const getWallpaperBySlug = cache(async (slug: string): Promise<WallpaperRecord | null> => {
  if (isDemoMode()) return demoWallpapers.find((w) => w.slug === slug) ?? null;
  const db = getReadClient();
  if (!db) return null;
  const { data } = await db.from('wallpapers').select('*').eq('slug', slug).maybeSingle();
  return data ? rowToWallpaper(data) : null;
});

export const getWallpaperCategories = cache(async (): Promise<Array<{ category: string; count: number }>> => {
  const source = isDemoMode() ? demoWallpapers : (await listWallpapers({ pageSize: 200 })).items;
  const map = new Map<string, number>();
  for (const w of source) map.set(w.category, (map.get(w.category) ?? 0) + 1);
  return [...map.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
});

export const getAllWallpaperSlugs = cache(async (): Promise<string[]> => {
  if (isDemoMode()) return demoWallpapers.map((w) => w.slug);
  const db = getReadClient();
  if (!db) return [];
  const { data } = await db.from('wallpapers').select('slug').eq('status', 'published').limit(5000);
  return (data ?? []).map((r: any) => r.slug);
});

/* ═══════════════════════ reviews ═══════════════════════ */

export const listReviews = cache(
  async (opts: { page?: number; pageSize?: number } = {}): Promise<Paginated<ReviewRecord>> => {
    const { page = 1, pageSize = 12 } = opts;
    if (isDemoMode()) {
      const items = [...demoReviews]
        .filter((r) => r.status === 'published')
        .sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime());
      return paginate(items, page, pageSize);
    }
    const db = getReadClient();
    if (!db) return paginate([], page, pageSize);
    const from = (page - 1) * pageSize;
    const { data, count } = await db
      .from('reviews')
      .select('*', { count: 'exact' })
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .range(from, from + pageSize - 1);
    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return { items: (data ?? []).map(rowToReview), page, pageSize, total, totalPages, hasMore: page < totalPages };
  },
);

export const getReviewBySlug = cache(async (slug: string): Promise<ReviewRecord | null> => {
  if (isDemoMode()) return demoReviews.find((r) => r.slug === slug) ?? null;
  const db = getReadClient();
  if (!db) return null;
  const { data } = await db.from('reviews').select('*').eq('slug', slug).maybeSingle();
  return data ? rowToReview(data) : null;
});

export const getReviewForGame = cache(async (gameSlug: string): Promise<ReviewRecord | null> => {
  if (isDemoMode()) return demoReviews.find((r) => r.gameSlug === gameSlug) ?? null;
  const db = getReadClient();
  if (!db) return null;
  const { data } = await db
    .from('reviews')
    .select('*')
    .eq('game_slug', gameSlug)
    .eq('status', 'published')
    .maybeSingle();
  return data ? rowToReview(data) : null;
});

export const getAllReviewSlugs = cache(async (): Promise<string[]> => {
  if (isDemoMode()) return demoReviews.map((r) => r.slug);
  const db = getReadClient();
  if (!db) return [];
  const { data } = await db.from('reviews').select('slug').eq('status', 'published').limit(5000);
  return (data ?? []).map((r: any) => r.slug);
});

/* ═══════════════════════ blog ═══════════════════════ */

export const listPosts = cache(
  async (opts: { category?: string; tag?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<PostRecord>> => {
    const { category, tag, page = 1, pageSize = 12 } = opts;

    if (isDemoMode()) {
      let items = demoPosts.filter((p) => p.status === 'published');
      if (category) items = items.filter((p) => p.category === category);
      if (tag) items = items.filter((p) => p.tags.includes(tag));
      items.sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime());
      return paginate(items, page, pageSize);
    }

    const db = getReadClient();
    if (!db) return paginate([], page, pageSize);
    let builder = db.from('posts').select('*', { count: 'exact' }).eq('status', 'published');
    if (category) builder = builder.eq('category', category);
    if (tag) builder = builder.contains('tags', [tag]);
    const from = (page - 1) * pageSize;
    const { data, count } = await builder.order('published_at', { ascending: false }).range(from, from + pageSize - 1);
    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return { items: (data ?? []).map(rowToPost), page, pageSize, total, totalPages, hasMore: page < totalPages };
  },
);

export const getPostBySlug = cache(async (slug: string): Promise<PostRecord | null> => {
  if (isDemoMode()) return demoPosts.find((p) => p.slug === slug) ?? null;
  const db = getReadClient();
  if (!db) return null;
  const { data } = await db.from('posts').select('*').eq('slug', slug).maybeSingle();
  return data ? rowToPost(data) : null;
});

export const getPostCategories = cache(async (): Promise<Array<{ category: string; count: number }>> => {
  const source = isDemoMode() ? demoPosts : (await listPosts({ pageSize: 200 })).items;
  const map = new Map<string, number>();
  for (const p of source) map.set(p.category, (map.get(p.category) ?? 0) + 1);
  return [...map.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
});

export const getAllPostSlugs = cache(async (): Promise<string[]> => {
  if (isDemoMode()) return demoPosts.map((p) => p.slug);
  const db = getReadClient();
  if (!db) return [];
  const { data } = await db.from('posts').select('slug').eq('status', 'published').limit(5000);
  return (data ?? []).map((r: any) => r.slug);
});

/* ═══════════════════════ comments ═══════════════════════ */

export interface CommentRecord {
  id: string;
  gameSlug: string;
  author: string;
  body: string;
  rating: number | null;
  createdAt: string;
}

export const getComments = cache(async (gameSlug: string, limit = 50): Promise<CommentRecord[]> => {
  if (isDemoMode()) return [];
  const db = getReadClient();
  if (!db) return [];
  const { data } = await db
    .from('comments')
    .select('id, game_slug, author, body, rating, created_at')
    .eq('game_slug', gameSlug)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    gameSlug: r.game_slug,
    author: r.author,
    body: r.body,
    rating: r.rating,
    createdAt: r.created_at,
  }));
});
