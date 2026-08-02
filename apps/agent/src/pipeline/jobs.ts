import type { AgentSource, Recommendation } from '@modverse/shared';
import { compareVersions, hostnameOf, unique } from '@modverse/shared';
import { config } from '../config/index.js';
import { createLogger } from '../core/logger.js';
import { queue, type JobContext } from '../core/queue.js';
import { getScraper, scraperForUrl } from '../scrapers/adapters.js';
import {
  findExistingGame,
  listGamesNeedingUpdateCheck,
  saveRecommendation,
  touchSource,
} from '../services/supabase.js';
import { ingestUrl } from './ingest.js';

const log = createLogger('jobs');

/* ═══════════════════════ discovery ═══════════════════════ */

export interface DiscoveryPayload {
  sources?: AgentSource[];
  limitPerSource?: number;
  autoIngest?: boolean;
}

/**
 * Crawls listing pages across all enabled sources, filters out games we
 * already have, and (optionally) queues ingestion jobs for the new ones.
 */
async function runDiscovery(ctx: JobContext<DiscoveryPayload>) {
  const { log: l, setProgress, signal } = ctx;
  const sources = ctx.job.payload.sources?.length ? ctx.job.payload.sources : [...config.enabledSources];
  const limitPerSource = ctx.job.payload.limitPerSource ?? 15;
  const autoIngest = ctx.job.payload.autoIngest ?? false;

  const found: Array<{ source: AgentSource; url: string; title: string }> = [];
  const errors: Array<{ source: AgentSource; error: string }> = [];

  for (let i = 0; i < sources.length; i += 1) {
    if (signal.aborted) break;
    const source = sources[i]!;
    setProgress(Math.round((i / sources.length) * 70), `Crawling ${source}`);

    try {
      const scraper = getScraper(source);
      const items = await scraper.discover(limitPerSource);
      for (const item of items) {
        found.push({ source, url: item.url, title: item.title ?? '' });
      }
      await touchSource(source, { ok: true, itemsFound: items.length }).catch(() => undefined);
      l.info(`${source}: ${items.length} candidates`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ source, error: message });
      await touchSource(source, { ok: false }).catch(() => undefined);
      l.warn(`${source} discovery failed: ${message}`);
    }
  }

  // Filter out anything already in the database.
  setProgress(78, 'Filtering known games');
  const fresh: typeof found = [];
  for (const item of found) {
    const existing = await findExistingGame({ sourceUrl: item.url, name: item.title || null });
    if (!existing) fresh.push(item);
  }

  l.info(`discovery complete: ${found.length} candidates, ${fresh.length} new`);

  if (autoIngest && fresh.length) {
    setProgress(90, `Queueing ${fresh.length} ingestion jobs`);
    for (const item of fresh.slice(0, 25)) {
      queue.enqueue({
        type: 'ingest-url',
        targetUrl: item.url,
        source: item.source,
        payload: { url: item.url, autoPublish: config.AGENT_AUTO_PUBLISH },
        priority: 4,
      });
    }
  }

  setProgress(100, 'Done');
  return {
    candidates: found.length,
    fresh: fresh.length,
    queued: autoIngest ? Math.min(fresh.length, 25) : 0,
    errors,
    items: fresh.slice(0, 50),
  };
}

/* ═══════════════════════ update checking ═══════════════════════ */

export interface UpdateCheckPayload {
  limit?: number;
  autoApply?: boolean;
}

/**
 * Re-scrapes the source page of existing games and detects version bumps.
 * Only games whose upstream version is genuinely newer get an update job,
 * so this is cheap to run on a schedule.
 */
async function runUpdateCheck(ctx: JobContext<UpdateCheckPayload>) {
  const { log: l, setProgress, signal } = ctx;
  const limit = ctx.job.payload.limit ?? 25;
  const autoApply = ctx.job.payload.autoApply ?? true;

  const games = await listGamesNeedingUpdateCheck(limit);
  if (!games.length) {
    l.info('no games with source URLs to check');
    return { checked: 0, updatesFound: 0, queued: 0, updates: [] };
  }

  l.info(`checking ${games.length} games for updates`);
  const updates: Array<{ slug: string; from: string; to: string; url: string }> = [];

  for (let i = 0; i < games.length; i += 1) {
    if (signal.aborted) break;
    const game = games[i]!;
    setProgress(Math.round((i / games.length) * 90), `Checking ${game.name}`);

    if (!game.sourceUrl) continue;
    const scraper = scraperForUrl(game.sourceUrl);
    if (!scraper) continue;

    try {
      const scraped = await scraper.scrape(game.sourceUrl);
      if (!scraped?.version) continue;

      if (compareVersions(scraped.version, game.version) === 1) {
        updates.push({ slug: game.slug, from: game.version, to: scraped.version, url: game.sourceUrl });
        l.info(`update available: ${game.name} ${game.version} → ${scraped.version}`);

        if (autoApply) {
          queue.enqueue({
            type: 'ingest-url',
            targetUrl: game.sourceUrl,
            source: scraped.source,
            payload: { url: game.sourceUrl, autoPublish: true },
            priority: 7, // updates outrank new discoveries
          });
        }
      }
    } catch (err) {
      l.warn(`update check failed for ${game.slug}: ${err instanceof Error ? err.message : err}`);
    }
  }

  setProgress(100, 'Done');
  return { checked: games.length, updatesFound: updates.length, queued: autoApply ? updates.length : 0, updates };
}

/* ═══════════════════════ recommendations ═══════════════════════ */

export interface RecommendationPayload {
  sources?: AgentSource[];
  limitPerSource?: number;
}

/**
 * Research mode: scans sources and scores candidates so a human can pick
 * what to publish next, instead of ingesting everything indiscriminately.
 */
async function runRecommendations(ctx: JobContext<RecommendationPayload>) {
  const { log: l, setProgress, signal } = ctx;
  const sources = ctx.job.payload.sources?.length ? ctx.job.payload.sources : [...config.enabledSources];
  const limitPerSource = ctx.job.payload.limitPerSource ?? 12;

  const recommendations: Recommendation[] = [];

  for (let i = 0; i < sources.length; i += 1) {
    if (signal.aborted) break;
    const source = sources[i]!;
    setProgress(Math.round((i / sources.length) * 80), `Researching ${source}`);

    try {
      const items = await getScraper(source).discover(limitPerSource);

      for (let rank = 0; rank < items.length; rank += 1) {
        const item = items[rank]!;
        const existing = await findExistingGame({ sourceUrl: item.url, name: item.title ?? null });

        // Position on the listing page is a strong popularity proxy.
        const positionScore = Math.max(0, 100 - rank * 6);

        if (existing) {
          // Only recommend an update when the upstream version looks newer.
          if (item.version && compareVersions(item.version, existing.version) === 1) {
            recommendations.push({
              kind: 'needs-update',
              title: existing.name,
              source,
              sourceUrl: item.url,
              score: Math.min(100, positionScore + 20),
              reason: `Upstream shows v${item.version}; the site has v${existing.version}.`,
              packageName: existing.packageName,
              existingGameSlug: existing.slug,
              meta: { currentVersion: existing.version, upstreamVersion: item.version, rank },
              status: 'new',
            });
          }
          continue;
        }

        recommendations.push({
          kind: rank < 5 ? 'trending' : 'new-game',
          title: item.title || hostnameOf(item.url) || 'Untitled',
          source,
          sourceUrl: item.url,
          score: positionScore,
          reason:
            rank < 5
              ? `Featured near the top of ${source}'s listing, which usually tracks current demand.`
              : `New on ${source} and not yet in the MODVerse library.`,
          packageName: null,
          existingGameSlug: null,
          meta: { rank, discoveredAt: new Date().toISOString() },
          status: 'new',
        });
      }
    } catch (err) {
      l.warn(`recommendation scan failed for ${source}: ${err instanceof Error ? err.message : err}`);
    }
  }

  setProgress(88, 'Saving recommendations');
  const deduped = recommendations
    .filter((r, i, arr) => arr.findIndex((x) => x.sourceUrl === r.sourceUrl) === i)
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);

  let saved = 0;
  for (const rec of deduped) {
    if (await saveRecommendation(rec)) saved += 1;
  }

  setProgress(100, 'Done');
  l.info(`recommendations: ${deduped.length} generated, ${saved} saved`);

  return {
    generated: deduped.length,
    saved,
    byKind: {
      trending: deduped.filter((r) => r.kind === 'trending').length,
      newGame: deduped.filter((r) => r.kind === 'new-game').length,
      needsUpdate: deduped.filter((r) => r.kind === 'needs-update').length,
    },
    top: deduped.slice(0, 20),
  };
}

/* ═══════════════════════ manual ingest ═══════════════════════ */

export interface IngestPayload {
  url: string;
  autoPublish?: boolean;
  uploadToMega?: boolean;
  generateReview?: boolean;
  generateWallpapers?: boolean;
  generateBlogDraft?: boolean;
  overrideCategory?: string | null;
  dryRun?: boolean;
}

async function runIngest(ctx: JobContext<IngestPayload>) {
  const p = ctx.job.payload;
  return ingestUrl({
    url: p.url,
    autoPublish: p.autoPublish,
    uploadToMega: p.uploadToMega ?? true,
    generateReviewToo: p.generateReview ?? true,
    generateWallpapers: p.generateWallpapers ?? false,
    generateBlogDraft: p.generateBlogDraft ?? false,
    overrideCategory: (p.overrideCategory as never) ?? null,
    dryRun: p.dryRun ?? config.AGENT_DRY_RUN,
    jobId: ctx.job.id,
    logger: ctx.log,
    onProgress: ctx.setProgress,
    signal: ctx.signal,
  });
}

/* ═══════════════════════ registration ═══════════════════════ */

export function registerJobHandlers(): void {
  queue.register('discovery', runDiscovery as never);
  queue.register('update-check', runUpdateCheck as never);
  queue.register('recommendation', runRecommendations as never);
  queue.register('ingest-url', runIngest as never);

  // These are steps of the ingest pipeline; exposed for targeted re-runs.
  queue.register('media-pipeline', async (ctx) => {
    const { ingestGameMedia } = await import('../services/images.js');
    const p = ctx.job.payload as { slug: string; gameName: string; iconUrl?: string; bannerUrl?: string; screenshotUrls?: string[] };
    return ingestGameMedia({ ...p, onProgress: (d, t) => ctx.setProgress(t ? (d / t) * 100 : 0) });
  });

  queue.register('remote-upload', async (ctx) => {
    const { remoteUploadToMega, buildApkFileName } = await import('../services/multcloud.js');
    const p = ctx.job.payload as { sourceUrl: string; gameName: string; version: string };
    return remoteUploadToMega({
      sourceUrl: p.sourceUrl,
      fileName: buildApkFileName(p.gameName, p.version),
      onProgress: (pct, note) => ctx.setProgress(pct, note),
      signal: ctx.signal,
    });
  });

  queue.register('seo-generate', async (ctx) => {
    const { generateSeoBundle } = await import('../services/openai.js');
    return generateSeoBundle(ctx.job.payload as never);
  });

  queue.register('publish', async (ctx) => {
    const { publishToSite } = await import('./ingest.js');
    const p = ctx.job.payload as never as Parameters<typeof publishToSite>[0];
    return publishToSite(p);
  });

  log.info(`registered ${8} job handlers`);
}

export const jobRunners = { runDiscovery, runUpdateCheck, runRecommendations, runIngest };
