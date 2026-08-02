import type { LogLevel } from '@modverse/shared';
import { config } from '../config/index.js';

/**
 * Structured logger with an in-memory ring buffer.
 * The buffer powers the monitoring dashboard without a database round-trip,
 * and every entry is also mirrored to Supabase when configured.
 */

export interface LogEntry {
  id: number;
  level: LogLevel;
  scope: string;
  message: string;
  meta?: Record<string, unknown>;
  jobId?: string | null;
  at: string;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const COLORS: Record<LogLevel, string> = {
  debug: '\u001b[90m',
  info: '\u001b[36m',
  warn: '\u001b[33m',
  error: '\u001b[31m',
};
const RESET = '\u001b[0m';

const MAX_BUFFER = 1000;
const buffer: LogEntry[] = [];
let counter = 0;

type Sink = (entry: LogEntry) => void | Promise<void>;
const sinks: Sink[] = [];

export function addLogSink(sink: Sink): void {
  sinks.push(sink);
}

const minLevel: LogLevel = config.NODE_ENV === 'production' ? 'info' : 'debug';

function emit(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>, jobId?: string | null) {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel]) return;

  counter += 1;
  const entry: LogEntry = {
    id: counter,
    level,
    scope,
    message,
    meta,
    jobId: jobId ?? null,
    at: new Date().toISOString(),
  };

  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);

  const time = entry.at.slice(11, 19);
  const metaStr = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const line = `${COLORS[level]}${time} ${level.toUpperCase().padEnd(5)}${RESET} [${scope}] ${message}${metaStr}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);

  for (const sink of sinks) {
    try {
      void sink(entry);
    } catch {
      /* a failing sink must never break the caller */
    }
  }
}

export interface Logger {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  child: (scope: string) => Logger;
  withJob: (jobId: string) => Logger;
}

export function createLogger(scope = 'agent', jobId: string | null = null): Logger {
  return {
    debug: (m, meta) => emit('debug', scope, m, meta, jobId),
    info: (m, meta) => emit('info', scope, m, meta, jobId),
    warn: (m, meta) => emit('warn', scope, m, meta, jobId),
    error: (m, meta) => emit('error', scope, m, meta, jobId),
    child: (sub: string) => createLogger(`${scope}:${sub}`, jobId),
    withJob: (id: string) => createLogger(scope, id),
  };
}

export const logger = createLogger('agent');

export function recentLogs(opts: { limit?: number; level?: LogLevel; jobId?: string } = {}): LogEntry[] {
  const { limit = 200, level, jobId } = opts;
  let items = buffer;
  if (level) items = items.filter((e) => LEVEL_WEIGHT[e.level] >= LEVEL_WEIGHT[level]);
  if (jobId) items = items.filter((e) => e.jobId === jobId);
  return items.slice(-limit).reverse();
}

export function clearLogs(): void {
  buffer.length = 0;
}

/** Serialises unknown thrown values into a readable message. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
