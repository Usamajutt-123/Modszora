import 'server-only';
import type { DashboardStats, PublishStatus } from '@modverse/shared';
import { getAdminClient } from '@/lib/supabase/server';
import { isDemoMode } from '@/lib/env';
import { demoGames, demoPosts, demoReviews, demoWallpapers } from '@/data/fixtures.generated';

/** Zero-value stats so the dashboard always renders, even with no DB. */
function emptyStats(): DashboardStats {
  return {
    totals: { games: 0, published: 0, drafts: 0, scheduled: 0, wallpapers: 0, reviews: 0, posts: 0, comments: 0, pendingComments: 0 },
    traffic: { views: 0, downloads: 0, viewsTrend: 0, downloadsTrend: 0 },
    storage: { usedBytes: 0, limitBytes: 1024 ** 3, objectCount: 0 },
    agent: { online: false, running: 0, queued: 0, completed24h: 0, failed24h: 0, lastRunAt: null, nextRunAt: null },
    seo: { indexedPages: 0, missingMeta: 0, avgTitleLength: 0, brokenLinks: 0 },
    topGames: [],
    recentUploads: [],
    errors: [],
  };
}

function demoStats(): DashboardStats {
  const published = demoGames.filter((g) => g.status === 'published');
  const views = demoGames.reduce((s, g) => s + g.views, 0);
  const downloads = demoGames.reduce((s, g) => s + g.downloads, 0);
  const storageBytes = demoGames.reduce(
    (s, g) =>
      s +
      (g.icon?.bytes ?? 0) +
      (g.banner?.bytes ?? 0) +
      g.screenshots.reduce((a, sc) => a + (sc.bytes ?? 0), 0),
    0,
  );

  const withSeo = demoGames.filter((g) => g.seo?.title);
  const avgTitleLength = withSeo.length
    ? Math.round(withSeo.reduce((s, g) => s + g.seo.title.length, 0) / withSeo.length)
    : 0;

  return {
    totals: {
      games: demoGames.length,
      published: published.length,
      drafts: demoGames.filter((g) => g.status === 'draft').length,
      scheduled: demoGames.filter((g) => g.status === 'scheduled').length,
      wallpapers: demoWallpapers.length,
      reviews: demoReviews.length,
      posts: demoPosts.length,
      comments: 0,
      pendingComments: 0,
    },
    traffic: { views, downloads, viewsTrend: 12.4, downloadsTrend: 8.1 },
    storage: { usedBytes: storageBytes, limitBytes: 1024 ** 3, objectCount: demoGames.length * 7 },
    agent: { online: false, running: 0, queued: 0, completed24h: 0, failed24h: 0, lastRunAt: null, nextRunAt: null },
    seo: {
      indexedPages: published.length * 2 + demoPosts.length + demoReviews.length + demoWallpapers.length,
      missingMeta: demoGames.filter((g) => !g.seo?.description).length,
      avgTitleLength,
      brokenLinks: 0,
    },
    topGames: [...published]
      .sort((a, b) => b.views - a.views)
      .slice(0, 6)
      .map((g) => ({ slug: g.slug, name: g.name, views: g.views, downloads: g.downloads, icon: g.icon?.url ?? null })),
    recentUploads: [...demoGames]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6)
      .map((g) => ({ slug: g.slug, name: g.name, createdAt: g.createdAt, status: g.status as PublishStatus })),
    errors: [],
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  if (isDemoMode()) return demoStats();

  const db = getAdminClient();
  if (!db) return emptyStats();

  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 172_800_000).toISOString();

  const count = (table: string, filters: Record<string, unknown> = {}) => {
    let q = db.from(table).select('*', { count: 'exact', head: true });
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    return q;
  };

  const [
    gamesTotal,
    gamesPublished,
    gamesDraft,
    gamesScheduled,
    wallpapersTotal,
    reviewsTotal,
    postsTotal,
    commentsTotal,
    commentsPending,
    topGamesRes,
    recentRes,
    errorsRes,
    jobsRunning,
    jobsQueued,
    jobsDone24,
    jobsFailed24,
    storageRes,
    views24,
    views48,
    downloads24,
    downloads48,
    seoSample,
  ] = await Promise.all([
    count('games'),
    count('games', { status: 'published' }),
    count('games', { status: 'draft' }),
    count('games', { status: 'scheduled' }),
    count('wallpapers'),
    count('reviews'),
    count('posts'),
    count('comments'),
    count('comments', { status: 'pending' }),
    db.from('games').select('slug, name, views, downloads, icon').eq('status', 'published').order('views', { ascending: false }).limit(6),
    db.from('games').select('slug, name, created_at, status').order('created_at', { ascending: false }).limit(6),
    db.from('agent_logs').select('id, message, scope, created_at').eq('level', 'error').order('created_at', { ascending: false }).limit(5),
    count('agent_jobs', { status: 'running' }),
    count('agent_jobs', { status: 'queued' }),
    db.from('agent_jobs').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('finished_at', dayAgo),
    db.from('agent_jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed').gte('finished_at', dayAgo),
    db.from('storage_usage').select('*').maybeSingle(),
    db.from('analytics_events').select('*', { count: 'exact', head: true }).eq('kind', 'view').gte('created_at', dayAgo),
    db.from('analytics_events').select('*', { count: 'exact', head: true }).eq('kind', 'view').gte('created_at', twoDaysAgo).lt('created_at', dayAgo),
    db.from('analytics_events').select('*', { count: 'exact', head: true }).eq('kind', 'download').gte('created_at', dayAgo),
    db.from('analytics_events').select('*', { count: 'exact', head: true }).eq('kind', 'download').gte('created_at', twoDaysAgo).lt('created_at', dayAgo),
    db.from('games').select('seo').eq('status', 'published').limit(500),
  ]);

  const trend = (now: number, prev: number) => (prev > 0 ? Number((((now - prev) / prev) * 100).toFixed(1)) : now > 0 ? 100 : 0);

  const seoRows = (seoSample.data ?? []) as Array<{ seo: { title?: string; description?: string } | null }>;
  const titles = seoRows.map((r) => r.seo?.title).filter((t): t is string => Boolean(t));
  const avgTitleLength = titles.length ? Math.round(titles.reduce((s, t) => s + t.length, 0) / titles.length) : 0;

  const published = gamesPublished.count ?? 0;

  return {
    totals: {
      games: gamesTotal.count ?? 0,
      published,
      drafts: gamesDraft.count ?? 0,
      scheduled: gamesScheduled.count ?? 0,
      wallpapers: wallpapersTotal.count ?? 0,
      reviews: reviewsTotal.count ?? 0,
      posts: postsTotal.count ?? 0,
      comments: commentsTotal.count ?? 0,
      pendingComments: commentsPending.count ?? 0,
    },
    traffic: {
      views: views24.count ?? 0,
      downloads: downloads24.count ?? 0,
      viewsTrend: trend(views24.count ?? 0, views48.count ?? 0),
      downloadsTrend: trend(downloads24.count ?? 0, downloads48.count ?? 0),
    },
    storage: {
      usedBytes: Number((storageRes.data as any)?.used_bytes ?? 0),
      limitBytes: 1024 ** 3,
      objectCount: Number((storageRes.data as any)?.object_count ?? 0),
    },
    agent: {
      online: false, // resolved client-side by pinging the agent
      running: jobsRunning.count ?? 0,
      queued: jobsQueued.count ?? 0,
      completed24h: jobsDone24.count ?? 0,
      failed24h: jobsFailed24.count ?? 0,
      lastRunAt: null,
      nextRunAt: null,
    },
    seo: {
      indexedPages: published * 2,
      missingMeta: seoRows.filter((r) => !r.seo?.description).length,
      avgTitleLength,
      brokenLinks: 0,
    },
    topGames: (topGamesRes.data ?? []).map((g: any) => ({
      slug: g.slug,
      name: g.name,
      views: Number(g.views ?? 0),
      downloads: Number(g.downloads ?? 0),
      icon: g.icon?.url ?? null,
    })),
    recentUploads: (recentRes.data ?? []).map((g: any) => ({
      slug: g.slug,
      name: g.name,
      createdAt: g.created_at,
      status: g.status,
    })),
    errors: (errorsRes.data ?? []).map((e: any) => ({
      id: e.id,
      message: e.message,
      scope: e.scope,
      createdAt: e.created_at,
    })),
  };
}

/** Admin game list — includes drafts and scheduled items. */
export async function listAdminGames(opts: { q?: string; status?: string; page?: number; pageSize?: number } = {}) {
  const { q, status, page = 1, pageSize = 20 } = opts;

  if (isDemoMode()) {
    let items = [...demoGames];
    if (q) {
      const n = q.toLowerCase();
      items = items.filter((g) => g.name.toLowerCase().includes(n) || g.packageName.toLowerCase().includes(n));
    }
    if (status) items = items.filter((g) => g.status === status);
    const total = items.length;
    const start = (page - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  const db = getAdminClient();
  if (!db) return { items: [], total: 0, page, pageSize, totalPages: 1 };

  let query = db.from('games').select('*', { count: 'exact' });
  if (q) query = query.or(`name.ilike.%${q}%,package_name.ilike.%${q}%,developer.ilike.%${q}%`);
  if (status) query = query.eq('status', status);

  const from = (page - 1) * pageSize;
  const { data, count } = await query.order('created_at', { ascending: false }).range(from, from + pageSize - 1);

  const { rowToGame } = await import('@/lib/mappers');
  const total = count ?? 0;
  return {
    items: (data ?? []).map(rowToGame),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listPendingComments(limit = 50) {
  if (isDemoMode()) return [];
  const db = getAdminClient();
  if (!db) return [];
  const { data } = await db
    .from('comments')
    .select('id, game_slug, author, body, rating, status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map((c: any) => ({
    id: c.id,
    gameSlug: c.game_slug,
    author: c.author,
    body: c.body,
    rating: c.rating,
    status: c.status,
    createdAt: c.created_at,
  }));
}
