import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  AGENT_SOURCES,
  AGENT_SOURCE_META,
  blogGenerateRequestSchema,
  JOB_TYPES,
  manualIngestSchema,
  reviewGenerateRequestSchema,
  wallpaperGenerateRequestSchema,
  type AgentStatusSnapshot,
} from '@modverse/shared';
import { safeCompare } from '@modverse/shared/crypto';
import { z } from 'zod';
import { config, describeFeatures, features } from '../config/index.js';
import { queue } from '../core/queue.js';
import { recentLogs, createLogger } from '../core/logger.js';
import { openAiStatus } from '../services/openai.js';
import { multcloudHealth, listClouds } from '../services/multcloud.js';
import { getSources, listRecommendations, storageUsage, supabaseAvailable } from '../services/supabase.js';
import { cronStatus } from '../jobs/cron.js';
import { runReviewAction } from '../services/content-ai.js';
import { listSuggestions, setSuggestionStatus } from '../services/suggestions.js';
import { getDb } from '../services/supabase.js';

const log = createLogger('api');
const startedAt = Date.now();

/* ───────────────────────── auth ───────────────────────── */

/** Bearer-token guard. Every mutating route requires the shared agent key. */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!config.AGENT_API_KEY) {
    res.status(503).json({ ok: false, error: { code: 'not_configured', message: 'AGENT_API_KEY is not set on the agent.' } });
    return;
  }

  const header = req.headers.authorization ?? '';
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const apiKey = (req.headers['x-api-key'] as string | undefined)?.trim() ?? '';
  const provided = bearer || apiKey;

  if (!provided || !safeCompare(provided, config.AGENT_API_KEY)) {
    res.status(401).json({ ok: false, error: { code: 'unauthorized', message: 'Invalid or missing API key.' } });
    return;
  }
  next();
}

/* ───────────────────────── helpers ───────────────────────── */

const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ ok: true, data });
const fail = (res: Response, code: string, message: string, status = 400, details?: unknown) =>
  res.status(status).json({ ok: false, error: { code, message, details } });

function asyncRoute(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res).catch(next);
  };
}

/* ───────────────────────── router ───────────────────────── */

export function createRouter(): Router {
  const router = Router();

  /* ── public health (no auth) ── */
  router.get('/health', (_req, res) => {
    const stats = queue.stats();
    res.json({
      ok: true,
      data: {
        status: 'healthy',
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        version: '1.0.0',
        queue: stats,
        features: describeFeatures(),
      },
    });
  });

  /* ── everything below requires the API key ── */
  router.use(requireApiKey);

  /* ── status snapshot for the dashboard ── */
  router.get(
    '/status',
    asyncRoute(async (_req, res) => {
      const [sources, storage] = await Promise.all([
        getSources().catch(() => []),
        storageUsage().catch(() => ({ usedBytes: 0, objectCount: 0 })),
      ]);
      const ai = openAiStatus();
      const stats = queue.stats();

      const snapshot: AgentStatusSnapshot = {
        online: true,
        version: '1.0.0',
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        dryRun: config.AGENT_DRY_RUN,
        concurrency: config.AGENT_CONCURRENCY,
        queue: {
          queued: stats.queued,
          running: stats.running,
          completed: stats.completed,
          failed: stats.failed,
          retrying: stats.retrying,
        },
        crons: cronStatus(),
        sources: sources.length
          ? sources
          : AGENT_SOURCES.map((id) => ({
              id,
              label: AGENT_SOURCE_META[id].label,
              enabled: config.enabledSources.includes(id),
              lastCrawledAt: null,
              health: 'ok' as const,
            })),
        apiUsage: {
          openaiCalls24h: ai.usage.calls,
          openaiTokens24h: ai.usage.promptTokens + ai.usage.completionTokens,
          multcloudTransfers24h: 0,
        },
        storage,
      };
      return ok(res, snapshot);
    }),
  );

  /* ── jobs ── */
  router.get('/jobs', (req, res) => {
    const status = req.query.status as never;
    const type = req.query.type as never;
    const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);
    ok(res, { jobs: queue.list({ status, type, limit }), stats: queue.stats() });
  });

  router.get('/jobs/:id', (req, res) => {
    const job = queue.get(req.params.id as string);
    if (!job) return fail(res, 'not_found', 'Job not found', 404);
    return ok(res, { job, logs: recentLogs({ jobId: job.id, limit: 100 }) });
  });

  router.post('/jobs/:id/cancel', (req, res) => {
    const cancelled = queue.cancel(req.params.id as string);
    if (!cancelled) return fail(res, 'not_cancellable', 'Job is missing or already finished', 409);
    return ok(res, { cancelled: true });
  });

  const enqueueSchema = z.object({
    type: z.enum(JOB_TYPES),
    payload: z.record(z.unknown()).default({}),
    targetUrl: z.string().url().optional(),
    source: z.enum(AGENT_SOURCES).optional(),
    priority: z.number().int().min(0).max(10).optional(),
  });

  router.post('/jobs', (req, res) => {
    const parsed = enqueueSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 'validation_error', 'Invalid job', 422, parsed.error.flatten());
    const job = queue.enqueue({
      type: parsed.data.type,
      payload: parsed.data.payload,
      targetUrl: parsed.data.targetUrl ?? null,
      source: parsed.data.source ?? null,
      priority: parsed.data.priority ?? 5,
    });
    return ok(res, { job }, 202);
  });

  /* ── manual ingest: the "paste a URL, get a published game" endpoint ── */
  router.post('/ingest', (req, res) => {
    const parsed = manualIngestSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 'validation_error', 'Invalid ingest request', 422, parsed.error.flatten());
    }
    const input = parsed.data;

    const job = queue.enqueue({
      type: 'ingest-url',
      targetUrl: input.url,
      payload: {
        url: input.url,
        autoPublish: input.autoPublish,
        uploadToMega: input.uploadToMega,
        generateReview: input.generateReview,
        generateWallpapers: input.generateWallpapers,
        generateBlogDraft: input.generateBlogDraft,
        overrideCategory: input.overrideCategory ?? null,
        dryRun: typeof req.body?.dryRun === 'boolean' ? req.body.dryRun : config.AGENT_DRY_RUN,
      },
      priority: 9, // manual requests jump the queue
    });

    log.info(`manual ingest queued for ${input.url}`);
    return ok(res, { job, message: 'Ingestion started. Poll /jobs/:id for progress.' }, 202);
  });

  /* ── triggers ── */
  router.post('/discover', (req, res) => {
    const job = queue.enqueue({
      type: 'discovery',
      payload: {
        sources: Array.isArray(req.body?.sources) ? req.body.sources : undefined,
        limitPerSource: Number(req.body?.limitPerSource) || 15,
        autoIngest: Boolean(req.body?.autoIngest),
      },
      priority: 6,
      dedupe: false,
    });
    return ok(res, { job }, 202);
  });

  router.post('/check-updates', (req, res) => {
    const job = queue.enqueue({
      type: 'update-check',
      payload: { limit: Number(req.body?.limit) || 25, autoApply: req.body?.autoApply !== false },
      priority: 7,
      dedupe: false,
    });
    return ok(res, { job }, 202);
  });

  router.post('/recommend', (req, res) => {
    const job = queue.enqueue({
      type: 'recommendation',
      payload: {
        sources: Array.isArray(req.body?.sources) ? req.body.sources : undefined,
        limitPerSource: Number(req.body?.limitPerSource) || 12,
      },
      priority: 3,
      dedupe: false,
    });
    return ok(res, { job }, 202);
  });

  router.get(
    '/recommendations',
    asyncRoute(async (req, res) => {
      const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);
      const items = await listRecommendations(limit);
      return ok(res, { items, count: items.length });
    }),
  );

  /* ── logs ── */
  router.get('/logs', (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 200) || 200, 1000);
    const level = req.query.level as never;
    ok(res, { logs: recentLogs({ limit, level }) });
  });

  /* ── sources ── */
  router.get(
    '/sources',
    asyncRoute(async (_req, res) => {
      const dbSources = await getSources().catch(() => []);
      const merged = AGENT_SOURCES.map((id) => {
        const meta = AGENT_SOURCE_META[id];
        const row = dbSources.find((s) => s.id === id);
        return {
          id,
          label: meta.label,
          origin: meta.origin,
          kind: meta.kind,
          enabled: row?.enabled ?? config.enabledSources.includes(id),
          lastCrawledAt: row?.lastCrawledAt ?? null,
          health: row?.health ?? 'ok',
        };
      });
      return ok(res, { sources: merged });
    }),
  );

  /* ── integrations health ── */
  router.get(
    '/integrations',
    asyncRoute(async (_req, res) => {
      const [mc, clouds] = await Promise.all([multcloudHealth(), listClouds().catch(() => [])]);
      return ok(res, {
        supabase: { configured: supabaseAvailable() },
        openai: openAiStatus(),
        multcloud: { ...mc, clouds },
        publishing: { configured: features.publishing, endpoint: config.MODVERSE_PUBLISH_URL },
        dryRun: config.AGENT_DRY_RUN,
      });
    }),
  );

  /* ═══════════════ content generation ═══════════════ */

  /** Queue a blog / news article. */
  router.post('/generate/blog', (req, res) => {
    const parsed = blogGenerateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 'validation_error', 'Invalid blog request', 422, parsed.error.flatten());
    }
    const job = queue.enqueue({
      type: 'blog-generate',
      payload: { ...parsed.data, dryRun: typeof req.body?.dryRun === 'boolean' ? req.body.dryRun : config.AGENT_DRY_RUN },
      priority: 8,
      dedupe: false,
    });
    return ok(res, { job, message: 'Article generation started. Poll /jobs/:id for progress.' }, 202);
  });

  /** Queue wallpaper generation from a game's screenshots. */
  router.post('/generate/wallpapers', (req, res) => {
    const parsed = wallpaperGenerateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 'validation_error', 'Invalid wallpaper request', 422, parsed.error.flatten());
    }
    if (!parsed.data.gameSlug && parsed.data.sourceUrls.length === 0) {
      return fail(res, 'validation_error', 'Provide either a gameSlug or at least one source URL.', 422);
    }
    const job = queue.enqueue({
      type: 'wallpaper-generate',
      payload: { ...parsed.data, dryRun: typeof req.body?.dryRun === 'boolean' ? req.body.dryRun : config.AGENT_DRY_RUN },
      priority: 8,
      dedupe: false,
    });
    return ok(res, { job, message: 'Wallpaper generation started.' }, 202);
  });

  /**
   * Review generator — runs synchronously.
   *
   * The admin panel needs the result immediately to populate the editor, so
   * unlike the queued jobs this returns the generated review inline.
   */
  router.post(
    '/generate/review',
    asyncRoute(async (req, res) => {
      const parsed = reviewGenerateRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return fail(res, 'validation_error', 'Invalid review request', 422, parsed.error.flatten());
      }
      const input = parsed.data;

      // Ground the model in the real game record when we have one.
      let gameName = input.gameName ?? '';
      let gameFacts: Record<string, unknown> = {};

      if (input.gameSlug) {
        const db = getDb();
        if (db) {
          const { data } = await db
            .from('games')
            .select('name, developer, category, version, android_version, size_bytes, rating, mod_features, short_description')
            .eq('slug', input.gameSlug)
            .maybeSingle();
          if (data) {
            gameName = gameName || data.name;
            gameFacts = {
              developer: data.developer,
              category: data.category,
              version: data.version,
              androidVersion: data.android_version,
              sizeBytes: data.size_bytes,
              rating: data.rating,
              modFeatures: data.mod_features,
              description: data.short_description,
            };
          }
        }
      }

      if (!gameName) {
        return fail(res, 'validation_error', 'A gameSlug or gameName is required.', 422);
      }

      const result = await runReviewAction({
        action: input.action,
        review: input.existingReview ?? {},
        gameName,
        gameFacts,
        targetLanguage: input.targetLanguage,
        tone: input.tone,
        notes: input.notes,
      });

      if ('error' in result) return fail(res, 'generation_failed', result.error, 422);

      return ok(res, {
        action: input.action,
        source: result.source,
        review: result.bundle,
        gameName,
      });
    }),
  );

  /* ═══════════════ suggestions ═══════════════ */

  router.post('/analyze', (req, res) => {
    const job = queue.enqueue({
      type: 'content-analysis',
      payload: { only: Array.isArray(req.body?.only) ? req.body.only : undefined },
      priority: 4,
      dedupe: false,
    });
    return ok(res, { job }, 202);
  });

  router.get(
    '/suggestions',
    asyncRoute(async (req, res) => {
      const limit = Math.min(Number(req.query.limit ?? 100) || 100, 300);
      const items = await listSuggestions(limit);
      return ok(res, { items, count: items.length });
    }),
  );

  router.post(
    '/suggestions/:id',
    asyncRoute(async (req, res) => {
      const status = req.body?.status;
      if (status !== 'accepted' && status !== 'dismissed') {
        return fail(res, 'validation_error', 'status must be "accepted" or "dismissed".', 422);
      }
      const updated = await setSuggestionStatus(String(req.params.id), status);
      if (!updated) return fail(res, 'not_found', 'Suggestion not found or database unavailable.', 404);
      return ok(res, { id: req.params.id, status });
    }),
  );

  return router;
}
