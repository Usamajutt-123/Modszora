import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { AgentSource, JobStatus, JobType } from '@modverse/shared';
import { backoffDelay } from '@modverse/shared';
import { config } from '../config/index.js';
import { createLogger, errorMessage, type Logger } from './logger.js';

/**
 * In-process job queue with:
 *  - bounded concurrency
 *  - priority ordering
 *  - exponential backoff retries with jitter
 *  - cancellation
 *  - progress reporting
 *  - optional persistence hooks (Supabase)
 *
 * Deliberately dependency-free: the agent must run on a single container
 * without Redis. Handlers are registered per job type.
 */

export interface Job<P = Record<string, unknown>, R = unknown> {
  id: string;
  type: JobType;
  status: JobStatus;
  source?: AgentSource | null;
  targetUrl?: string | null;
  payload: P;
  result?: R | null;
  error?: string | null;
  attempts: number;
  maxAttempts: number;
  progress: number;
  priority: number;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  nextRunAt?: number;
}

export interface JobContext<P = Record<string, unknown>> {
  job: Job<P>;
  log: Logger;
  /** 0-100 */
  setProgress: (value: number, note?: string) => void;
  signal: AbortSignal;
}

export type JobHandler<P = any, R = any> = (ctx: JobContext<P>) => Promise<R>;

export interface EnqueueOptions {
  type: JobType;
  payload?: Record<string, unknown>;
  source?: AgentSource | null;
  targetUrl?: string | null;
  priority?: number;
  maxAttempts?: number;
  /** Skip if an identical in-flight job exists (default true). */
  dedupe?: boolean;
}

export interface QueueStats {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  retrying: number;
  cancelled: number;
  total: number;
}

const TERMINAL: JobStatus[] = ['completed', 'failed', 'cancelled'];

export class JobQueue extends EventEmitter {
  private readonly jobs = new Map<string, Job>();
  private readonly handlers = new Map<JobType, JobHandler>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly log = createLogger('queue');
  private running = 0;
  private ticking = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly maxHistory = 500;

  constructor(private readonly concurrency: number = config.AGENT_CONCURRENCY) {
    super();
    this.setMaxListeners(50);
  }

  register(type: JobType, handler: JobHandler): void {
    this.handlers.set(type, handler);
    this.log.debug(`handler registered: ${type}`);
  }

  /** Adds a job. Returns the existing job when deduped. */
  enqueue(opts: EnqueueOptions): Job {
    const {
      type,
      payload = {},
      source = null,
      targetUrl = null,
      priority = 5,
      maxAttempts = config.AGENT_MAX_RETRIES,
      dedupe = true,
    } = opts;

    if (dedupe && targetUrl) {
      const existing = [...this.jobs.values()].find(
        (j) => j.type === type && j.targetUrl === targetUrl && !TERMINAL.includes(j.status),
      );
      if (existing) {
        this.log.debug(`deduped ${type}`, { targetUrl });
        return existing;
      }
    }

    const job: Job = {
      id: randomUUID(),
      type,
      status: 'queued',
      source,
      targetUrl,
      payload,
      attempts: 0,
      maxAttempts,
      progress: 0,
      priority,
      createdAt: new Date().toISOString(),
      nextRunAt: Date.now(),
    };

    this.jobs.set(job.id, job);
    this.emit('enqueued', job);
    this.log.info(`queued ${type}`, { id: job.id.slice(0, 8), targetUrl: targetUrl ?? undefined });
    this.scheduleTick();
    return job;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  list(filter: { status?: JobStatus; type?: JobType; limit?: number } = {}): Job[] {
    const { status, type, limit = 100 } = filter;
    return [...this.jobs.values()]
      .filter((j) => (status ? j.status === status : true) && (type ? j.type === type : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job || TERMINAL.includes(job.status)) return false;
    this.controllers.get(id)?.abort();
    job.status = 'cancelled';
    job.finishedAt = new Date().toISOString();
    this.emit('cancelled', job);
    this.log.warn(`cancelled ${job.type}`, { id: id.slice(0, 8) });
    return true;
  }

  stats(): QueueStats {
    const all = [...this.jobs.values()];
    const count = (s: JobStatus) => all.filter((j) => j.status === s).length;
    return {
      queued: count('queued'),
      running: count('running'),
      completed: count('completed'),
      failed: count('failed'),
      retrying: count('retrying'),
      cancelled: count('cancelled'),
      total: all.length,
    };
  }

  /** Resolves when the queue has no queued/running/retrying work left. */
  async drain(timeoutMs = 600_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const s = this.stats();
      if (s.queued === 0 && s.running === 0 && s.retrying === 0) return;
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error('Queue drain timed out');
  }

  start(): void {
    if (this.timer) return;
    // Periodic tick catches retry backoffs whose timers elapsed.
    this.timer = setInterval(() => this.tick(), 500);
    this.timer.unref?.();
    this.log.info(`queue started (concurrency=${this.concurrency})`);
    this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const c of this.controllers.values()) c.abort();
    this.log.info('queue stopped');
  }

  private scheduleTick(): void {
    if (this.ticking) return;
    this.ticking = true;
    setImmediate(() => {
      this.ticking = false;
      this.tick();
    });
  }

  private nextJob(): Job | undefined {
    const now = Date.now();
    return [...this.jobs.values()]
      .filter((j) => (j.status === 'queued' || j.status === 'retrying') && (j.nextRunAt ?? 0) <= now)
      .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt))[0];
  }

  private tick(): void {
    while (this.running < this.concurrency) {
      const job = this.nextJob();
      if (!job) break;
      void this.run(job);
    }
    this.prune();
  }

  private async run(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      job.status = 'failed';
      job.error = `No handler registered for job type "${job.type}"`;
      job.finishedAt = new Date().toISOString();
      this.log.error(job.error, { id: job.id.slice(0, 8) });
      this.emit('failed', job);
      return;
    }

    this.running += 1;
    job.status = 'running';
    job.attempts += 1;
    job.startedAt = new Date().toISOString();
    job.progress = 0;
    job.error = null;

    const controller = new AbortController();
    this.controllers.set(job.id, controller);

    const log = createLogger(`job:${job.type}`, job.id);
    const ctx: JobContext = {
      job,
      log,
      signal: controller.signal,
      setProgress: (value, note) => {
        job.progress = Math.max(0, Math.min(100, value));
        this.emit('progress', job, note);
        if (note) log.debug(note, { progress: job.progress });
      },
    };

    this.emit('started', job);

    try {
      const result = await handler(ctx);
      if (controller.signal.aborted) throw new Error('Job aborted');
      job.result = result ?? null;
      job.status = 'completed';
      job.progress = 100;
      job.finishedAt = new Date().toISOString();
      this.emit('completed', job);
      log.info(`completed in ${this.durationOf(job)}ms`);
    } catch (err) {
      const message = errorMessage(err);
      job.error = message;

      // `cancel()` may have flipped the status while the handler was awaiting,
      // so read it back through the map rather than trusting the narrowed local.
      const cancelled = controller.signal.aborted || this.jobs.get(job.id)?.status === 'cancelled';
      const canRetry = !cancelled && job.attempts < job.maxAttempts && !isFatal(err);

      if (canRetry) {
        const delay = backoffDelay(job.attempts, 2000, 120_000);
        job.status = 'retrying';
        job.nextRunAt = Date.now() + delay;
        log.warn(`attempt ${job.attempts}/${job.maxAttempts} failed — retrying in ${Math.round(delay / 1000)}s`, {
          error: message.slice(0, 200),
        });
        this.emit('retrying', job);
      } else {
        job.status = cancelled ? 'cancelled' : 'failed';
        job.finishedAt = new Date().toISOString();
        log.error(`failed after ${job.attempts} attempt(s): ${message.slice(0, 300)}`);
        this.emit('failed', job);
      }
    } finally {
      this.controllers.delete(job.id);
      this.running -= 1;
      this.scheduleTick();
    }
  }

  private durationOf(job: Job): number {
    if (!job.startedAt) return 0;
    const end = job.finishedAt ? new Date(job.finishedAt).getTime() : Date.now();
    return end - new Date(job.startedAt).getTime();
  }

  /** Keeps memory bounded by dropping the oldest terminal jobs. */
  private prune(): void {
    if (this.jobs.size <= this.maxHistory) return;
    const terminal = [...this.jobs.values()]
      .filter((j) => TERMINAL.includes(j.status))
      .sort((a, b) => (a.finishedAt ?? a.createdAt).localeCompare(b.finishedAt ?? b.createdAt));
    const excess = this.jobs.size - this.maxHistory;
    for (let i = 0; i < Math.min(excess, terminal.length); i += 1) {
      this.jobs.delete(terminal[i]!.id);
    }
  }
}

/** Errors marked fatal skip the retry loop (bad input, auth, 404). */
export class FatalJobError extends Error {
  readonly fatal = true;
  constructor(message: string) {
    super(message);
    this.name = 'FatalJobError';
  }
}

function isFatal(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && 'fatal' in err && (err as { fatal?: boolean }).fatal);
}

export const queue = new JobQueue();
