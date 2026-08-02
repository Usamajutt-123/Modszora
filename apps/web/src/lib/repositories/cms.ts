import 'server-only';
import type {
  BlogPost,
  Game,
  GameRecord,
  MediaFolder,
  MediaItem,
  MediaQuery,
  Paginated,
  Review,
  Suggestion,
  Wallpaper,
} from '@modverse/shared';
import { MEDIA_FOLDERS } from '@modverse/shared';
import { getAdminClient } from '@/lib/supabase/server';
import { isDemoMode } from '@/lib/env';
import { gameToRow, rowToGame, rowToPost, rowToReview, rowToWallpaper } from '@/lib/mappers';
import { demoGames, demoPosts, demoReviews, demoWallpapers } from '@/data/fixtures.generated';

/**
 * CMS repository — admin-side reads and writes.
 *
 * Unlike the public repositories these include drafts and scheduled items,
 * and every write funnels through here so validation and cache invalidation
 * stay in one place.
 */

type Row = Record<string, any>;

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

/* ═══════════════════ row ⇄ model mappers (write side) ═══════════════════ */

export function wallpaperToRow(w: Partial<Wallpaper>): Row {
  const row: Row = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set('slug', w.slug);
  set('title', w.title);
  set('category', w.category);
  set('tags', w.tags);
  set('image', w.image);
  set('thumbnail', w.thumbnail);
  set('resolution', w.resolution);
  set('width', w.width);
  set('height', w.height);
  set('downloads', w.downloads);
  set('views', w.views);
  set('featured', w.featured);
  set('trending', w.trending);
  set('game_slug', w.gameSlug);
  set('source_url', w.sourceUrl);
  set('status', w.status);
  set('published_at', w.publishedAt);
  set('scheduled_for', w.scheduledFor);
  set('seo', w.seo);
  return row;
}

export function reviewToRow(r: Partial<Review>): Row {
  const row: Row = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set('slug', r.slug);
  set('title', r.title);
  set('game_slug', r.gameSlug);
  set('summary', r.summary);
  set('body', r.body);
  set('score', r.score);
  set('score_breakdown', r.scoreBreakdown);
  set('pros', r.pros);
  set('cons', r.cons);
  set('verdict', r.verdict);
  set('gameplay', r.gameplay);
  set('graphics', r.graphics);
  set('performance', r.performance);
  set('cover', r.cover);
  set('author', r.author);
  set('featured', r.featured);
  set('status', r.status);
  set('published_at', r.publishedAt);
  set('scheduled_for', r.scheduledFor);
  set('seo', r.seo);
  return row;
}

export function postToRow(p: Partial<BlogPost>): Row {
  const row: Row = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set('slug', p.slug);
  set('title', p.title);
  set('category', p.category);
  set('excerpt', p.excerpt);
  set('content', p.content);
  set('cover', p.cover);
  set('gallery', p.gallery);
  set('tags', p.tags);
  set('author', p.author);
  set('reading_minutes', p.readingMinutes);
  set('featured', p.featured);
  set('views', p.views);
  set('is_news', p.isNews);
  set('related_game_slug', p.relatedGameSlug);
  set('status', p.status);
  set('published_at', p.publishedAt);
  set('scheduled_for', p.scheduledFor);
  set('seo', p.seo);
  return row;
}

/* ═══════════════════ generic admin list ═══════════════════ */

export interface AdminListOptions {
  q?: string;
  status?: string;
  category?: string;
  featured?: boolean;
  page?: number;
  pageSize?: number;
  sort?: 'newest' | 'oldest' | 'title' | 'popular';
}

const SORT_COLUMN: Record<string, { column: string; ascending: boolean }> = {
  newest: { column: 'created_at', ascending: false },
  oldest: { column: 'created_at', ascending: true },
  title: { column: 'title', ascending: true },
  popular: { column: 'downloads', ascending: false },
};

/* ─────────────── wallpapers ─────────────── */

export async function adminListWallpapers(
  opts: AdminListOptions = {},
): Promise<Paginated<Wallpaper & { id: string; createdAt: string }>> {
  const { q, status, category, page = 1, pageSize = 24, sort = 'newest' } = opts;

  if (isDemoMode()) {
    let items = [...demoWallpapers];
    if (q) {
      const n = q.toLowerCase();
      items = items.filter((w) => w.title.toLowerCase().includes(n) || w.slug.includes(n));
    }
    if (status) items = items.filter((w) => w.status === status);
    if (category) items = items.filter((w) => w.category === category);
    return paginate(items, page, pageSize);
  }

  const db = getAdminClient();
  if (!db) return paginate([], page, pageSize);

  let query = db.from('wallpapers').select('*', { count: 'exact' });
  if (q) query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);
  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);

  const s = SORT_COLUMN[sort] ?? SORT_COLUMN.newest!;
  const col = sort === 'popular' ? 'downloads' : s.column;
  const from = (page - 1) * pageSize;

  const { data, count } = await query.order(col, { ascending: s.ascending }).range(from, from + pageSize - 1);
  const total = count ?? 0;
  return {
    items: (data ?? []).map(rowToWallpaper),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    hasMore: page * pageSize < total,
  };
}

export async function adminGetWallpaper(idOrSlug: string): Promise<(Wallpaper & { id: string }) | null> {
  if (isDemoMode()) {
    return demoWallpapers.find((w) => w.slug === idOrSlug || w.id === idOrSlug) ?? null;
  }
  const db = getAdminClient();
  if (!db) return null;
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
  const { data } = await db
    .from('wallpapers')
    .select('*')
    .eq(isUuid ? 'id' : 'slug', idOrSlug)
    .maybeSingle();
  return data ? rowToWallpaper(data) : null;
}

export async function adminUpsertWallpaper(
  wallpaper: Wallpaper,
  id?: string | null,
): Promise<{ ok: boolean; id?: string; slug?: string; error?: string }> {
  const db = getAdminClient();
  if (!db) return { ok: false, error: 'Database is not configured.' };

  const row = wallpaperToRow(wallpaper);

  if (id) {
    const { data, error } = await db.from('wallpapers').update(row).eq('id', id).select('id, slug').single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data.id, slug: data.slug };
  }

  const { data, error } = await db
    .from('wallpapers')
    .upsert(row, { onConflict: 'slug' })
    .select('id, slug')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id, slug: data.slug };
}

export async function adminDeleteWallpaper(id: string): Promise<boolean> {
  const db = getAdminClient();
  if (!db) return false;
  const { error } = await db.from('wallpapers').delete().eq('id', id);
  return !error;
}

/* ─────────────── reviews ─────────────── */

export async function adminListReviews(
  opts: AdminListOptions = {},
): Promise<Paginated<Review & { id: string }>> {
  const { q, status, page = 1, pageSize = 24, sort = 'newest' } = opts;

  if (isDemoMode()) {
    let items = [...demoReviews];
    if (q) {
      const n = q.toLowerCase();
      items = items.filter((r) => r.title.toLowerCase().includes(n));
    }
    if (status) items = items.filter((r) => r.status === status);
    return paginate(items, page, pageSize);
  }

  const db = getAdminClient();
  if (!db) return paginate([], page, pageSize);

  let query = db.from('reviews').select('*', { count: 'exact' });
  if (q) query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);
  if (status) query = query.eq('status', status);

  const s = SORT_COLUMN[sort] ?? SORT_COLUMN.newest!;
  const col = sort === 'popular' ? 'score' : s.column;
  const from = (page - 1) * pageSize;

  const { data, count } = await query.order(col, { ascending: s.ascending }).range(from, from + pageSize - 1);
  const total = count ?? 0;
  return {
    items: (data ?? []).map(rowToReview),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    hasMore: page * pageSize < total,
  };
}

export async function adminGetReview(idOrSlug: string): Promise<(Review & { id: string }) | null> {
  if (isDemoMode()) return demoReviews.find((r) => r.slug === idOrSlug || r.id === idOrSlug) ?? null;
  const db = getAdminClient();
  if (!db) return null;
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
  const { data } = await db
    .from('reviews')
    .select('*')
    .eq(isUuid ? 'id' : 'slug', idOrSlug)
    .maybeSingle();
  return data ? rowToReview(data) : null;
}

export async function adminUpsertReview(
  review: Review,
  id?: string | null,
): Promise<{ ok: boolean; id?: string; slug?: string; error?: string }> {
  const db = getAdminClient();
  if (!db) return { ok: false, error: 'Database is not configured.' };

  const row = reviewToRow(review);

  // Link to the game record when the slug resolves.
  if (review.gameSlug) {
    const { data: game } = await db.from('games').select('id').eq('slug', review.gameSlug).maybeSingle();
    if (game) row.game_id = game.id;
  }

  if (id) {
    const { data, error } = await db.from('reviews').update(row).eq('id', id).select('id, slug').single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data.id, slug: data.slug };
  }

  const { data, error } = await db.from('reviews').upsert(row, { onConflict: 'slug' }).select('id, slug').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id, slug: data.slug };
}

export async function adminDeleteReview(id: string): Promise<boolean> {
  const db = getAdminClient();
  if (!db) return false;
  const { error } = await db.from('reviews').delete().eq('id', id);
  return !error;
}

/* ─────────────── posts / news ─────────────── */

export async function adminListPosts(
  opts: AdminListOptions & { isNews?: boolean } = {},
): Promise<Paginated<BlogPost & { id: string }>> {
  const { q, status, category, isNews, page = 1, pageSize = 24, sort = 'newest' } = opts;

  if (isDemoMode()) {
    let items = [...demoPosts];
    if (q) {
      const n = q.toLowerCase();
      items = items.filter((p) => p.title.toLowerCase().includes(n));
    }
    if (status) items = items.filter((p) => p.status === status);
    if (category) items = items.filter((p) => p.category === category);
    if (isNews !== undefined) items = items.filter((p) => Boolean((p as any).isNews) === isNews);
    return paginate(items, page, pageSize);
  }

  const db = getAdminClient();
  if (!db) return paginate([], page, pageSize);

  let query = db.from('posts').select('*', { count: 'exact' });
  if (q) query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);
  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);
  if (isNews !== undefined) query = query.eq('is_news', isNews);

  const s = SORT_COLUMN[sort] ?? SORT_COLUMN.newest!;
  const col = sort === 'popular' ? 'views' : s.column;
  const from = (page - 1) * pageSize;

  const { data, count } = await query.order(col, { ascending: s.ascending }).range(from, from + pageSize - 1);
  const total = count ?? 0;
  return {
    items: (data ?? []).map(rowToPost),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    hasMore: page * pageSize < total,
  };
}

export async function adminGetPost(idOrSlug: string): Promise<(BlogPost & { id: string }) | null> {
  if (isDemoMode()) return demoPosts.find((p) => p.slug === idOrSlug || p.id === idOrSlug) ?? null;
  const db = getAdminClient();
  if (!db) return null;
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
  const { data } = await db
    .from('posts')
    .select('*')
    .eq(isUuid ? 'id' : 'slug', idOrSlug)
    .maybeSingle();
  return data ? rowToPost(data) : null;
}

export async function adminUpsertPost(
  post: BlogPost,
  id?: string | null,
): Promise<{ ok: boolean; id?: string; slug?: string; error?: string }> {
  const db = getAdminClient();
  if (!db) return { ok: false, error: 'Database is not configured.' };

  const row = postToRow(post);

  if (id) {
    const { data, error } = await db.from('posts').update(row).eq('id', id).select('id, slug').single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data.id, slug: data.slug };
  }

  const { data, error } = await db.from('posts').upsert(row, { onConflict: 'slug' }).select('id, slug').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id, slug: data.slug };
}

export async function adminDeletePost(id: string): Promise<boolean> {
  const db = getAdminClient();
  if (!db) return false;
  const { error } = await db.from('posts').delete().eq('id', id);
  return !error;
}

/* ═══════════════════ media library ═══════════════════ */

/** Infers the logical folder from a storage path. */
export function folderFromPath(path: string): MediaFolder {
  if (path.startsWith('wallpapers/')) return 'wallpapers';
  if (/\/icon[.-]/.test(path) || path.includes('/icons/')) return 'icons';
  if (/\/banner[.-]/.test(path) || path.includes('/banners/')) return 'banners';
  if (/screenshot/.test(path)) return 'screenshots';
  if (/\/(cover|og)[.-]/.test(path) || path.includes('/covers/')) return 'covers';
  return 'uploads';
}

/**
 * Media library listing.
 *
 * Reads from `media_assets`, which is the index of everything uploaded. In
 * demo mode it synthesises the index from the fixture content so the library
 * is explorable without storage configured.
 */
export async function listMedia(query: Partial<MediaQuery> = {}): Promise<Paginated<MediaItem>> {
  const { q, folder, page = 1, pageSize = 40, sort = 'newest' } = query;

  if (isDemoMode()) {
    const items: MediaItem[] = [];
    const push = (url: string, name: string, f: MediaFolder, owner: string, bytes = 60_000, w = 512, h = 512, at = new Date().toISOString()) =>
      items.push({
        id: `${f}-${items.length}`,
        path: `${f}/${owner}/${name}`,
        name,
        url,
        folder: f,
        bytes,
        width: w,
        height: h,
        mimeType: 'image/webp',
        createdAt: at,
        ownerSlug: owner,
      });

    for (const g of demoGames) {
      if (g.icon?.url) push(g.icon.url, `${g.slug}-icon.webp`, 'icons', g.slug, g.icon.bytes ?? 0, g.icon.width ?? 512, g.icon.height ?? 512, g.createdAt);
      if (g.banner?.url) push(g.banner.url, `${g.slug}-banner.webp`, 'banners', g.slug, g.banner.bytes ?? 0, g.banner.width ?? 1280, g.banner.height ?? 720, g.createdAt);
      g.screenshots.forEach((s, i) =>
        push(s.url, `${g.slug}-shot-${i + 1}.webp`, 'screenshots', g.slug, s.bytes ?? 0, s.width ?? 1080, s.height ?? 1920, g.createdAt),
      );
    }
    for (const w of demoWallpapers) {
      if (w.image?.url) push(w.image.url, `${w.slug}.webp`, 'wallpapers', w.slug, w.image.bytes ?? 0, w.image.width ?? 1920, w.image.height ?? 1080, w.createdAt);
    }
    for (const p of demoPosts) {
      if (p.cover?.url) push(p.cover.url, `${p.slug}-cover.webp`, 'covers', p.slug, p.cover.bytes ?? 0, 1280, 720);
    }

    let filtered = items;
    if (folder) filtered = filtered.filter((i) => i.folder === folder);
    if (q) {
      const n = q.toLowerCase();
      filtered = filtered.filter((i) => i.name.toLowerCase().includes(n) || (i.ownerSlug ?? '').includes(n));
    }
    filtered = sortMedia(filtered, sort);
    return paginate(filtered, page, pageSize);
  }

  const db = getAdminClient();
  if (!db) return paginate([], page, pageSize);

  let builder = db.from('media_assets').select('*', { count: 'exact' });
  if (folder) builder = builder.eq('folder', folder);
  if (q) builder = builder.or(`name.ilike.%${q}%,owner_slug.ilike.%${q}%`);

  const order: Record<string, { column: string; ascending: boolean }> = {
    newest: { column: 'created_at', ascending: false },
    oldest: { column: 'created_at', ascending: true },
    largest: { column: 'bytes', ascending: false },
    name: { column: 'name', ascending: true },
  };
  const o = order[sort] ?? order.newest!;
  const from = (page - 1) * pageSize;

  const { data, count } = await builder.order(o.column, { ascending: o.ascending }).range(from, from + pageSize - 1);
  const total = count ?? 0;

  return {
    items: ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      path: r.path,
      name: r.name,
      url: r.url,
      folder: (MEDIA_FOLDERS as readonly string[]).includes(r.folder) ? r.folder : 'uploads',
      bytes: Number(r.bytes ?? 0),
      width: r.width,
      height: r.height,
      mimeType: r.mime_type ?? 'image/webp',
      createdAt: r.created_at,
      ownerSlug: r.owner_slug,
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    hasMore: page * pageSize < total,
  };
}

function sortMedia(items: MediaItem[], sort: string): MediaItem[] {
  const arr = [...items];
  switch (sort) {
    case 'oldest':
      return arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case 'largest':
      return arr.sort((a, b) => b.bytes - a.bytes);
    case 'name':
      return arr.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export async function mediaFolderCounts(): Promise<Record<string, { count: number; bytes: number }>> {
  const out: Record<string, { count: number; bytes: number }> = {};
  for (const f of MEDIA_FOLDERS) out[f] = { count: 0, bytes: 0 };

  if (isDemoMode()) {
    const all = await listMedia({ pageSize: 100, page: 1 });
    // Demo dataset is small; fetch everything for accurate counts.
    const full = await listMedia({ pageSize: 100, page: 2 });
    for (const item of [...all.items, ...full.items]) {
      const bucket = out[item.folder];
      if (bucket) {
        bucket.count += 1;
        bucket.bytes += item.bytes;
      }
    }
    return out;
  }

  const db = getAdminClient();
  if (!db) return out;

  const { data } = await db.from('media_assets').select('folder, bytes').limit(10000);
  for (const r of (data ?? []) as Row[]) {
    const bucket = out[r.folder] ?? out.uploads!;
    bucket.count += 1;
    bucket.bytes += Number(r.bytes ?? 0);
  }
  return out;
}

export async function deleteMedia(id: string): Promise<{ ok: boolean; error?: string }> {
  const db = getAdminClient();
  if (!db) return { ok: false, error: 'Database is not configured.' };

  const { data: asset } = await db.from('media_assets').select('path').eq('id', id).maybeSingle();
  if (!asset) return { ok: false, error: 'Asset not found.' };

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'modverse';
  const { error: storageError } = await db.storage.from(bucket).remove([asset.path]);
  // A missing storage object should not block removing the index row.
  if (storageError) console.warn('[media.delete] storage:', storageError.message);

  const { error } = await db.from('media_assets').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Records an uploaded object in the media index. */
export async function indexMedia(input: {
  path: string;
  name: string;
  url: string;
  bytes: number;
  width?: number | null;
  height?: number | null;
  mimeType?: string;
  ownerSlug?: string | null;
  ownerKind?: string | null;
}): Promise<boolean> {
  const db = getAdminClient();
  if (!db) return false;
  const { error } = await db.from('media_assets').upsert(
    {
      path: input.path,
      name: input.name,
      url: input.url,
      folder: folderFromPath(input.path),
      bytes: input.bytes,
      width: input.width ?? null,
      height: input.height ?? null,
      mime_type: input.mimeType ?? 'image/webp',
      owner_slug: input.ownerSlug ?? null,
      owner_kind: input.ownerKind ?? null,
    },
    { onConflict: 'path' },
  );
  return !error;
}

/* ═══════════════════ suggestions ═══════════════════ */

export async function listSuggestions(limit = 100): Promise<Suggestion[]> {
  if (isDemoMode()) return demoSuggestions();

  const db = getAdminClient();
  if (!db) return [];

  const { data } = await db
    .from('suggestions')
    .select('*')
    .eq('status', 'new')
    .order('score', { ascending: false })
    .limit(limit);

  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    detail: r.detail,
    score: Number(r.score),
    severity: r.severity,
    actionHref: r.action_href,
    actionLabel: r.action_label,
    entitySlug: r.entity_slug,
    meta: r.meta ?? {},
    status: r.status,
    createdAt: r.created_at,
  }));
}

/**
 * Demo-mode suggestions computed from the fixture data.
 * These are real findings against the demo catalogue, not hard-coded strings,
 * so the panel demonstrates genuine behaviour.
 */
function demoSuggestions(): Suggestion[] {
  const out: Suggestion[] = [];
  const now = new Date().toISOString();

  const reviewed = new Set(demoReviews.map((r) => r.gameSlug));
  const wallpapered = new Set(demoWallpapers.map((w) => (w as any).gameSlug).filter(Boolean));

  for (const g of [...demoGames].sort((a, b) => b.downloads - a.downloads).slice(0, 6)) {
    if (!reviewed.has(g.slug)) {
      out.push({
        id: `demo-review-${g.slug}`,
        kind: 'trending-blog',
        title: `Write a review for ${g.name}`,
        detail: `${g.downloads.toLocaleString()} downloads and no review yet. Review pages capture "is X worth it" searches that listings do not.`,
        score: 78,
        severity: 'info',
        actionHref: `/admin/reviews/new?game=${g.slug}`,
        actionLabel: 'Generate review',
        entitySlug: g.slug,
        meta: { downloads: g.downloads },
        status: 'new',
        createdAt: now,
      });
    }
    if (!wallpapered.has(g.slug) && g.screenshots.length >= 2) {
      out.push({
        id: `demo-wp-${g.slug}`,
        kind: 'trending-wallpaper',
        title: `Generate wallpapers from ${g.name}`,
        detail: `${g.screenshots.length} screenshots available and no wallpapers yet. The generator produces phone and desktop variants automatically.`,
        score: 62,
        severity: 'info',
        actionHref: `/admin/wallpapers/new?game=${g.slug}`,
        actionLabel: 'Generate',
        entitySlug: g.slug,
        meta: { screenshots: g.screenshots.length },
        status: 'new',
        createdAt: now,
      });
    }
  }

  for (const g of demoGames) {
    if (g.screenshots.length < 3) {
      out.push({
        id: `demo-shots-${g.slug}`,
        kind: 'missing-screenshots',
        title: g.name,
        detail: `Only ${g.screenshots.length} screenshot(s). Listings with three or more convert noticeably better.`,
        score: 72,
        severity: 'warn',
        actionHref: `/admin/games/edit/${g.slug}`,
        actionLabel: 'Fix media',
        entitySlug: g.slug,
        meta: {},
        status: 'new',
        createdAt: now,
      });
    }
  }

  const stale = [...demoGames]
    .filter((g) => g.updatedDate && Date.now() - new Date(g.updatedDate).getTime() > 45 * 86_400_000)
    .slice(0, 4);
  for (const g of stale) {
    const days = Math.floor((Date.now() - new Date(g.updatedDate!).getTime()) / 86_400_000);
    out.push({
      id: `demo-stale-${g.slug}`,
      kind: 'game-update',
      title: `${g.name} has not been refreshed in ${days} days`,
      detail: `Currently on v${g.version}. Re-run the agent against its source to pick up a newer build and changelog.`,
      score: Math.min(95, 40 + days),
      severity: 'warn',
      actionHref: `/admin/agent`,
      actionLabel: 'Re-ingest',
      entitySlug: g.slug,
      meta: { version: g.version, daysStale: days },
      status: 'new',
      createdAt: now,
    });
  }

  const year = new Date().getFullYear();
  for (const kw of [
    { k: `how to install mod apk on android ${year}`, d: 18, o: 88 },
    { k: 'mod apk not installing fix', d: 22, o: 84 },
    { k: 'is mod apk safe for android', d: 26, o: 80 },
  ]) {
    out.push({
      id: `demo-kw-${kw.k.replace(/\s+/g, '-')}`,
      kind: 'low-competition-keyword',
      title: kw.k,
      detail: `Long-tail phrasing with clear intent. Difficulty ${kw.d}/100, opportunity ${kw.o}/100 — realistic to rank for.`,
      score: kw.o,
      severity: 'info',
      actionHref: `/admin/blog/new?topic=${encodeURIComponent(kw.k)}`,
      actionLabel: 'Write about it',
      entitySlug: null,
      meta: { difficulty: kw.d, opportunity: kw.o },
      status: 'new',
      createdAt: now,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

export async function setSuggestionStatus(id: string, status: 'accepted' | 'dismissed'): Promise<boolean> {
  const db = getAdminClient();
  if (!db) return false;
  const { error } = await db.from('suggestions').update({ status }).eq('id', id);
  return !error;
}

/* ═══════════════════ dashboard totals ═══════════════════ */

export interface CmsTotals {
  games: number;
  gamesPublished: number;
  gamesDraft: number;
  gamesScheduled: number;
  wallpapers: number;
  wallpapersPublished: number;
  reviews: number;
  reviewsPublished: number;
  posts: number;
  news: number;
  postsPublished: number;
  comments: number;
  commentsPending: number;
  mediaAssets: number;
  mediaBytes: number;
  suggestionsNew: number;
  totalDownloads: number;
  totalViews: number;
}

export async function getCmsTotals(): Promise<CmsTotals> {
  if (isDemoMode()) {
    const mediaBytes = demoGames.reduce(
      (s, g) =>
        s + (g.icon?.bytes ?? 0) + (g.banner?.bytes ?? 0) + g.screenshots.reduce((a, x) => a + (x.bytes ?? 0), 0),
      0,
    );
    const mediaAssets = demoGames.reduce((s, g) => s + (g.icon ? 1 : 0) + (g.banner ? 1 : 0) + g.screenshots.length, 0);
    return {
      games: demoGames.length,
      gamesPublished: demoGames.filter((g) => g.status === 'published').length,
      gamesDraft: demoGames.filter((g) => g.status === 'draft').length,
      gamesScheduled: demoGames.filter((g) => g.status === 'scheduled').length,
      wallpapers: demoWallpapers.length,
      wallpapersPublished: demoWallpapers.filter((w) => w.status === 'published').length,
      reviews: demoReviews.length,
      reviewsPublished: demoReviews.filter((r) => r.status === 'published').length,
      posts: demoPosts.filter((p) => !(p as any).isNews).length,
      news: demoPosts.filter((p) => (p as any).isNews).length,
      postsPublished: demoPosts.filter((p) => p.status === 'published').length,
      comments: 0,
      commentsPending: 0,
      mediaAssets: mediaAssets + demoWallpapers.length,
      mediaBytes: mediaBytes + demoWallpapers.reduce((s, w) => s + (w.image?.bytes ?? 0), 0),
      suggestionsNew: demoSuggestions().length,
      totalDownloads: demoGames.reduce((s, g) => s + g.downloads, 0),
      totalViews: demoGames.reduce((s, g) => s + g.views, 0),
    };
  }

  const db = getAdminClient();
  const empty: CmsTotals = {
    games: 0, gamesPublished: 0, gamesDraft: 0, gamesScheduled: 0,
    wallpapers: 0, wallpapersPublished: 0, reviews: 0, reviewsPublished: 0,
    posts: 0, news: 0, postsPublished: 0, comments: 0, commentsPending: 0,
    mediaAssets: 0, mediaBytes: 0, suggestionsNew: 0, totalDownloads: 0, totalViews: 0,
  };
  if (!db) return empty;

  const { data, error } = await db.rpc('cms_totals');
  if (error || !data) {
    console.error('[cms.getCmsTotals]', error?.message);
    return empty;
  }
  return { ...empty, ...(data as Partial<CmsTotals>) };
}

/** Daily view/download series for the dashboard chart. */
export async function getTrafficSeries(days = 14): Promise<Array<{ date: string; views: number; downloads: number }>> {
  const out: Array<{ date: string; views: number; downloads: number }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isDemoMode()) {
    // Deterministic pseudo-series so the chart is stable across reloads.
    const seedOf = (s: string) => {
      let h = 2166136261;
      for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return ((h >>> 0) % 1000) / 1000;
    };
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(today.getTime() - i * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      const r = seedOf(key);
      const weekend = [0, 6].includes(d.getDay()) ? 1.25 : 1;
      out.push({
        date: key,
        views: Math.round((3200 + r * 2600) * weekend),
        downloads: Math.round((900 + r * 1100) * weekend),
      });
    }
    return out;
  }

  const db = getAdminClient();
  if (!db) return out;

  const since = new Date(today.getTime() - (days - 1) * 86_400_000).toISOString();
  const { data } = await db
    .from('analytics_events')
    .select('kind, created_at')
    .in('kind', ['view', 'download'])
    .gte('created_at', since)
    .limit(100_000);

  const buckets = new Map<string, { views: number; downloads: number }>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = new Date(today.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    buckets.set(key, { views: 0, downloads: 0 });
  }
  for (const row of (data ?? []) as Row[]) {
    const key = String(row.created_at).slice(0, 10);
    const b = buckets.get(key);
    if (!b) continue;
    if (row.kind === 'view') b.views += 1;
    else b.downloads += 1;
  }
  for (const [date, v] of buckets) out.push({ date, ...v });
  return out;
}

/* ═══════════════════ games (manual CRUD) ═══════════════════ */
//
// Additive: the agent continues to publish through /api/agent/publish
// unchanged. These functions give the admin panel a manual path that writes
// the *same* rows via the existing `gameToRow` mapper, so a hand-made listing
// and an agent-made listing are structurally identical.

export async function adminGetGame(idOrSlug: string): Promise<GameRecord | null> {
  if (isDemoMode()) {
    return demoGames.find((g) => g.slug === idOrSlug || g.id === idOrSlug) ?? null;
  }
  const db = getAdminClient();
  if (!db) return null;

  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
  const { data } = await db
    .from('games')
    .select('*')
    .eq(isUuid ? 'id' : 'slug', idOrSlug)
    .maybeSingle();
  return data ? rowToGame(data) : null;
}

export async function adminUpsertGame(
  game: Game,
  id?: string | null,
): Promise<{ ok: boolean; id?: string; slug?: string; error?: string }> {
  const db = getAdminClient();
  if (!db) return { ok: false, error: 'Database is not configured.' };

  const row = gameToRow(game as Partial<GameRecord>);

  if (id) {
    // Never reset traffic counters from an edit form.
    delete row.downloads;
    delete row.views;
    delete row.rating_count;

    const { data, error } = await db.from('games').update(row).eq('id', id).select('id, slug').single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data.id, slug: data.slug };
  }

  const { data, error } = await db.from('games').insert(row).select('id, slug').single();
  if (error) {
    // `games_package_unique` — surface a useful message rather than a raw code.
    if (error.code === '23505') {
      return {
        ok: false,
        error: `A listing with package name "${game.packageName}" already exists. Edit that listing instead.`,
      };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id, slug: data.slug };
}

export async function adminDeleteGame(id: string): Promise<boolean> {
  const db = getAdminClient();
  if (!db) return false;
  const { error } = await db.from('games').delete().eq('id', id);
  return !error;
}
