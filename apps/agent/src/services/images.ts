import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { IMAGE_PRESETS, slugify, type ImagePreset, type MediaAsset } from '@modverse/shared';
import { fetchBuffer } from '../core/http.js';
import { createLogger } from '../core/logger.js';
import { uploadToStorage } from './supabase.js';

const log = createLogger('images');

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  bytes: number;
  format: 'webp';
  blurDataUrl: string;
  sha256: string;
}

const MAX_SOURCE_BYTES = 24 * 1024 * 1024; // reject absurd source files
const MIN_DIMENSION = 48;

/**
 * Normalises an arbitrary remote image into a compressed WebP plus a tiny
 * inline blur placeholder (prevents layout shift on the front end).
 */
export async function processImage(input: Buffer, preset: ImagePreset): Promise<ProcessedImage | null> {
  const cfg = IMAGE_PRESETS[preset];

  try {
    const image = sharp(input, { failOn: 'none', animated: false });
    const meta = await image.metadata();

    if (!meta.width || !meta.height) {
      log.warn('image has no dimensions — skipping');
      return null;
    }
    if (meta.width < MIN_DIMENSION || meta.height < MIN_DIMENSION) {
      log.warn(`image too small (${meta.width}x${meta.height}) — skipping`);
      return null;
    }

    const pipeline = image
      .rotate() // honour EXIF orientation
      .resize({
        width: cfg.width,
        height: cfg.height,
        fit: cfg.fit as keyof sharp.FitEnum,
        withoutEnlargement: true,
        background: { r: 12, g: 16, b: 32, alpha: 1 },
      })
      .webp({ quality: cfg.quality, effort: 5, smartSubsample: true });

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

    // 12px blur placeholder inlined as a data URL.
    const blur = await sharp(input, { failOn: 'none', animated: false })
      .resize(12, 12, { fit: 'inside' })
      .webp({ quality: 30 })
      .toBuffer();

    return {
      buffer: data,
      width: info.width,
      height: info.height,
      bytes: info.size,
      format: 'webp',
      blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}`,
      sha256: createHash('sha256').update(data).digest('hex'),
    };
  } catch (err) {
    log.warn(`sharp failed to process image: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/**
 * Downloads → compresses → uploads a single remote image.
 * Returns a MediaAsset ready to be stored on the game record, or null when
 * the source is unreachable or unusable (never throws).
 */
export async function ingestImage(
  sourceUrl: string,
  opts: { preset: ImagePreset; slug: string; kind: string; index?: number; alt?: string },
): Promise<MediaAsset | null> {
  const { preset, slug, kind, index, alt } = opts;

  let raw: Buffer | null = null;
  try {
    raw = await fetchBuffer(sourceUrl, { timeoutMs: 30_000, retries: 2, skipRobots: true });
  } catch (err) {
    log.warn(`could not download ${sourceUrl}: ${err instanceof Error ? err.message : err}`);
    return null;
  }

  if (!raw || raw.byteLength === 0) return null;
  if (raw.byteLength > MAX_SOURCE_BYTES) {
    log.warn(`source image too large (${raw.byteLength} bytes) — skipping`);
    return null;
  }

  const processed = await processImage(raw, preset);
  if (!processed) return null;

  const name = index === undefined ? `${kind}.webp` : `${kind}-${index + 1}.webp`;
  const path = `games/${slugify(slug)}/${name}`;

  const publicUrl = await uploadToStorage(path, processed.buffer, 'image/webp');
  if (!publicUrl) {
    log.warn(`storage upload failed for ${path}`);
    return null;
  }

  const saved = raw.byteLength - processed.bytes;
  const pct = raw.byteLength > 0 ? Math.round((saved / raw.byteLength) * 100) : 0;
  log.debug(`${kind}: ${(raw.byteLength / 1024).toFixed(0)}KB → ${(processed.bytes / 1024).toFixed(0)}KB (-${pct}%)`);

  return {
    url: publicUrl,
    width: processed.width,
    height: processed.height,
    bytes: processed.bytes,
    format: 'webp',
    alt: alt ?? null,
    blurDataUrl: processed.blurDataUrl,
  };
}

export interface MediaBundle {
  icon: MediaAsset | null;
  banner: MediaAsset | null;
  screenshots: MediaAsset[];
  stats: { attempted: number; succeeded: number; bytesIn: number; bytesOut: number };
}

/**
 * Full media pipeline for one game. Runs downloads with limited parallelism
 * and tolerates individual failures.
 */
export async function ingestGameMedia(input: {
  slug: string;
  gameName: string;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  screenshotUrls?: string[];
  maxScreenshots?: number;
  onProgress?: (done: number, total: number) => void;
}): Promise<MediaBundle> {
  const { slug, gameName, iconUrl, bannerUrl, screenshotUrls = [], maxScreenshots = 8, onProgress } = input;

  const shots = screenshotUrls.slice(0, maxScreenshots);
  const total = (iconUrl ? 1 : 0) + (bannerUrl ? 1 : 0) + shots.length;
  let done = 0;
  const tick = () => {
    done += 1;
    onProgress?.(done, total);
  };

  const stats = { attempted: total, succeeded: 0, bytesIn: 0, bytesOut: 0 };

  const icon = iconUrl
    ? await ingestImage(iconUrl, { preset: 'icon', slug, kind: 'icon', alt: `${gameName} icon` }).finally(tick)
    : null;

  const banner = bannerUrl
    ? await ingestImage(bannerUrl, { preset: 'banner', slug, kind: 'banner', alt: `${gameName} banner` }).finally(tick)
    : null;

  // Screenshots two at a time — enough throughput without hammering the host.
  const screenshots: MediaAsset[] = [];
  for (let i = 0; i < shots.length; i += 2) {
    const batch = shots.slice(i, i + 2);
    const results = await Promise.all(
      batch.map((url, offset) =>
        ingestImage(url, {
          preset: 'screenshot',
          slug,
          kind: 'screenshot',
          index: i + offset,
          alt: `${gameName} gameplay screenshot ${i + offset + 1}`,
        }).finally(tick),
      ),
    );
    for (const r of results) if (r) screenshots.push(r);
  }

  for (const asset of [icon, banner, ...screenshots]) {
    if (asset) {
      stats.succeeded += 1;
      stats.bytesOut += asset.bytes ?? 0;
    }
  }

  log.info(`media for "${gameName}": ${stats.succeeded}/${stats.attempted} assets, ${(stats.bytesOut / 1024).toFixed(0)}KB total`);

  return { icon, banner, screenshots, stats };
}

/** Generates a 1200x630 OG image from a banner (or icon) for social cards. */
export async function generateOgImage(source: Buffer, slug: string): Promise<MediaAsset | null> {
  const processed = await processImage(source, 'og');
  if (!processed) return null;
  const url = await uploadToStorage(`games/${slugify(slug)}/og.webp`, processed.buffer, 'image/webp');
  if (!url) return null;
  return {
    url,
    width: processed.width,
    height: processed.height,
    bytes: processed.bytes,
    format: 'webp',
    alt: null,
    blurDataUrl: processed.blurDataUrl,
  };
}
