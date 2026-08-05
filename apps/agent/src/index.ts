import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, describeFeatures } from './config/index.js';
import { addLogSink, createLogger } from './core/logger.js';
import { queue } from './core/queue.js';
import { closeBrowser } from './core/browser.js';
import { createRouter } from './routes/index.js';
import { registerJobHandlers } from './pipeline/jobs.js';
import { registerContentJobs } from './pipeline/content-jobs.js';
import { startCrons, stopCrons } from './jobs/cron.js';
import { persistJob, persistLog, supabaseAvailable } from './services/supabase.js';

const log = createLogger('server');

/* ─────────────────────── wiring ─────────────────────── */

registerJobHandlers();
registerContentJobs();

// Mirror warn/error logs into Supabase for the admin dashboard.
if (supabaseAvailable()) {
  addLogSink((entry) => {
    void persistLog({
      level: entry.level,
      scope: entry.scope,
      message: entry.message,
      jobId: entry.jobId,
      meta: entry.meta,
    });
  });

  // Persist every job state transition.
  const sync = (job: Parameters<typeof persistJob>[0]) => void persistJob(job).catch(() => undefined);
  for (const event of ['enqueued', 'started', 'completed', 'failed', 'retrying', 'cancelled'] as const) {
    queue.on(event, (job) =>
      sync({
        id: job.id,
        type: job.type,
        status: job.status,
        source: job.source,
        targetUrl: job.targetUrl,
        payload: job.payload,
        result: job.result,
        error: job.error,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        progress: job.progress,
        priority: job.priority,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
      }),
    );
  }
}

/* ─────────────────────── express ─────────────────────── */

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: false, // JSON API only
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Same-origin/server-to-server requests have no Origin header.
      if (!origin) return callback(null, true);
      const allowed = [config.MODVERSE_SITE_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'];
      if (allowed.some((a) => origin.startsWith(a))) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: false,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  }),
);

app.use(express.json({ limit: '2mb' }));

// Lightweight request log (skips the noisy health probe).
app.use((req, _res, next) => {
  if (req.path !== '/health' && req.path !== '/api/health') {
    log.debug(`${req.method} ${req.path}`);
  }
  next();
});

// Simple in-memory rate limiter for the agent API surface.
const hits = new Map<string, number[]>();
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/api/health') return next();
  const ip = req.ip ?? 'unknown';
  const now = Date.now();
  const window = 60_000;
  const max = 240;
  const list = (hits.get(ip) ?? []).filter((t) => now - t < window);
  if (list.length >= max) {
    res.status(429).json({ ok: false, error: { code: 'rate_limited', message: 'Too many requests.' } });
    return;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  next();
});

app.use('/api', createRouter());
app.use('/', createRouter()); // convenience alias: /health, /status, ...

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Endpoint not found.' } });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  log.error(`unhandled error: ${err.message}`, { stack: err.stack?.split('\n').slice(0, 3).join(' | ') });
  res.status(500).json({ ok: false, error: { code: 'internal_error', message: 'Internal server error.' } });
});

/* ─────────────────────── lifecycle ─────────────────────── */

export function start(): ReturnType<typeof app.listen> {
  queue.start();
  startCrons();

  const server = app.listen(config.AGENT_PORT, () => {
    const f = describeFeatures();
    log.info('─'.repeat(58));
    log.info(`MODSzora Agent listening on http://localhost:${config.AGENT_PORT}`);
    log.info(`  supabase   : ${f.supabase}`);
    log.info(`  openai     : ${f.openai}`);
    log.info(`  multcloud  : ${f.multcloud}`);
    log.info(`  publishing : ${f.publishing}`);
    log.info(`  dry run    : ${f.dryRun}`);
    log.info(`  sources    : ${config.enabledSources.join(', ') || 'none'}`);
    log.info('─'.repeat(58));
  });

  const shutdown = async (signal: string) => {
    log.info(`${signal} received — shutting down`);
    stopCrons();
    queue.stop();
    server.close();
    await closeBrowser();
    setTimeout(() => process.exit(0), 500).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    log.error(`unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
  });
  process.on('uncaughtException', (err) => {
    log.error(`uncaught exception: ${err.message}`, { stack: err.stack?.split('\n').slice(0, 3).join(' | ') });
  });

  return server;
}

// Start when executed directly (not when imported by tests/CLI).
const isDirectRun = process.argv[1]?.includes('index');
if (isDirectRun) start();

export { app };
