import { NextResponse, type NextRequest } from 'next/server';

/**
 * In-memory sliding-window rate limiter.
 *
 * Per-instance by design: on Vercel each lambda keeps its own window, which
 * is enough to blunt abusive bursts. For a global limit, swap `store` for
 * Upstash Redis — the interface is intentionally tiny.
 */

interface Bucket {
  hits: number[];
  blockedUntil?: number;
}

const store = new Map<string, Bucket>();
const MAX_KEYS = 20_000;

function sweep(now: number) {
  if (store.size < MAX_KEYS) return;
  for (const [key, bucket] of store) {
    const last = bucket.hits[bucket.hits.length - 1] ?? 0;
    if (now - last > 600_000) store.delete(key);
    if (store.size < MAX_KEYS * 0.8) break;
  }
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return (fwd.split(',')[0] ?? '').trim() || 'unknown';
  return req.headers.get('x-real-ip') ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

export function checkRateLimit(identifier: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = store.get(identifier) ?? { hits: [] };
  if (bucket.blockedUntil && bucket.blockedUntil > now) {
    return { allowed: false, remaining: 0, resetAt: bucket.blockedUntil, limit: opts.max };
  }

  const cutoff = now - opts.windowMs;
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= opts.max) {
    // Escalating block: repeated offenders get a longer cool-off.
    bucket.blockedUntil = now + Math.min(opts.windowMs * 2, 300_000);
    store.set(identifier, bucket);
    return { allowed: false, remaining: 0, resetAt: bucket.blockedUntil, limit: opts.max };
  }

  bucket.hits.push(now);
  delete bucket.blockedUntil;
  store.set(identifier, bucket);

  return {
    allowed: true,
    remaining: Math.max(0, opts.max - bucket.hits.length),
    resetAt: now + opts.windowMs,
    limit: opts.max,
  };
}

/**
 * Guard helper for route handlers.
 * Returns a 429 NextResponse when the caller is over budget, else null.
 */
export function rateLimit(req: NextRequest, scope: string, opts: RateLimitOptions): NextResponse | null {
  const key = `${scope}:${clientIp(req)}`;
  const result = checkRateLimit(key, opts);

  if (result.allowed) return null;

  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { ok: false, error: { code: 'rate_limited', message: `Too many requests. Retry in ${retryAfter}s.` } },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}

/** Test / maintenance helper. */
export function resetRateLimits(): void {
  store.clear();
}
