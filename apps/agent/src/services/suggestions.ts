import {
  compareVersions,
  SUGGESTION_SEVERITY,
  slugify,
  type Suggestion,
  type SuggestionKind,
} from '@modverse/shared';
import { createLogger } from '../core/logger.js';
import { getDb } from './supabase.js';
import { generateKeywordIdeas } from './content-ai.js';
import { politeFetch } from '../core/http.js';

const log = createLogger('suggestions');

/**
 * Content-health analyser.
 *
 * Runs a set of independent checks over the library and emits actionable
 * suggestions. Each check is deliberately cheap and independent so one
 * failing check never blocks the rest.
 *
 * Every suggestion carries a stable `dedupeKey`, so repeated runs update the
 * existing row instead of flooding the dashboard with duplicates.
 */

export interface AnalysisResult {
  suggestions: Suggestion[];
  checksRun: string[];
  errors: Array<{ check: string; error: string }>;
}

type Row = Record<string, any>;

function make(
  kind: SuggestionKind,
  dedupeKey: string,
  fields: Omit<Suggestion, 'kind' | 'severity' | 'status' | 'meta'> & { meta?: Record<string, unknown> },
): Suggestion & { dedupeKey: string } {
  return {
    kind,
    severity: SUGGESTION_SEVERITY[kind],
    status: 'new',
    meta: fields.meta ?? {},
    ...fields,
    dedupeKey,
  } as Suggestion & { dedupeKey: string };
}

/* ─────────────── individual checks ─────────────── */

/** Games whose listing is missing screenshots — a direct conversion problem. */
async function checkMissingScreenshots(): Promise<Array<Suggestion & { dedupeKey: string }>> {
  const db = getDb();
  if (!db) return [];

  const { data } = await db
    .from('games')
    .select('slug, name, screenshots, icon, banner')
    .eq('status', 'published')
    .limit(500);

  const out: Array<Suggestion & { dedupeKey: string }> = [];

  for (const row of (data ?? []) as Row[]) {
    const shots = Array.isArray(row.screenshots) ? row.screenshots.length : 0;
    const missing: string[] = [];
    if (shots < 3) missing.push(`${shots} screenshot${shots === 1 ? '' : 's'}`);
    if (!row.icon?.url) missing.push('no icon');
    if (!row.banner?.url) missing.push('no banner');
    if (!missing.length) continue;

    out.push(
      make('missing-screenshots', `missing-media:${row.slug}`, {
        title: row.name,
        detail: `Listing is missing media (${missing.join(', ')}). Pages with three or more screenshots convert noticeably better.`,
        score: shots === 0 ? 90 : 70 - shots * 8,
        actionHref: `/admin/games/edit/${row.slug}`,
        actionLabel: 'Fix media',
        entitySlug: row.slug,
        meta: { screenshots: shots, hasIcon: Boolean(row.icon?.url), hasBanner: Boolean(row.banner?.url) },
      }),
    );
  }
  return out;
}

/** Games sharing a package name or a suspiciously similar title. */
async function checkDuplicates(): Promise<Array<Suggestion & { dedupeKey: string }>> {
  const db = getDb();
  if (!db) return [];

  const { data } = await db.from('games').select('id, slug, name, package_name, created_at').limit(2000);
  const rows = (data ?? []) as Row[];
  const out: Array<Suggestion & { dedupeKey: string }> = [];

  // A UNIQUE constraint prevents exact package duplicates, but normalised
  // titles can still collide (e.g. "Game 2" vs "Game II").
  const byName = new Map<string, Row[]>();
  for (const r of rows) {
    const key = slugify(String(r.name ?? ''), { stripStopwords: true });
    if (!key) continue;
    byName.set(key, [...(byName.get(key) ?? []), r]);
  }

  for (const [key, group] of byName) {
    if (group.length < 2) continue;
    const slugs = group.map((g) => g.slug).sort();
    out.push(
      make('duplicate-game', `duplicate:${key}`, {
        title: `${group.length} listings share the title "${group[0]!.name}"`,
        detail: `Slugs: ${slugs.join(', ')}. Duplicate listings split link equity and confuse search engines — merge or differentiate them.`,
        score: 85,
        actionHref: `/admin/games?q=${encodeURIComponent(String(group[0]!.name))}`,
        actionLabel: 'Review duplicates',
        entitySlug: slugs[0] ?? null,
        meta: { slugs, packageNames: group.map((g) => g.package_name) },
      }),
    );
  }
  return out;
}

/** Verifies that download links still resolve. */
async function checkBrokenLinks(limit = 25): Promise<Array<Suggestion & { dedupeKey: string }>> {
  const db = getDb();
  if (!db) return [];

  const { data } = await db
    .from('games')
    .select('slug, name, mega_url, mod_apk_url, play_store_url')
    .eq('status', 'published')
    .order('downloads', { ascending: false })
    .limit(limit);

  const out: Array<Suggestion & { dedupeKey: string }> = [];

  for (const row of (data ?? []) as Row[]) {
    const candidates = [
      { label: 'Mega', url: row.mega_url as string | null },
      { label: 'Mirror', url: row.mod_apk_url as string | null },
    ].filter((c): c is { label: string; url: string } => Boolean(c.url));

    if (!candidates.length) {
      out.push(
        make('broken-link', `nolinks:${row.slug}`, {
          title: `${row.name} has no download link`,
          detail: 'This listing is published but offers nothing to download. Re-run the agent or add a mirror.',
          score: 95,
          actionHref: `/admin/games/edit/${row.slug}`,
          actionLabel: 'Add a link',
          entitySlug: row.slug,
        }),
      );
      continue;
    }

    for (const c of candidates) {
      try {
        const res = await politeFetch(c.url, { method: 'HEAD', retries: 1, timeoutMs: 12_000, skipRobots: true });
        // 4xx (other than rate limiting) means the file is genuinely gone.
        if (res.status >= 400 && res.status !== 429 && res.status !== 403) {
          out.push(
            make('broken-link', `broken:${row.slug}:${c.label}`, {
              title: `${row.name} — ${c.label} link returns ${res.status}`,
              detail: `${c.url.slice(0, 120)} responded with HTTP ${res.status}. Visitors clicking this get an error.`,
              score: 92,
              actionHref: `/admin/games/edit/${row.slug}`,
              actionLabel: 'Fix link',
              entitySlug: row.slug,
              meta: { url: c.url, status: res.status, kind: c.label },
            }),
          );
        }
      } catch {
        // Network failure is not proof the link is dead; skip rather than
        // raise a false alarm.
      }
    }
  }
  return out;
}

/** Games whose upstream source advertises a newer version. */
async function checkGameUpdates(): Promise<Array<Suggestion & { dedupeKey: string }>> {
  const db = getDb();
  if (!db) return [];

  const staleCutoff = new Date(Date.now() - 45 * 86_400_000).toISOString();
  const { data } = await db
    .from('games')
    .select('slug, name, version, updated_date, source_url')
    .eq('status', 'published')
    .not('source_url', 'is', null)
    .lt('updated_date', staleCutoff)
    .order('downloads', { ascending: false })
    .limit(30);

  return ((data ?? []) as Row[]).map((row) => {
    const days = row.updated_date
      ? Math.floor((Date.now() - new Date(row.updated_date).getTime()) / 86_400_000)
      : 999;
    return make('game-update', `stale:${row.slug}`, {
      title: `${row.name} has not been refreshed in ${days} days`,
      detail: `Currently on v${row.version}. Re-run the agent against its source to pick up a newer build, changelog and links.`,
      score: Math.min(95, 40 + days),
      actionHref: `/admin/agent?url=${encodeURIComponent(String(row.source_url))}`,
      actionLabel: 'Re-ingest',
      entitySlug: row.slug,
      meta: { version: row.version, daysStale: days, sourceUrl: row.source_url },
    });
  });
}

/** Popular games that have no review yet. */
async function checkTrendingBlogTopics(): Promise<Array<Suggestion & { dedupeKey: string }>> {
  const db = getDb();
  if (!db) return [];

  const { data: games } = await db
    .from('games')
    .select('slug, name, category, downloads')
    .eq('status', 'published')
    .order('downloads', { ascending: false })
    .limit(15);

  const { data: reviews } = await db.from('reviews').select('game_slug').limit(1000);
  const reviewed = new Set(((reviews ?? []) as Row[]).map((r) => r.game_slug));

  const out: Array<Suggestion & { dedupeKey: string }> = [];

  for (const g of ((games ?? []) as Row[]).slice(0, 8)) {
    if (reviewed.has(g.slug)) continue;
    out.push(
      make('trending-blog', `needs-review:${g.slug}`, {
        title: `Write a review for ${g.name}`,
        detail: `${Number(g.downloads).toLocaleString()} downloads and no review yet. Review pages capture "is X worth it" searches that listings do not.`,
        score: 78,
        actionHref: `/admin/reviews/new?game=${encodeURIComponent(g.slug)}`,
        actionLabel: 'Generate review',
        entitySlug: g.slug,
        meta: { downloads: g.downloads, category: g.category },
      }),
    );
  }

  // Category round-ups are reliable traffic when a category has enough depth.
  const { data: cats } = await db.from('games').select('category').eq('status', 'published').limit(2000);
  const counts = new Map<string, number>();
  for (const r of (cats ?? []) as Row[]) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);

  for (const [category, count] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)) {
    if (count < 4) continue;
    out.push(
      make('trending-blog', `roundup:${category}`, {
        title: `Publish a "Best ${category} MOD APKs" round-up`,
        detail: `You have ${count} published ${category} games — enough for a credible top-list that links internally to all of them.`,
        score: 66,
        actionHref: `/admin/blog/new?template=top-10&category=${category}`,
        actionLabel: 'Generate article',
        entitySlug: null,
        meta: { category, count },
      }),
    );
  }

  return out;
}

/** Popular games with no wallpapers derived from them. */
async function checkTrendingWallpapers(): Promise<Array<Suggestion & { dedupeKey: string }>> {
  const db = getDb();
  if (!db) return [];

  const { data: games } = await db
    .from('games')
    .select('slug, name, screenshots, downloads')
    .eq('status', 'published')
    .order('downloads', { ascending: false })
    .limit(12);

  const { data: walls } = await db.from('wallpapers').select('game_slug').limit(2000);
  const covered = new Set(((walls ?? []) as Row[]).map((w) => w.game_slug).filter(Boolean));

  return ((games ?? []) as Row[])
    .filter((g) => !covered.has(g.slug) && Array.isArray(g.screenshots) && g.screenshots.length >= 2)
    .slice(0, 6)
    .map((g) =>
      make('trending-wallpaper', `wallpapers-for:${g.slug}`, {
        title: `Generate wallpapers from ${g.name}`,
        detail: `${g.screenshots.length} screenshots available and no wallpapers yet. The generator can produce phone and desktop variants automatically.`,
        score: 62,
        actionHref: `/admin/wallpapers/new?game=${encodeURIComponent(g.slug)}`,
        actionLabel: 'Generate',
        entitySlug: g.slug,
        meta: { screenshots: g.screenshots.length, downloads: g.downloads },
      }),
    );
}

/** Keyword opportunities derived from the current catalogue. */
async function checkKeywords(): Promise<Array<Suggestion & { dedupeKey: string }>> {
  const db = getDb();
  if (!db) return [];

  const { data } = await db
    .from('games')
    .select('name, category')
    .eq('status', 'published')
    .order('downloads', { ascending: false })
    .limit(10);

  const seeds = ((data ?? []) as Row[]).map((r) => String(r.name));
  if (!seeds.length) return [];

  const [trending, lowComp] = await Promise.all([
    generateKeywordIdeas({ seedTopics: seeds, wantLowCompetition: false, count: 6 }),
    generateKeywordIdeas({ seedTopics: seeds, wantLowCompetition: true, count: 6 }),
  ]);

  const out: Array<Suggestion & { dedupeKey: string }> = [];

  for (const idea of trending.ideas) {
    out.push(
      make('trending-keyword', `kw:${slugify(idea.keyword)}`, {
        title: idea.keyword,
        detail: `${idea.rationale} Difficulty ${idea.difficulty}/100, opportunity ${idea.opportunity}/100.`,
        score: idea.opportunity,
        actionHref: `/admin/blog/new?topic=${encodeURIComponent(idea.keyword)}`,
        actionLabel: 'Write about it',
        entitySlug: null,
        meta: { ...idea },
      }),
    );
  }

  for (const idea of lowComp.ideas) {
    out.push(
      make('low-competition-keyword', `kwlc:${slugify(idea.keyword)}`, {
        title: idea.keyword,
        detail: `${idea.rationale} Difficulty only ${idea.difficulty}/100 — realistic to rank for.`,
        score: Math.min(100, idea.opportunity + 8),
        actionHref: `/admin/blog/new?topic=${encodeURIComponent(idea.keyword)}`,
        actionLabel: 'Write about it',
        entitySlug: null,
        meta: { ...idea },
      }),
    );
  }

  return out;
}

/* ─────────────── orchestration ─────────────── */

const CHECKS: Array<{ name: string; run: () => Promise<Array<Suggestion & { dedupeKey: string }>> }> = [
  { name: 'missing-screenshots', run: checkMissingScreenshots },
  { name: 'duplicate-game', run: checkDuplicates },
  { name: 'game-update', run: checkGameUpdates },
  { name: 'trending-blog', run: checkTrendingBlogTopics },
  { name: 'trending-wallpaper', run: checkTrendingWallpapers },
  { name: 'keywords', run: checkKeywords },
  { name: 'broken-link', run: () => checkBrokenLinks(20) },
];

export async function runContentAnalysis(
  opts: { only?: string[]; onProgress?: (done: number, total: number, note: string) => void } = {},
): Promise<AnalysisResult> {
  const checks = opts.only?.length ? CHECKS.filter((c) => opts.only!.includes(c.name)) : CHECKS;

  const suggestions: Array<Suggestion & { dedupeKey: string }> = [];
  const errors: Array<{ check: string; error: string }> = [];
  const checksRun: string[] = [];

  for (let i = 0; i < checks.length; i += 1) {
    const check = checks[i]!;
    opts.onProgress?.(i, checks.length, `Running ${check.name}`);
    try {
      const found = await check.run();
      suggestions.push(...found);
      checksRun.push(check.name);
      log.debug(`${check.name}: ${found.length} suggestion(s)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ check: check.name, error: message });
      log.warn(`check "${check.name}" failed: ${message}`);
    }
  }

  opts.onProgress?.(checks.length, checks.length, 'Saving');
  await persistSuggestions(suggestions);

  return { suggestions, checksRun, errors };
}

/** Upserts by dedupeKey so re-running refreshes rather than duplicates. */
async function persistSuggestions(items: Array<Suggestion & { dedupeKey: string }>): Promise<number> {
  const db = getDb();
  if (!db || !items.length) return 0;

  const rows = items.map((s) => ({
    kind: s.kind,
    title: s.title.slice(0, 240),
    detail: s.detail.slice(0, 1200),
    score: s.score,
    severity: s.severity,
    action_href: s.actionHref ?? null,
    action_label: s.actionLabel ?? null,
    entity_slug: s.entitySlug ?? null,
    dedupe_key: s.dedupeKey,
    meta: s.meta,
  }));

  const { error } = await db.from('suggestions').upsert(rows, { onConflict: 'dedupe_key' });
  if (error) {
    log.warn(`could not persist suggestions: ${error.message}`);
    return 0;
  }
  return rows.length;
}

export async function listSuggestions(limit = 100): Promise<Suggestion[]> {
  const db = getDb();
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

export async function setSuggestionStatus(id: string, status: 'accepted' | 'dismissed'): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const { error } = await db.from('suggestions').update({ status }).eq('id', id);
  return !error;
}

export { compareVersions };
