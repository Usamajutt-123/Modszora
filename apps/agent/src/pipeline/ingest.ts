import {
  ANDROID_VERSIONS,
  autoInternalLink,
  compareVersions,
  gameSlug,
  isNewerVersion,
  parseSizeToBytes,
  publishRequestSchema,
  truncate,
  uniqueSlug,
  type AndroidVersion,
  type Game,
  type PublishRequest,
  type PublishResponse,
  type Review,
  type ScrapedGame,
} from '@modverse/shared';
import { contentFingerprint } from '@modverse/shared/hash';
import { config, features } from '../config/index.js';
import { createLogger, errorMessage, type Logger } from '../core/logger.js';
import { FatalJobError } from '../core/queue.js';
import { scraperForUrl } from '../scrapers/adapters.js';
import { generateReview, generateSeoBundle } from '../services/openai.js';
import { ingestGameMedia } from '../services/images.js';
import { buildApkFileName, remoteUploadToMega } from '../services/multcloud.js';
import {
  findExistingGame,
  listTakenSlugs,
  recordGameVersion,
  recordTransfer,
  supabaseAvailable,
  type ExistingGame,
} from '../services/supabase.js';

const log = createLogger('pipeline');

export interface IngestOptions {
  url: string;
  autoPublish?: boolean;
  uploadToMega?: boolean;
  generateReviewToo?: boolean;
  /** Derive wallpapers from the game's screenshots after publishing. */
  generateWallpapers?: boolean;
  /** Queue a draft blog article about the game after publishing. */
  generateBlogDraft?: boolean;
  overrideCategory?: Game['category'] | null;
  dryRun?: boolean;
  jobId?: string | null;
  logger?: Logger;
  onProgress?: (pct: number, note: string) => void;
  signal?: AbortSignal;
}

export interface IngestResult {
  action: 'created' | 'updated' | 'skipped' | 'dry-run' | 'failed';
  slug?: string;
  gameId?: string | null;
  changes: string[];
  reason?: string;
  game?: Game;
  review?: Review | null;
  timings: Record<string, number>;
  seoSource?: 'openai' | 'fallback';
  megaUrl?: string | null;
  warnings: string[];
  /** Follow-up jobs queued after the game was published. */
  followUps: Array<{ type: string; jobId: string }>;
}

/** Maps a free-form Android version string onto our allowed enum. */
function normaliseAndroidVersion(raw: string | null | undefined): AndroidVersion {
  if (!raw) return '7.0+';
  const m = /(\d+)(?:\.(\d+))?/.exec(raw);
  if (!m) return '7.0+';
  const major = Number.parseInt(m[1] ?? '7', 10);
  const candidate = `${major}.0+`;
  if ((ANDROID_VERSIONS as readonly string[]).includes(candidate)) return candidate as AndroidVersion;
  if (major < 5) return '5.0+';
  if (major > 15) return '15.0+';
  return '7.0+';
}

/** Reasonable size fallback so the schema's positive-int rule always holds. */
function resolveSize(scraped: ScrapedGame): number {
  const bytes = scraped.sizeBytes ?? parseSizeToBytes(scraped.sizeText ?? null);
  if (bytes && bytes > 0) return bytes;
  return 80 * 1024 * 1024; // 80 MB placeholder; corrected on the next crawl
}

function toIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Compares a freshly scraped game against the stored record and returns a
 * human-readable change list. An empty list means "nothing to do".
 */
export function diffAgainstExisting(
  scraped: ScrapedGame,
  existing: ExistingGame,
  newFingerprint: string,
): { changes: string[]; isUpdate: boolean } {
  const changes: string[] = [];

  if (scraped.version && compareVersions(scraped.version, existing.version) !== 0) {
    const newer = isNewerVersion(scraped.version, existing.version);
    changes.push(`Version ${existing.version} → ${scraped.version}${newer ? '' : ' (downgrade reported upstream)'}`);
  }
  if (scraped.modVersion && scraped.modVersion !== existing.modVersion) {
    changes.push(`MOD version ${existing.modVersion ?? 'none'} → ${scraped.modVersion}`);
  }

  const newSize = scraped.sizeBytes ?? parseSizeToBytes(scraped.sizeText ?? null);
  if (newSize && existing.sizeBytes) {
    const deltaPct = Math.abs(newSize - existing.sizeBytes) / existing.sizeBytes;
    // Ignore sub-2% jitter from rounded "142 MB" style strings.
    if (deltaPct > 0.02) {
      changes.push(`Size ${(existing.sizeBytes / 1048576).toFixed(0)}MB → ${(newSize / 1048576).toFixed(0)}MB`);
    }
  }

  if (scraped.whatsNew && scraped.whatsNew.trim().length > 20) {
    changes.push("What's New updated");
  }

  const existingShots = existing.screenshots.length;
  if (scraped.screenshotUrls.length && Math.abs(scraped.screenshotUrls.length - existingShots) >= 2) {
    changes.push(`Screenshots ${existingShots} → ${scraped.screenshotUrls.length}`);
  }

  // The fingerprint is the authoritative signal; it covers every tracked field.
  const fingerprintChanged = existing.contentHash !== newFingerprint;
  if (fingerprintChanged && changes.length === 0) changes.push('Content fingerprint changed');

  return { changes, isUpdate: fingerprintChanged && changes.length > 0 };
}

/**
 * The full ingestion pipeline for a single game URL.
 *
 * Order matters: cheap checks (scrape → dedupe) run before expensive ones
 * (media processing → remote upload → LLM), so an unchanged game costs one
 * page fetch instead of a full pipeline run.
 */
export async function ingestUrl(opts: IngestOptions): Promise<IngestResult> {
  const {
    url,
    autoPublish = config.AGENT_AUTO_PUBLISH,
    uploadToMega = true,
    generateReviewToo = true,
    overrideCategory = null,
    generateWallpapers = false,
    generateBlogDraft = false,
    dryRun = config.AGENT_DRY_RUN,
    jobId = null,
    onProgress = () => undefined,
    signal,
  } = opts;

  const l = opts.logger ?? log;
  const timings: Record<string, number> = {};
  const warnings: string[] = [];
  const mark = (label: string, start: number) => {
    timings[label] = Date.now() - start;
  };

  /* ── 1. scrape ── */
  const t0 = Date.now();
  onProgress(4, 'Resolving source adapter');

  const scraper = scraperForUrl(url);
  if (!scraper) {
    throw new FatalJobError(`Unsupported source for URL: ${url}`);
  }
  l.info(`ingesting via ${scraper.source}: ${url}`);

  onProgress(8, `Scraping ${scraper.source}`);
  const scraped = await scraper.scrape(url);
  mark('scrape', t0);

  if (!scraped) {
    throw new Error(`Failed to extract any data from ${url}`);
  }
  if (overrideCategory) scraped.categoryHint = overrideCategory;

  l.info(`scraped "${scraped.title}" v${scraped.version ?? '?'} (${timings.scrape}ms)`);

  /* ── 2. duplicate detection (before any expensive work) ── */
  onProgress(16, 'Checking for existing listing');
  const tDedupe = Date.now();

  const provisionalSlug = gameSlug(scraped.title);
  const existing = await findExistingGame({
    packageName: scraped.packageName,
    slug: provisionalSlug,
    sourceUrl: url,
    name: scraped.title,
  });

  const fingerprint = contentFingerprint({
    packageName: scraped.packageName,
    version: scraped.version,
    modVersion: scraped.modVersion,
    sizeBytes: scraped.sizeBytes ?? parseSizeToBytes(scraped.sizeText ?? null),
    whatsNew: scraped.whatsNew,
    modFeatures: scraped.modFeatures,
    screenshots: scraped.screenshotUrls,
  });
  mark('dedupe', tDedupe);

  let mode: 'create' | 'update' = 'create';
  let changes: string[] = [];

  if (existing) {
    const diff = diffAgainstExisting(scraped, existing, fingerprint);
    if (!diff.isUpdate) {
      l.info(`no changes for "${existing.name}" — skipping (fingerprint match)`);
      return {
        action: 'skipped',
        slug: existing.slug,
        gameId: existing.id,
        changes: [],
        reason: 'Content unchanged since last crawl',
        timings,
        warnings,
        followUps: [],
      };
    }
    mode = 'update';
    changes = diff.changes;
    l.info(`update detected for "${existing.name}": ${changes.join('; ')}`);
  }

  if (signal?.aborted) throw new Error('Aborted');

  /* ── 3. SEO / content generation ── */
  onProgress(26, 'Generating SEO and descriptions');
  const tSeo = Date.now();
  const { bundle: seo, source: seoSource } = await generateSeoBundle(scraped);
  mark('seo', tSeo);

  // Preserve the original slug on updates so URLs never change.
  let slug = existing?.slug ?? seo.slug;
  if (!existing) {
    const taken = await listTakenSlugs(slug.slice(0, Math.min(slug.length, 24)));
    slug = uniqueSlug(slug, taken);
  }

  /* ── 4. media pipeline ── */
  onProgress(38, 'Downloading and compressing images');
  const tMedia = Date.now();
  const media = await ingestGameMedia({
    slug,
    gameName: scraped.title,
    iconUrl: scraped.iconUrl,
    bannerUrl: scraped.bannerUrl ?? scraped.iconUrl,
    screenshotUrls: scraped.screenshotUrls,
    onProgress: (done, total) => {
      if (total > 0) onProgress(38 + Math.round((done / total) * 14), `Images ${done}/${total}`);
    },
  });
  mark('media', tMedia);
  if (media.stats.attempted > 0 && media.stats.succeeded === 0) {
    warnings.push('No images could be processed — listing will use placeholders');
  }

  if (signal?.aborted) throw new Error('Aborted');

  /* ── 5. remote upload to Mega ── */
  let megaUrl: string | null = existing?.megaUrl ?? null;
  const apkSource = scraped.modApkUrl ?? scraped.originalApkUrl;

  if (uploadToMega && apkSource && !dryRun) {
    onProgress(56, 'Remote uploading APK to Mega');
    const tUpload = Date.now();
    const transfer = await remoteUploadToMega({
      sourceUrl: apkSource,
      fileName: buildApkFileName(scraped.title, scraped.version ?? '1.0'),
      onProgress: (pct, note) => onProgress(56 + Math.round(pct * 0.24), note),
      signal,
    });
    mark('upload', tUpload);

    if (transfer.ok && transfer.megaUrl) {
      megaUrl = transfer.megaUrl;
    } else if (transfer.skipped) {
      warnings.push('MultCloud not configured — using direct MOD link instead of Mega');
    } else {
      warnings.push(`Mega upload failed: ${transfer.error ?? 'unknown error'}`);
      l.warn(`mega upload failed for "${scraped.title}": ${transfer.error}`);
    }

    if (supabaseAvailable()) {
      await recordTransfer({
        jobId,
        gameId: existing?.id ?? null,
        sourceUrl: apkSource,
        taskId: transfer.taskId ?? null,
        status: transfer.ok ? 'completed' : transfer.skipped ? 'skipped' : 'failed',
        progress: transfer.ok ? 100 : 0,
        bytesTotal: transfer.bytesTotal ?? null,
        megaUrl: transfer.megaUrl ?? null,
        error: transfer.error ?? null,
      }).catch(() => undefined);
    }
  } else if (dryRun && apkSource) {
    l.info('dry run — skipping Mega upload');
  }

  /* ── 6. assemble the record ── */
  onProgress(84, 'Assembling listing');

  const sizeBytes = resolveSize(scraped);
  const nowIso = new Date().toISOString();
  const siteUrl = config.MODVERSE_SITE_URL.replace(/\/+$/, '');

  // Auto internal linking: turn known anchors into real links inside the copy.
  const description = seo.internalLinkAnchors.length
    ? autoInternalLink(
        seo.longDescription,
        seo.internalLinkAnchors.map((anchor) => ({ anchor, href: `/search?q=${encodeURIComponent(anchor)}` })),
      )
    : seo.longDescription;

  const downloadLinks: Game['downloadLinks'] = [];
  if (megaUrl) downloadLinks.push({ label: 'Mega (Fast)', url: megaUrl, kind: 'mega', sizeBytes, isPrimary: true });
  if (scraped.modApkUrl) {
    downloadLinks.push({
      label: 'Mirror Server',
      url: scraped.modApkUrl,
      kind: 'mirror',
      sizeBytes,
      isPrimary: !megaUrl,
    });
  }
  if (scraped.playStoreUrl) {
    downloadLinks.push({ label: 'Google Play (Original)', url: scraped.playStoreUrl, kind: 'playstore', isPrimary: false });
  }

  const ogImage = media.banner?.url ?? media.icon?.url ?? null;

  const game: Game = {
    name: scraped.title,
    originalName: scraped.originalName ?? scraped.title,
    slug,
    version: scraped.version ?? '1.0',
    modVersion: scraped.modVersion ?? null,
    packageName: scraped.packageName ?? `com.modverse.${slug.replace(/-/g, '')}`.slice(0, 150),
    developer: scraped.developer ?? 'Unknown Developer',
    publisher: scraped.publisher ?? scraped.developer ?? null,
    category: overrideCategory ?? seo.category,
    genres: seo.genres,
    tags: seo.tags,
    collections: seo.collections,
    androidVersion: normaliseAndroidVersion(scraped.androidVersion),
    requirements: scraped.requirements ?? `Android ${normaliseAndroidVersion(scraped.androidVersion).replace('+', '')} or higher`,
    sizeBytes,
    rating: scraped.rating ?? 0,
    ratingCount: 0,
    downloads: 0,
    views: 0,
    shortDescription: seo.shortDescription,
    description,
    modFeatures: seo.modFeatures,
    whatsNew: scraped.whatsNew ?? null,
    installationGuide: seo.installationGuide,
    releaseDate: toIsoDate(scraped.releaseDate),
    updatedDate: toIsoDate(scraped.updatedDate) ?? nowIso,
    status: autoPublish ? 'published' : 'draft',
    publishedAt: autoPublish ? nowIso : null,
    scheduledFor: null,
    featured: false,
    icon: media.icon,
    banner: media.banner,
    screenshots: media.screenshots,
    downloadLinks,
    virusScan: {
      provider: 'internal',
      status: 'unscanned',
      scannedAt: null,
      reportUrl: null,
      detections: 0,
      engines: 0,
      sha256: null,
    },
    faqs: seo.faqs,
    seo: {
      title: seo.seoTitle,
      description: seo.metaDescription,
      keywords: seo.keywords,
      canonical: `${siteUrl}/game/${slug}`,
      ogTitle: seo.ogTitle,
      ogDescription: seo.ogDescription,
      ogImage,
      twitterCard: 'summary_large_image',
      twitterTitle: seo.twitterTitle,
      twitterDescription: seo.twitterDescription,
      jsonLd: null,
      noindex: false,
    },
    playStoreUrl: scraped.playStoreUrl ?? null,
    originalApkUrl: scraped.originalApkUrl ?? null,
    modApkUrl: scraped.modApkUrl ?? null,
    megaUrl,
    sourceSite: scraped.source,
    sourceUrl: url,
    contentHash: fingerprint,
  };

  /* ── 7. optional review ── */
  let review: Review | null = null;
  if (generateReviewToo && mode === 'create') {
    onProgress(90, 'Writing editorial review');
    const tReview = Date.now();
    const generated = await generateReview(scraped, seo);
    mark('review', tReview);

    if (generated) {
      const r = generated.bundle;
      review = {
        title: r.title,
        slug: `${slug.replace(/-mod-apk$/, '')}-review`,
        gameSlug: slug,
        summary: r.summary,
        body: r.body,
        score: r.score,
        scoreBreakdown: r.scoreBreakdown,
        pros: r.pros,
        cons: r.cons,
        verdict: r.verdict,
        gameplay: null,
        graphics: null,
        performance: null,
        cover: media.banner,
        author: 'MODVerse Editorial',
        featured: false,
        status: autoPublish ? 'published' : 'draft',
        publishedAt: autoPublish ? nowIso : null,
        scheduledFor: null,
        seo: {
          title: truncate(`${scraped.title} Review — ${r.score.toFixed(1)}/10`, 70),
          description: truncate(r.summary, 178),
          keywords: [`${scraped.title.toLowerCase()} review`, 'mod apk review', `${seo.category} game review`],
          canonical: null,
          ogTitle: truncate(r.title, 95),
          ogDescription: truncate(r.summary, 198),
          ogImage,
          twitterCard: 'summary_large_image',
          twitterTitle: truncate(r.title, 70),
          twitterDescription: truncate(r.summary, 198),
          jsonLd: null,
          noindex: false,
        },
      };
    }
  }

  /* ── 8. publish ── */
  if (dryRun) {
    onProgress(100, 'Dry run complete');
    l.info(`DRY RUN — would ${mode} "${game.name}" (${slug})`);
    return {
      action: 'dry-run',
      slug,
      gameId: existing?.id ?? null,
      changes: changes.length ? changes : ['New listing'],
      game,
      review,
      timings,
      seoSource,
      megaUrl,
      warnings,
      followUps: [],
    };
  }

  onProgress(94, 'Publishing to MODVerse');
  const tPublish = Date.now();
  const response = await publishToSite({ mode: mode === 'update' ? 'update' : 'create', game, review, changes, jobId });
  mark('publish', tPublish);

  if (!response.ok) {
    throw new Error(response.message ?? 'Publish rejected by the website');
  }

  if (existing && response.action === 'updated') {
    await recordGameVersion({
      gameId: existing.id,
      version: game.version,
      modVersion: game.modVersion,
      sizeBytes: game.sizeBytes,
      whatsNew: game.whatsNew,
      megaUrl: game.megaUrl,
      modApkUrl: game.modApkUrl,
      contentHash: fingerprint,
      changes,
    }).catch(() => undefined);
  }

  /* ── 9. follow-up content generation ── */
  //
  // Queued rather than awaited: the game listing is already live and useful,
  // and wallpaper rendering plus article writing can take minutes. Failures
  // here must never roll back a successful publish.
  const followUps: Array<{ type: string; jobId: string }> = [];
  const publishedSlug = response.slug ?? slug;

  if (generateWallpapers && mode === 'create' && media.screenshots.length > 0) {
    try {
      const { queue } = await import('../core/queue.js');
      const job = queue.enqueue({
        type: 'wallpaper-generate',
        payload: {
          gameSlug: publishedSlug,
          gameName: game.name,
          presets: ['phone', 'desktop'],
          autoPublish,
          maxCount: 4,
          dryRun: false,
        },
        priority: 3,
        dedupe: false,
      });
      followUps.push({ type: 'wallpaper-generate', jobId: job.id });
      l.info(`queued wallpaper generation for ${publishedSlug}`);
    } catch (err) {
      warnings.push(`Could not queue wallpaper generation: ${errorMessage(err)}`);
    }
  }

  if (generateBlogDraft && mode === 'create') {
    try {
      const { queue } = await import('../core/queue.js');
      const job = queue.enqueue({
        type: 'blog-generate',
        payload: {
          template: 'how-to-install',
          topic: `How to Install ${game.name} MOD APK on Android`,
          gameSlug: publishedSlug,
          gameNames: [game.name],
          category: 'guides',
          isNews: false,
          wordCount: 900,
          autoPublish: false,
          dryRun: false,
        },
        priority: 2,
        dedupe: false,
      });
      followUps.push({ type: 'blog-generate', jobId: job.id });
      l.info(`queued blog draft for ${publishedSlug}`);
    } catch (err) {
      warnings.push(`Could not queue blog draft: ${errorMessage(err)}`);
    }
  }

  onProgress(100, 'Published');
  l.info(`${response.action} "${game.name}" → /game/${publishedSlug}`);

  return {
    action: response.action === 'updated' ? 'updated' : 'created',
    slug: publishedSlug,
    gameId: response.gameId ?? existing?.id ?? null,
    changes: changes.length ? changes : ['New listing'],
    game,
    review,
    timings,
    seoSource,
    megaUrl,
    warnings,
    followUps,
  };
}

/** POSTs the assembled listing to the website's authenticated agent API. */
export async function publishToSite(input: {
  mode: 'create' | 'update' | 'upsert';
  game: Game;
  review?: Review | null;
  changes: string[];
  jobId?: string | null;
}): Promise<PublishResponse> {
  if (!features.publishing) {
    return { ok: false, action: 'skipped', changes: [], message: 'AGENT_API_KEY is not configured' };
  }

  const payload: PublishRequest = {
    mode: input.mode,
    dryRun: false,
    jobId: input.jobId ?? null,
    game: input.game,
    review: input.review ?? null,
    changeSummary: input.changes,
  };

  // Validate before sending so a bad record fails here with a clear message
  // rather than as an opaque 422 from the API.
  const validated = publishRequestSchema.safeParse(payload);
  if (!validated.success) {
    const issues = validated.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new FatalJobError(`Assembled listing failed validation → ${issues.join(' | ')}`);
  }

  try {
    const res = await fetch(config.MODVERSE_PUBLISH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.AGENT_API_KEY}`,
      },
      body: JSON.stringify(validated.data),
      signal: AbortSignal.timeout(120_000),
    });

    const body = (await res.json().catch(() => null)) as PublishResponse | null;

    if (!res.ok) {
      return {
        ok: false,
        action: 'skipped',
        changes: [],
        message: body?.message ?? `Publish endpoint returned HTTP ${res.status}`,
      };
    }
    return body ?? { ok: false, action: 'skipped', changes: [], message: 'Empty response from publish endpoint' };
  } catch (err) {
    return { ok: false, action: 'skipped', changes: [], message: `Publish request failed: ${errorMessage(err)}` };
  }
}
