import { setTimeout as delay } from 'node:timers/promises';
import { config } from '../config/index.js';
import { createLogger } from './logger.js';

/**
 * Polite HTTP client:
 *  - per-host rate limiting (never hammer a source)
 *  - robots.txt awareness with caching
 *  - timeouts + retries on transient status codes
 */

const log = createLogger('http');

const lastRequestAt = new Map<string, number>();
const robotsCache = new Map<string, { rules: RobotRule[]; fetchedAt: number }>();
const ROBOTS_TTL_MS = 6 * 60 * 60 * 1000;

interface RobotRule {
  allow: boolean;
  path: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

/** Blocks until this host's minimum request interval has elapsed. */
async function throttle(url: string): Promise<void> {
  const host = hostOf(url);
  const last = lastRequestAt.get(host) ?? 0;
  const elapsed = Date.now() - last;
  const wait = config.AGENT_REQUEST_DELAY_MS - elapsed;
  if (wait > 0) {
    // Jitter avoids a thundering herd when many jobs target one host.
    await delay(wait + Math.random() * 400);
  }
  lastRequestAt.set(host, Date.now());
}

function parseRobots(text: string, userAgent: string): RobotRule[] {
  const rules: RobotRule[] = [];
  const lines = text.split('\n').map((l) => l.replace(/#.*$/, '').trim());

  let applies = false;
  let sawSpecific = false;
  const ua = userAgent.toLowerCase();

  for (const line of lines) {
    const [rawKey, ...rest] = line.split(':');
    if (!rawKey || rest.length === 0) continue;
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();

    if (key === 'user-agent') {
      const agent = value.toLowerCase();
      const specific = ua.includes(agent) && agent !== '*';
      if (specific) {
        sawSpecific = true;
        applies = true;
        rules.length = 0; // A specific block overrides the wildcard block.
      } else if (agent === '*' && !sawSpecific) {
        applies = true;
      } else {
        applies = false;
      }
      continue;
    }

    if (!applies) continue;
    if (key === 'disallow' && value) rules.push({ allow: false, path: value });
    if (key === 'allow' && value) rules.push({ allow: true, path: value });
  }

  return rules;
}

export async function isAllowedByRobots(url: string): Promise<boolean> {
  if (!config.AGENT_RESPECT_ROBOTS) return true;

  let origin: string;
  let pathname: string;
  try {
    const u = new URL(url);
    origin = u.origin;
    pathname = u.pathname + u.search;
  } catch {
    return false;
  }

  let entry = robotsCache.get(origin);
  if (!entry || Date.now() - entry.fetchedAt > ROBOTS_TTL_MS) {
    try {
      const res = await fetch(`${origin}/robots.txt`, {
        headers: { 'User-Agent': config.AGENT_USER_AGENT },
        signal: AbortSignal.timeout(10_000),
      });
      const text = res.ok ? await res.text() : '';
      entry = { rules: parseRobots(text, config.AGENT_USER_AGENT), fetchedAt: Date.now() };
    } catch {
      // If robots.txt cannot be fetched, default to allowing (standard behaviour).
      entry = { rules: [], fetchedAt: Date.now() };
    }
    robotsCache.set(origin, entry);
  }

  // Longest matching rule wins, per the robots spec.
  let decision = true;
  let bestLength = -1;
  for (const rule of entry.rules) {
    const pattern = rule.path;
    const matches = pattern === '/' ? true : pathname.startsWith(pattern.replace(/\*$/, ''));
    if (matches && pattern.length > bestLength) {
      bestLength = pattern.length;
      decision = rule.allow;
    }
  }
  return decision;
}

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  skipRobots?: boolean;
  method?: 'GET' | 'POST' | 'HEAD';
  body?: string;
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

export async function politeFetch(url: string, opts: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 30_000, retries = config.AGENT_MAX_RETRIES, headers = {}, skipRobots = false, method = 'GET', body } = opts;

  if (!skipRobots && !(await isAllowedByRobots(url))) {
    throw new Error(`Blocked by robots.txt: ${url}`);
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    await throttle(url);
    try {
      const res = await fetch(url, {
        method,
        body,
        headers: {
          'User-Agent': config.AGENT_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          ...headers,
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (RETRYABLE.has(res.status) && attempt < retries) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000;
        log.warn(`HTTP ${res.status} on ${hostOf(url)} — retrying in ${Math.round(wait / 1000)}s`);
        await delay(Math.min(wait, 60_000));
        continue;
      }

      return res;
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      const wait = 2 ** attempt * 1000;
      log.warn(`fetch error on ${hostOf(url)} (attempt ${attempt}/${retries}) — retrying in ${wait / 1000}s`);
      await delay(wait);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string | null> {
  const res = await politeFetch(url, opts);
  if (!res.ok) return null;
  return res.text();
}

export async function fetchBuffer(url: string, opts: FetchOptions = {}): Promise<Buffer | null> {
  const res = await politeFetch(url, opts);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T | null> {
  const res = await politeFetch(url, { ...opts, headers: { Accept: 'application/json', ...opts.headers } });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** HEAD request to read Content-Length without downloading the body. */
export async function probeFileSize(url: string): Promise<number | null> {
  try {
    const res = await politeFetch(url, { method: 'HEAD', retries: 1, skipRobots: true, timeoutMs: 15_000 });
    const len = res.headers.get('content-length');
    return len ? Number.parseInt(len, 10) : null;
  } catch {
    return null;
  }
}
