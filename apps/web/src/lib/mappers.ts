import type { BlogPost, GameRecord, Review, Wallpaper } from '@modverse/shared';

/**
 * Postgres rows are snake_case; the app speaks camelCase.
 * These mappers are the only place that translation happens.
 */

type Row = Record<string, any>;

const arr = <T,>(v: unknown, fallback: T[] = []): T[] => (Array.isArray(v) ? (v as T[]) : fallback);

export function rowToGame(row: Row): GameRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    originalName: row.original_name ?? null,
    version: row.version ?? '1.0',
    modVersion: row.mod_version ?? null,
    packageName: row.package_name,
    developer: row.developer,
    publisher: row.publisher ?? null,
    category: row.category,
    genres: arr<string>(row.genres),
    tags: arr<string>(row.tags),
    collections: arr(row.collections),
    androidVersion: row.android_version,
    requirements: row.requirements ?? null,
    sizeBytes: Number(row.size_bytes ?? 0),
    rating: Number(row.rating ?? 0),
    ratingCount: Number(row.rating_count ?? 0),
    downloads: Number(row.downloads ?? 0),
    views: Number(row.views ?? 0),
    shortDescription: row.short_description ?? '',
    description: row.description ?? '',
    modFeatures: arr<string>(row.mod_features),
    whatsNew: row.whats_new ?? null,
    installationGuide: arr<string>(row.installation_guide),
    releaseDate: row.release_date ?? null,
    updatedDate: row.updated_date ?? null,
    status: row.status ?? 'draft',
    publishedAt: row.published_at ?? null,
    scheduledFor: row.scheduled_for ?? null,
    featured: Boolean(row.featured),
    icon: row.icon ?? null,
    banner: row.banner ?? null,
    screenshots: arr(row.screenshots),
    downloadLinks: arr(row.download_links),
    virusScan: row.virus_scan ?? null,
    faqs: arr(row.faqs),
    seo: row.seo ?? {
      title: row.name,
      description: row.short_description ?? '',
      keywords: [],
      twitterCard: 'summary_large_image',
      noindex: false,
    },
    playStoreUrl: row.play_store_url ?? null,
    originalApkUrl: row.original_apk_url ?? null,
    modApkUrl: row.mod_apk_url ?? null,
    megaUrl: row.mega_url ?? null,
    sourceSite: row.source_site ?? null,
    sourceUrl: row.source_url ?? null,
    contentHash: row.content_hash ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as GameRecord;
}

export function gameToRow(game: Partial<GameRecord>): Row {
  const row: Row = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };
  set('slug', game.slug);
  set('name', game.name);
  set('original_name', game.originalName);
  set('version', game.version);
  set('mod_version', game.modVersion);
  set('package_name', game.packageName);
  set('developer', game.developer);
  set('publisher', game.publisher);
  set('category', game.category);
  set('genres', game.genres);
  set('tags', game.tags);
  set('collections', game.collections);
  set('android_version', game.androidVersion);
  set('requirements', game.requirements);
  set('size_bytes', game.sizeBytes);
  set('rating', game.rating);
  set('rating_count', game.ratingCount);
  set('downloads', game.downloads);
  set('views', game.views);
  set('short_description', game.shortDescription);
  set('description', game.description);
  set('mod_features', game.modFeatures);
  set('whats_new', game.whatsNew);
  set('installation_guide', game.installationGuide);
  set('release_date', game.releaseDate);
  set('updated_date', game.updatedDate);
  set('status', game.status);
  set('published_at', game.publishedAt);
  set('scheduled_for', game.scheduledFor);
  set('featured', game.featured);
  set('icon', game.icon);
  set('banner', game.banner);
  set('screenshots', game.screenshots);
  set('download_links', game.downloadLinks);
  set('virus_scan', game.virusScan);
  set('faqs', game.faqs);
  set('seo', game.seo);
  set('play_store_url', game.playStoreUrl);
  set('original_apk_url', game.originalApkUrl);
  set('mod_apk_url', game.modApkUrl);
  set('mega_url', game.megaUrl);
  set('source_site', game.sourceSite);
  set('source_url', game.sourceUrl);
  set('content_hash', game.contentHash);
  return row;
}

export function rowToWallpaper(row: Row): Wallpaper & { id: string; createdAt: string } {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    tags: arr<string>(row.tags),
    image: row.image,
    thumbnail: row.thumbnail ?? null,
    resolution: row.resolution ?? '1920x1080',
    width: row.width ?? row.image?.width ?? null,
    height: row.height ?? row.image?.height ?? null,
    downloads: Number(row.downloads ?? 0),
    views: Number(row.views ?? 0),
    featured: Boolean(row.featured),
    trending: Boolean(row.trending),
    gameSlug: row.game_slug ?? null,
    sourceUrl: row.source_url ?? null,
    status: row.status ?? 'published',
    publishedAt: row.published_at ?? null,
    scheduledFor: row.scheduled_for ?? null,
    seo: row.seo ?? {},
    createdAt: row.created_at,
  } as Wallpaper & { id: string; createdAt: string };
}

export function rowToReview(row: Row): Review & { id: string } {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    gameSlug: row.game_slug ?? null,
    summary: row.summary ?? '',
    body: row.body ?? '',
    score: Number(row.score ?? 0),
    scoreBreakdown: row.score_breakdown ?? null,
    pros: arr<string>(row.pros),
    cons: arr<string>(row.cons),
    verdict: row.verdict ?? '',
    gameplay: row.gameplay ?? null,
    graphics: row.graphics ?? null,
    performance: row.performance ?? null,
    cover: row.cover ?? null,
    author: row.author ?? 'MODSzora Editorial',
    featured: Boolean(row.featured),
    status: row.status ?? 'published',
    publishedAt: row.published_at ?? null,
    scheduledFor: row.scheduled_for ?? null,
    seo: row.seo ?? {},
  } as Review & { id: string };
}

export function rowToPost(row: Row): BlogPost & { id: string } {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    excerpt: row.excerpt ?? '',
    content: row.content ?? '',
    cover: row.cover ?? null,
    gallery: arr(row.gallery),
    tags: arr<string>(row.tags),
    author: row.author ?? 'MODSzora Editorial',
    readingMinutes: Number(row.reading_minutes ?? 4),
    featured: Boolean(row.featured),
    views: Number(row.views ?? 0),
    isNews: Boolean(row.is_news),
    relatedGameSlug: row.related_game_slug ?? null,
    status: row.status ?? 'draft',
    publishedAt: row.published_at ?? null,
    scheduledFor: row.scheduled_for ?? null,
    seo: row.seo ?? {},
  } as BlogPost & { id: string };
}
