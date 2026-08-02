import sharp from 'sharp';
import {
  slugify,
  WALLPAPER_PRESETS,
  type MediaAsset,
  type Wallpaper,
  type WallpaperCategory,
  type WallpaperPreset,
} from '@modverse/shared';
import { fetchBuffer } from '../core/http.js';
import { createLogger } from '../core/logger.js';
import { uploadToStorage } from './supabase.js';
import { generateWallpaperMeta } from './content-ai.js';

const log = createLogger('wallpapers');

/**
 * Wallpaper generator.
 *
 * Turns a game's screenshots into publish-ready wallpapers: each source image
 * is re-framed to the requested aspect ratios, compressed to WebP, given a
 * thumbnail and a blur placeholder, and paired with AI-written metadata.
 *
 * Screenshots are portrait and desktop wallpapers are landscape, so a plain
 * resize would letterbox or squash. We use an attention-based crop, which
 * keeps the visually busiest region (usually the character or HUD focus)
 * rather than blindly centring.
 */

const MAX_SOURCE_BYTES = 24 * 1024 * 1024;

export interface GeneratedWallpaper {
  wallpaper: Omit<Wallpaper, 'seo'> & { seo: Wallpaper['seo'] };
  bytes: number;
}

interface RenderResult {
  asset: MediaAsset;
  width: number;
  height: number;
  bytes: number;
}

async function render(
  source: Buffer,
  preset: WallpaperPreset,
  storagePath: string,
  alt: string,
): Promise<RenderResult | null> {
  const { width, height } = WALLPAPER_PRESETS[preset];

  try {
    const pipeline = sharp(source, { failOn: 'none', animated: false })
      .rotate()
      .resize({
        width,
        height,
        fit: 'cover',
        // Keep the most salient region when changing aspect ratio.
        position: sharp.strategy.attention,
        withoutEnlargement: false,
      })
      .webp({ quality: 86, effort: 5, smartSubsample: true });

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

    const blur = await sharp(data).resize(12, 12, { fit: 'inside' }).webp({ quality: 30 }).toBuffer();

    const url = await uploadToStorage(storagePath, data, 'image/webp');
    if (!url) return null;

    return {
      asset: {
        url,
        width: info.width,
        height: info.height,
        bytes: info.size,
        format: 'webp',
        alt,
        blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}`,
      },
      width: info.width,
      height: info.height,
      bytes: info.size,
    };
  } catch (err) {
    log.warn(`sharp failed for ${preset}: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

export interface WallpaperGenerationInput {
  gameName: string;
  gameSlug?: string | null;
  sourceUrls: string[];
  presets?: WallpaperPreset[];
  category?: WallpaperCategory;
  autoPublish?: boolean;
  maxCount?: number;
  onProgress?: (done: number, total: number, note: string) => void;
}

export interface WallpaperGenerationResult {
  wallpapers: Wallpaper[];
  attempted: number;
  succeeded: number;
  failed: number;
  bytesOut: number;
  warnings: string[];
}

/**
 * Generates wallpapers from source images.
 * Individual failures never abort the batch — a partial set is still useful.
 */
export async function generateWallpapersFromImages(
  input: WallpaperGenerationInput,
): Promise<WallpaperGenerationResult> {
  const {
    gameName,
    gameSlug = null,
    sourceUrls,
    presets = ['phone', 'desktop'],
    category = 'action',
    autoPublish = false,
    maxCount = 6,
    onProgress,
  } = input;

  const sources = sourceUrls.slice(0, maxCount);
  const total = sources.length * presets.length;
  const warnings: string[] = [];
  const wallpapers: Wallpaper[] = [];

  let done = 0;
  let bytesOut = 0;
  let failed = 0;

  const nowIso = new Date().toISOString();

  for (let i = 0; i < sources.length; i += 1) {
    const sourceUrl = sources[i]!;

    let raw: Buffer | null = null;
    try {
      raw = await fetchBuffer(sourceUrl, { timeoutMs: 30_000, retries: 2, skipRobots: true });
    } catch (err) {
      warnings.push(`Could not download image ${i + 1}: ${err instanceof Error ? err.message : err}`);
    }

    if (!raw || raw.byteLength === 0) {
      failed += presets.length;
      done += presets.length;
      onProgress?.(done, total, `Skipped source ${i + 1}`);
      continue;
    }
    if (raw.byteLength > MAX_SOURCE_BYTES) {
      warnings.push(`Image ${i + 1} is too large (${(raw.byteLength / 1048576).toFixed(1)} MB) — skipped.`);
      failed += presets.length;
      done += presets.length;
      continue;
    }

    for (const preset of presets) {
      const { width, height } = WALLPAPER_PRESETS[preset];
      const resolution = `${width}x${height}`;

      const { meta } = await generateWallpaperMeta({
        gameName,
        category,
        index: i,
        resolution,
      });

      // Preset is part of the slug so phone/desktop variants never collide.
      const slug = slugify(`${meta.slug}-${preset}`);
      const basePath = `wallpapers/${gameSlug ?? slugify(gameName)}/${slug}`;

      const full = await render(raw, preset, `${basePath}.webp`, meta.altText);
      done += 1;
      onProgress?.(done, total, `${gameName} · ${preset} ${i + 1}/${sources.length}`);

      if (!full) {
        failed += 1;
        warnings.push(`Failed to render ${preset} variant of image ${i + 1}.`);
        continue;
      }

      // 640px-wide thumbnail for the gallery grid.
      const thumbBuf = await sharp(raw, { failOn: 'none' })
        .rotate()
        .resize({ width: 640, height: 360, fit: 'cover', position: sharp.strategy.attention })
        .webp({ quality: 74 })
        .toBuffer()
        .catch(() => null);

      let thumbnail: MediaAsset | null = null;
      if (thumbBuf) {
        const thumbUrl = await uploadToStorage(`${basePath}-thumb.webp`, thumbBuf, 'image/webp');
        if (thumbUrl) {
          thumbnail = {
            url: thumbUrl,
            width: 640,
            height: 360,
            bytes: thumbBuf.byteLength,
            format: 'webp',
            alt: meta.altText,
            blurDataUrl: full.asset.blurDataUrl,
          };
        }
      }

      bytesOut += full.bytes + (thumbnail?.bytes ?? 0);

      wallpapers.push({
        title: `${meta.title} (${WALLPAPER_PRESETS[preset].label.split(' ')[0]})`.slice(0, 138),
        slug,
        category: meta.category,
        tags: meta.tags,
        image: full.asset,
        thumbnail,
        resolution,
        width: full.width,
        height: full.height,
        downloads: 0,
        views: 0,
        featured: false,
        trending: false,
        gameSlug,
        sourceUrl,
        status: autoPublish ? 'published' : 'draft',
        publishedAt: autoPublish ? nowIso : null,
        scheduledFor: null,
        seo: {
          title: meta.seoTitle,
          description: meta.metaDescription,
          keywords: meta.keywords,
          canonical: null,
          ogTitle: meta.title.slice(0, 95),
          ogDescription: meta.metaDescription.slice(0, 198),
          ogImage: full.asset.url,
          twitterCard: 'summary_large_image',
          twitterTitle: meta.title.slice(0, 70),
          twitterDescription: meta.metaDescription.slice(0, 198),
          jsonLd: null,
          noindex: false,
        },
      });
    }
  }

  log.info(
    `wallpapers for "${gameName}": ${wallpapers.length}/${total} generated (${(bytesOut / 1024).toFixed(0)} KB)`,
  );

  return {
    wallpapers,
    attempted: total,
    succeeded: wallpapers.length,
    failed,
    bytesOut,
    warnings,
  };
}
