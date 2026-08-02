import {
  blogPostSchema,
  readingMinutes,
  slugify,
  truncate,
  wallpaperSchema,
  type BlogPost,
  type BlogTemplate,
  type ContentPublishResponse,
  type Wallpaper,
  type WallpaperCategory,
  type WallpaperPreset,
} from '@modverse/shared';
import { config, features } from '../config/index.js';
import { createLogger, errorMessage } from '../core/logger.js';
import { queue, type JobContext } from '../core/queue.js';
import { generateBlogArticle } from '../services/content-ai.js';
import { generateWallpapersFromImages } from '../services/wallpapers.js';
import { runContentAnalysis } from '../services/suggestions.js';
import { getDb } from '../services/supabase.js';

const log = createLogger('content-jobs');

/**
 * Jobs for the non-game content types: blog articles, wallpapers derived
 * from game screenshots, and the content-health analysis that powers the
 * AI suggestions dashboard.
 *
 * Publishing goes through the website's authenticated content API, exactly
 * like the game pipeline, so validation and cache invalidation happen in one
 * place regardless of which side initiated the write.
 */

const CONTENT_ENDPOINT = config.MODVERSE_PUBLISH_URL.replace(/\/publish$/, '/content');

async function publishContent(
  kind: 'wallpaper' | 'review' | 'post',
  data: unknown,
  dryRun: boolean,
): Promise<ContentPublishResponse> {
  if (dryRun) {
    return { ok: true, action: 'dry-run', message: 'Dry run — nothing written.' };
  }
  if (!features.publishing) {
    return { ok: false, action: 'skipped', message: 'AGENT_API_KEY is not configured.' };
  }

  try {
    const res = await fetch(CONTENT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.AGENT_API_KEY}`,
      },
      body: JSON.stringify({ kind, dryRun: false, data }),
      signal: AbortSignal.timeout(90_000),
    });
    const body = (await res.json().catch(() => null)) as ContentPublishResponse | null;
    if (!res.ok) {
      return { ok: false, action: 'skipped', message: body?.message ?? `Content API returned HTTP ${res.status}` };
    }
    return body ?? { ok: false, action: 'skipped', message: 'Empty response from content API.' };
  } catch (err) {
    return { ok: false, action: 'skipped', message: `Content API request failed: ${errorMessage(err)}` };
  }
}

/* ═══════════════════════ blog generation ═══════════════════════ */

export interface BlogJobPayload {
  template: BlogTemplate;
  topic?: string | null;
  gameSlug?: string | null;
  gameNames?: string[];
  category?: string;
  isNews?: boolean;
  wordCount?: number;
  autoPublish?: boolean;
  dryRun?: boolean;
}

async function runBlogGeneration(ctx: JobContext<BlogJobPayload>) {
  const p = ctx.job.payload;
  const dryRun = p.dryRun ?? config.AGENT_DRY_RUN;

  ctx.setProgress(10, 'Gathering context');

  // Pull real game names so top-lists reference the actual catalogue.
  let gameNames = p.gameNames ?? [];
  if (!gameNames.length) {
    const db = getDb();
    if (db) {
      const query = db.from('games').select('name').eq('status', 'published');
      const { data } = p.gameSlug
        ? await query.eq('slug', p.gameSlug).limit(1)
        : await query.order('downloads', { ascending: false }).limit(12);
      gameNames = (data ?? []).map((r: { name: string }) => r.name);
    }
  }

  ctx.setProgress(30, 'Writing the article');
  const { bundle, source } = await generateBlogArticle({
    template: p.template,
    topic: p.topic ?? null,
    gameNames,
    category: (p.category as never) ?? (p.isNews ? 'news' : 'guides'),
    isNews: p.isNews ?? false,
    wordCount: p.wordCount ?? 1100,
  });

  ctx.setProgress(70, 'Assembling the post');
  const nowIso = new Date().toISOString();
  const autoPublish = p.autoPublish ?? false;

  const post: BlogPost = {
    title: bundle.title,
    slug: bundle.slug,
    category: bundle.category,
    excerpt: bundle.excerpt,
    content: bundle.content,
    cover: null,
    gallery: [],
    tags: bundle.tags,
    author: 'MODVerse Editorial',
    readingMinutes: bundle.readingMinutes || readingMinutes(bundle.content.replace(/<[^>]+>/g, ' ')),
    featured: false,
    views: 0,
    isNews: p.isNews ?? false,
    relatedGameSlug: p.gameSlug ?? null,
    status: autoPublish ? 'published' : 'draft',
    publishedAt: autoPublish ? nowIso : null,
    scheduledFor: null,
    seo: {
      title: bundle.seoTitle,
      description: bundle.metaDescription,
      keywords: bundle.keywords,
      canonical: null,
      ogTitle: truncate(bundle.title, 95),
      ogDescription: truncate(bundle.excerpt, 198),
      ogImage: null,
      twitterCard: 'summary_large_image',
      twitterTitle: truncate(bundle.title, 70),
      twitterDescription: truncate(bundle.excerpt, 198),
      jsonLd: null,
      noindex: false,
    },
  };

  const validated = blogPostSchema.safeParse(post);
  if (!validated.success) {
    throw new Error(
      `Generated post failed validation: ${validated.error.issues
        .slice(0, 4)
        .map((i) => `${i.path.join('.')} ${i.message}`)
        .join('; ')}`,
    );
  }

  ctx.setProgress(88, dryRun ? 'Dry run' : 'Publishing');
  const result = await publishContent('post', validated.data, dryRun);

  ctx.setProgress(100, 'Done');
  log.info(`blog "${bundle.title}" → ${result.action} (${source})`);

  return {
    action: result.action,
    slug: result.slug ?? bundle.slug,
    title: bundle.title,
    template: p.template,
    aiSource: source,
    words: bundle.content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
    message: result.message,
    post: dryRun ? validated.data : undefined,
  };
}

/* ═══════════════════════ wallpaper generation ═══════════════════════ */

export interface WallpaperJobPayload {
  gameSlug?: string | null;
  gameName?: string | null;
  sourceUrls?: string[];
  presets?: WallpaperPreset[];
  category?: WallpaperCategory;
  autoPublish?: boolean;
  maxCount?: number;
  dryRun?: boolean;
}

async function runWallpaperGeneration(ctx: JobContext<WallpaperJobPayload>) {
  const p = ctx.job.payload;
  const dryRun = p.dryRun ?? config.AGENT_DRY_RUN;

  ctx.setProgress(6, 'Resolving source images');

  let sourceUrls = p.sourceUrls ?? [];
  let gameName = p.gameName ?? '';
  let category: WallpaperCategory = p.category ?? 'action';

  // Pull screenshots straight from the game record when none were supplied.
  if (!sourceUrls.length && p.gameSlug) {
    const db = getDb();
    if (!db) throw new Error('Supabase is required to read game screenshots.');

    const { data } = await db
      .from('games')
      .select('name, category, screenshots, banner')
      .eq('slug', p.gameSlug)
      .maybeSingle();

    if (!data) throw new Error(`Game "${p.gameSlug}" was not found.`);

    gameName = gameName || data.name;
    const shots = Array.isArray(data.screenshots) ? data.screenshots : [];
    sourceUrls = shots.map((s: { url: string }) => s.url).filter(Boolean);
    if (data.banner?.url) sourceUrls.unshift(data.banner.url);

    // Map the game category onto the wallpaper taxonomy where they overlap.
    const MAP: Record<string, WallpaperCategory> = {
      action: 'action',
      racing: 'racing',
      rpg: 'fantasy',
      adventure: 'fantasy',
      shooter: 'action',
      strategy: 'sci-fi',
      horror: 'characters',
    };
    category = p.category ?? MAP[data.category] ?? 'action';
  }

  if (!sourceUrls.length) throw new Error('No source images available to generate wallpapers from.');
  if (!gameName) gameName = p.gameSlug ?? 'Game';

  ctx.setProgress(14, `Rendering ${sourceUrls.length} source image(s)`);

  const result = await generateWallpapersFromImages({
    gameName,
    gameSlug: p.gameSlug ?? null,
    sourceUrls,
    presets: p.presets ?? ['phone', 'desktop'],
    category,
    autoPublish: p.autoPublish ?? false,
    maxCount: p.maxCount ?? 6,
    onProgress: (done, total, note) => {
      if (total > 0) ctx.setProgress(14 + Math.round((done / total) * 68), note);
    },
  });

  if (!result.wallpapers.length) {
    throw new Error(
      `No wallpapers could be generated. ${result.warnings.slice(0, 2).join(' ') || 'All source images failed.'}`,
    );
  }

  ctx.setProgress(86, dryRun ? 'Dry run' : `Publishing ${result.wallpapers.length} wallpapers`);

  const published: string[] = [];
  const failures: string[] = [];

  for (const wallpaper of result.wallpapers) {
    const validated = wallpaperSchema.safeParse(wallpaper as Wallpaper);
    if (!validated.success) {
      failures.push(`${wallpaper.slug}: schema validation failed`);
      continue;
    }
    const res = await publishContent('wallpaper', validated.data, dryRun);
    if (res.ok) published.push(res.slug ?? wallpaper.slug);
    else failures.push(`${wallpaper.slug}: ${res.message ?? 'publish failed'}`);
  }

  ctx.setProgress(100, 'Done');
  log.info(`wallpapers for "${gameName}": ${published.length} published, ${failures.length} failed`);

  return {
    action: dryRun ? 'dry-run' : 'created',
    gameName,
    gameSlug: p.gameSlug ?? null,
    generated: result.succeeded,
    published: published.length,
    failed: failures.length,
    bytesOut: result.bytesOut,
    slugs: published,
    warnings: [...result.warnings, ...failures].slice(0, 10),
    wallpapers: dryRun ? result.wallpapers.slice(0, 3) : undefined,
  };
}

/* ═══════════════════════ content analysis ═══════════════════════ */

export interface AnalysisJobPayload {
  only?: string[];
}

async function runAnalysis(ctx: JobContext<AnalysisJobPayload>) {
  const result = await runContentAnalysis({
    only: ctx.job.payload.only,
    onProgress: (done, total, note) => ctx.setProgress(Math.round((done / total) * 95), note),
  });

  ctx.setProgress(100, 'Done');

  const byKind: Record<string, number> = {};
  for (const s of result.suggestions) byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;

  return {
    suggestions: result.suggestions.length,
    byKind,
    checksRun: result.checksRun,
    errors: result.errors,
    top: result.suggestions.sort((a, b) => b.score - a.score).slice(0, 15),
  };
}

/* ═══════════════════════ registration ═══════════════════════ */

export function registerContentJobs(): void {
  queue.register('blog-generate', runBlogGeneration as never);
  queue.register('wallpaper-generate', runWallpaperGeneration as never);
  queue.register('content-analysis', runAnalysis as never);
  log.info('registered 3 content job handlers');
}

export const contentRunners = { runBlogGeneration, runWallpaperGeneration, runAnalysis };
export { publishContent };
