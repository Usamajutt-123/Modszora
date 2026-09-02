/* ─────────────────────────── slug ─────────────────────────── */

const SLUG_STOPWORDS = new Set(['a', 'an', 'the', 'of', 'for', 'and', 'apk', 'mod', 'download']);

/** Deterministic, URL-safe slug. Keeps `mod-apk` suffix support for SEO. */
export function slugify(input: string, opts: { maxLength?: number; stripStopwords?: boolean } = {}): string {
  const { maxLength = 90, stripStopwords = false } = opts;
  let parts = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (stripStopwords && parts.length > 3) {
    const filtered = parts.filter((p) => !SLUG_STOPWORDS.has(p));
    if (filtered.length >= 2) parts = filtered;
  }

  let slug = parts.join('-');
  if (slug.length > maxLength) {
    slug = slug.slice(0, maxLength);
    const lastDash = slug.lastIndexOf('-');
    if (lastDash > maxLength * 0.6) slug = slug.slice(0, lastDash);
  }
  return slug.replace(/^-+|-+$/g, '') || 'item';
}

export function gameSlug(name: string): string {
  const base = slugify(name.replace(/\b(mod|apk|hack|unlimited money)\b/gi, ''));
  return base.endsWith('-mod-apk') ? base : `${base}-mod-apk`;
}

export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  if (!set.has(base)) return base;
  for (let i = 2; i < 500; i += 1) {
    const candidate = `${base}-${i}`;
    if (!set.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/* ─────────────────────────── formatting ─────────────────────────── */

/** Normalises a version string so leading 'v' is never duplicated (e.g. 'v1.0' -> 'v1.0', '1.0' -> 'v1.0', 'vv0.101' -> 'v0.101'). */
export function formatVersion(version: string | null | undefined): string {
  if (!version) return '';
  const trimmed = version.trim();
  const clean = trimmed.replace(/^v+/i, '');
  return `v${clean}`;
}

export function formatBytes(bytes: number | null | undefined, decimals = 1): string {
  if (!bytes || bytes <= 0) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
}

/** Parses "142 MB", "1.2GB", "980 kb" into bytes. */
export function parseSizeToBytes(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = /([\d.,]+)\s*(tb|gb|mb|kb|b)\b/i.exec(text.replace(/\s+/g, ' '));
  if (!match) return null;
  const raw = match[1];
  const unit = match[2];
  if (!raw || !unit) return null;
  const num = Number.parseFloat(raw.replace(/,/g, ''));
  if (!Number.isFinite(num)) return null;
  const mult: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 };
  return Math.round(num * (mult[unit.toLowerCase()] ?? 1));
}

export function formatCompactNumber(value: number | null | undefined): string {
  const n = value ?? 0;
  if (n < 1000) return String(n);
  const units = [
    { v: 1_000_000_000, s: 'B' },
    { v: 1_000_000, s: 'M' },
    { v: 1_000, s: 'K' },
  ];
  for (const u of units) {
    if (n >= u.v) {
      const num = n / u.v;
      return `${num >= 100 ? num.toFixed(0) : num.toFixed(1).replace(/\.0$/, '')}${u.s}`;
    }
  }
  return String(n);
}

export function formatDate(value: string | Date | null | undefined, locale = 'en-US'): string {
  if (!value) return 'Unknown';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function timeAgo(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return 'unknown';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return 'unknown';
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  const steps: Array<[number, string]> = [
    [31536000, 'year'],
    [2592000, 'month'],
    [604800, 'week'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
  ];
  for (const [secs, label] of steps) {
    const count = Math.floor(Math.abs(seconds) / secs);
    if (count >= 1) return `${count} ${label}${count > 1 ? 's' : ''} ${seconds >= 0 ? 'ago' : 'from now'}`;
  }
  return 'just now';
}

export function readingMinutes(text: string, wpm = 220): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / wpm));
}

export function truncate(text: string, max: number, suffix = '…'): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - suffix.length);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}${suffix}`;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ─────────────────────────── versions ─────────────────────────── */

/** Extracts a comparable numeric tuple from arbitrary version strings. */
export function parseVersion(version: string | null | undefined): number[] {
  if (!version) return [];
  const cleaned = version.replace(/[^\d.]/g, ' ').trim();
  const first = cleaned.split(/\s+/).find((p) => p.includes('.') || /^\d+$/.test(p)) ?? '';
  return first
    .split('.')
    .map((p) => Number.parseInt(p, 10))
    .filter((n) => Number.isFinite(n));
}

/** -1 = a older, 0 = equal, 1 = a newer. */
export function compareVersions(a: string | null | undefined, b: string | null | undefined): -1 | 0 | 1 {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  const sa = (a ?? '').trim().toLowerCase();
  const sb = (b ?? '').trim().toLowerCase();
  if (sa === sb) return 0;
  return sa > sb ? 1 : sa < sb ? -1 : 0;
}

export function isNewerVersion(candidate: string | null | undefined, current: string | null | undefined): boolean {
  return compareVersions(candidate, current) === 1;
}

/* ─────────────────────────── hashing ─────────────────────────── */

/** Stable JSON stringify (sorted keys) so hashes are deterministic. */
export function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const walk = (val: unknown): unknown => {
    if (val === null || typeof val !== 'object') return val;
    if (seen.has(val as object)) return '[circular]';
    seen.add(val as object);
    if (Array.isArray(val)) return val.map(walk);
    return Object.keys(val as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = walk((val as Record<string, unknown>)[key]);
        return acc;
      }, {});
  };
  return JSON.stringify(walk(value));
}

/* ─────────────────────────── misc ─────────────────────────── */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with jitter, capped. */
export function backoffDelay(attempt: number, baseMs = 1000, maxMs = 60_000): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.round(exp * (0.7 + Math.random() * 0.6));
}

export async function retry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: { attempts?: number; baseMs?: number; maxMs?: number; onRetry?: (err: unknown, attempt: number) => void } = {},
): Promise<T> {
  const { attempts = 3, baseMs = 1000, maxMs = 30_000, onRetry } = opts;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt === attempts) break;
      onRetry?.(err, attempt);
      await sleep(backoffDelay(attempt, baseMs, maxMs));
    }
  }
  throw lastError;
}

export function safeJsonParse<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Extracts the first balanced JSON object from an LLM response. */
export function extractJsonObject(text: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const source = fenced?.[1] ?? text;
  const start = source.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Normalises an absolute/relative URL against a base; returns null when invalid. */
export function absoluteUrl(href: string | null | undefined, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
