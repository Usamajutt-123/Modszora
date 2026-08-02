import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware class merge. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Deterministic pseudo-random in [0,1) from a string — used for stable demo data. */
export function seededRandom(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export function pick<T>(items: readonly T[], seed: string): T {
  return items[Math.floor(seededRandom(seed) * items.length)] as T;
}

/** 1×1 transparent blur placeholder so images never cause layout shift. */
export const BLUR_DATA_URL =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#12162a"/></svg>',
  ).toString('base64');

export function starsFromRating(rating: number): { full: number; half: number; empty: number } {
  const clamped = Math.max(0, Math.min(5, rating));
  const full = Math.floor(clamped);
  const half = clamped - full >= 0.25 && clamped - full < 0.75 ? 1 : 0;
  const roundedUp = clamped - full >= 0.75 ? 1 : 0;
  return { full: full + roundedUp, half, empty: 5 - full - roundedUp - half };
}

export function buildQueryString(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
