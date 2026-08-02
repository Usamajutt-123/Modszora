import { z } from 'zod';
import {
  AGENT_SOURCES,
  ANDROID_VERSIONS,
  BLOG_CATEGORIES,
  BLOG_TEMPLATES,
  MEDIA_FOLDERS,
  SUGGESTION_KINDS,
  GAME_CATEGORIES,
  GAME_COLLECTIONS,
  JOB_STATUSES,
  JOB_TYPES,
  LOG_LEVELS,
  MAX_PAGE_SIZE,
  PUBLISH_STATUSES,
  SORT_OPTIONS,
  WALLPAPER_CATEGORIES,
} from './constants.js';

/* ─────────────────────────── primitives ─────────────────────────── */

export const slugSchema = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase, alphanumeric and hyphen separated');

export const packageNameSchema = z
  .string()
  .min(3)
  .max(160)
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/, 'Invalid Android package name');

export const urlSchema = z.string().url().max(2048);
export const isoDateSchema = z.string().datetime({ offset: true }).or(z.string().date());

/* ─────────────────────────── SEO ─────────────────────────── */

export const seoSchema = z.object({
  title: z.string().min(10).max(70),
  description: z.string().min(50).max(180),
  keywords: z.array(z.string().min(2).max(60)).min(3).max(25),
  canonical: urlSchema.optional().nullable(),
  ogTitle: z.string().max(95).optional().nullable(),
  ogDescription: z.string().max(200).optional().nullable(),
  ogImage: urlSchema.optional().nullable(),
  twitterCard: z.enum(['summary', 'summary_large_image']).default('summary_large_image'),
  twitterTitle: z.string().max(70).optional().nullable(),
  twitterDescription: z.string().max(200).optional().nullable(),
  jsonLd: z.record(z.unknown()).optional().nullable(),
  noindex: z.boolean().default(false),
});
export type Seo = z.infer<typeof seoSchema>;

export const faqItemSchema = z.object({
  question: z.string().min(8).max(220),
  answer: z.string().min(20).max(1200),
});
export type FaqItem = z.infer<typeof faqItemSchema>;

/* ─────────────────────────── media ─────────────────────────── */

export const mediaAssetSchema = z.object({
  url: urlSchema,
  width: z.number().int().positive().optional().nullable(),
  height: z.number().int().positive().optional().nullable(),
  alt: z.string().max(220).optional().nullable(),
  bytes: z.number().int().nonnegative().optional().nullable(),
  format: z.enum(['webp', 'avif', 'png', 'jpeg']).default('webp'),
  blurDataUrl: z.string().max(4000).optional().nullable(),
});
export type MediaAsset = z.infer<typeof mediaAssetSchema>;

/* ─────────────────────────── downloads ─────────────────────────── */

export const downloadLinkSchema = z.object({
  label: z.string().min(2).max(60),
  url: urlSchema,
  kind: z.enum(['mega', 'mirror', 'direct', 'playstore', 'original', 'multcloud']),
  sizeBytes: z.number().int().nonnegative().optional().nullable(),
  isPrimary: z.boolean().default(false),
  verifiedAt: z.string().optional().nullable(),
});
export type DownloadLink = z.infer<typeof downloadLinkSchema>;

export const virusScanSchema = z.object({
  provider: z.string().max(60).default('internal'),
  status: z.enum(['clean', 'suspicious', 'unscanned', 'failed']).default('unscanned'),
  scannedAt: z.string().optional().nullable(),
  reportUrl: urlSchema.optional().nullable(),
  detections: z.number().int().nonnegative().default(0),
  engines: z.number().int().nonnegative().default(0),
  sha256: z.string().length(64).optional().nullable(),
});
export type VirusScan = z.infer<typeof virusScanSchema>;

/* ─────────────────────────── game ─────────────────────────── */

export const gameCoreSchema = z.object({
  name: z.string().min(2).max(160),
  originalName: z.string().max(160).optional().nullable(),
  slug: slugSchema,
  version: z.string().min(1).max(48),
  modVersion: z.string().max(64).optional().nullable(),
  packageName: packageNameSchema,
  developer: z.string().min(1).max(120),
  publisher: z.string().max(120).optional().nullable(),
  category: z.enum(GAME_CATEGORIES),
  genres: z.array(z.string().min(2).max(40)).max(12).default([]),
  tags: z.array(z.string().min(2).max(40)).max(24).default([]),
  collections: z.array(z.enum(GAME_COLLECTIONS)).max(8).default([]),
  androidVersion: z.enum(ANDROID_VERSIONS),
  requirements: z.string().max(400).optional().nullable(),
  sizeBytes: z.number().int().positive(),
  rating: z.number().min(0).max(5).default(0),
  ratingCount: z.number().int().nonnegative().default(0),
  downloads: z.number().int().nonnegative().default(0),
  views: z.number().int().nonnegative().default(0),
  shortDescription: z.string().min(40).max(320),
  description: z.string().min(120).max(20000),
  modFeatures: z.array(z.string().min(3).max(200)).min(1).max(30),
  whatsNew: z.string().max(4000).optional().nullable(),
  installationGuide: z.array(z.string().min(5).max(400)).max(20).default([]),
  releaseDate: z.string().optional().nullable(),
  updatedDate: z.string().optional().nullable(),
  status: z.enum(PUBLISH_STATUSES).default('draft'),
  publishedAt: z.string().optional().nullable(),
  scheduledFor: z.string().optional().nullable(),
  featured: z.boolean().default(false),
  playStoreUrl: urlSchema.optional().nullable(),
  originalApkUrl: urlSchema.optional().nullable(),
  modApkUrl: urlSchema.optional().nullable(),
  megaUrl: urlSchema.optional().nullable(),
  sourceSite: z.enum(AGENT_SOURCES).optional().nullable(),
  sourceUrl: urlSchema.optional().nullable(),
  contentHash: z.string().max(128).optional().nullable(),
});

export const gameSchema = gameCoreSchema.extend({
  icon: mediaAssetSchema.optional().nullable(),
  banner: mediaAssetSchema.optional().nullable(),
  screenshots: z.array(mediaAssetSchema).max(20).default([]),
  downloadLinks: z.array(downloadLinkSchema).max(12).default([]),
  virusScan: virusScanSchema.optional().nullable(),
  faqs: z.array(faqItemSchema).max(12).default([]),
  seo: seoSchema,
});
export type GameInput = z.input<typeof gameSchema>;
export type Game = z.infer<typeof gameSchema>;

export const gameRecordSchema = gameSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GameRecord = z.infer<typeof gameRecordSchema>;

/* ─────────────────────── search / filters ─────────────────────── */

export const searchQuerySchema = z.object({
  q: z.string().max(120).optional(),
  category: z.enum(GAME_CATEGORIES).optional(),
  collection: z.enum(GAME_COLLECTIONS).optional(),
  developer: z.string().max(120).optional(),
  androidVersion: z.enum(ANDROID_VERSIONS).optional(),
  genre: z.string().max(40).optional(),
  tag: z.string().max(40).optional(),
  version: z.string().max(48).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(SORT_OPTIONS).default('newest'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(24),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

/* ─────────────────────────── wallpapers ─────────────────────────── */

export const wallpaperSchema = z.object({
  title: z.string().min(3).max(140),
  slug: slugSchema,
  category: z.enum(WALLPAPER_CATEGORIES),
  tags: z.array(z.string().min(2).max(40)).max(16).default([]),
  image: mediaAssetSchema,
  thumbnail: mediaAssetSchema.optional().nullable(),
  resolution: z.string().max(24).default('1920x1080'),
  width: z.number().int().positive().max(16000).optional().nullable(),
  height: z.number().int().positive().max(16000).optional().nullable(),
  downloads: z.number().int().nonnegative().default(0),
  views: z.number().int().nonnegative().default(0),
  featured: z.boolean().default(false),
  trending: z.boolean().default(false),
  /** Set when the agent derived this wallpaper from a game screenshot. */
  gameSlug: slugSchema.optional().nullable(),
  sourceUrl: urlSchema.optional().nullable(),
  status: z.enum(PUBLISH_STATUSES).default('published'),
  publishedAt: z.string().optional().nullable(),
  scheduledFor: z.string().optional().nullable(),
  seo: seoSchema,
});
export type Wallpaper = z.infer<typeof wallpaperSchema>;
export type WallpaperInput = z.input<typeof wallpaperSchema>;

/* ─────────────────────────── reviews ─────────────────────────── */

export const reviewSchema = z.object({
  title: z.string().min(6).max(160),
  slug: slugSchema,
  gameSlug: slugSchema.optional().nullable(),
  summary: z.string().min(40).max(400),
  body: z.string().min(200).max(40000),
  score: z.number().min(0).max(10),
  scoreBreakdown: z
    .object({
      gameplay: z.number().min(0).max(10),
      graphics: z.number().min(0).max(10),
      content: z.number().min(0).max(10),
      performance: z.number().min(0).max(10),
      value: z.number().min(0).max(10),
    })
    .optional()
    .nullable(),
  pros: z.array(z.string().min(3).max(200)).min(1).max(10),
  cons: z.array(z.string().min(3).max(200)).min(1).max(10),
  verdict: z.string().min(40).max(1200),
  /** Long-form sections rendered as distinct blocks on the review page. */
  gameplay: z.string().max(8000).optional().nullable(),
  graphics: z.string().max(8000).optional().nullable(),
  performance: z.string().max(8000).optional().nullable(),
  cover: mediaAssetSchema.optional().nullable(),
  author: z.string().max(80).default('MODVerse Editorial'),
  featured: z.boolean().default(false),
  status: z.enum(PUBLISH_STATUSES).default('published'),
  publishedAt: z.string().optional().nullable(),
  scheduledFor: z.string().optional().nullable(),
  seo: seoSchema,
});
export type Review = z.infer<typeof reviewSchema>;
export type ReviewInput = z.input<typeof reviewSchema>;

/* ─────────────────────────── blog ─────────────────────────── */

export const blogPostSchema = z.object({
  title: z.string().min(6).max(180),
  slug: slugSchema,
  category: z.enum(BLOG_CATEGORIES),
  excerpt: z.string().min(40).max(400),
  content: z.string().min(200).max(80000),
  cover: mediaAssetSchema.optional().nullable(),
  /** Extra images shown in an in-article gallery. */
  gallery: z.array(mediaAssetSchema).max(24).default([]),
  tags: z.array(z.string().min(2).max(40)).max(16).default([]),
  author: z.string().max(80).default('MODVerse Editorial'),
  readingMinutes: z.number().int().min(1).max(90).default(4),
  featured: z.boolean().default(false),
  views: z.number().int().nonnegative().default(0),
  /** Distinguishes news articles from evergreen guides in one table. */
  isNews: z.boolean().default(false),
  relatedGameSlug: slugSchema.optional().nullable(),
  status: z.enum(PUBLISH_STATUSES).default('draft'),
  publishedAt: z.string().optional().nullable(),
  scheduledFor: z.string().optional().nullable(),
  seo: seoSchema,
});
export type BlogPost = z.infer<typeof blogPostSchema>;
export type BlogPostInput = z.input<typeof blogPostSchema>;

/* ─────────────────────────── comments ─────────────────────────── */

export const commentSchema = z.object({
  gameSlug: slugSchema,
  author: z.string().min(2).max(60),
  email: z.string().email().max(160).optional().nullable(),
  body: z.string().min(3).max(2000),
  rating: z.number().min(1).max(5).optional().nullable(),
  status: z.enum(['pending', 'approved', 'spam']).default('pending'),
});
export type Comment = z.infer<typeof commentSchema>;

/* ─────────────────────────── agent ─────────────────────────── */

export const agentJobSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(JOB_TYPES),
  status: z.enum(JOB_STATUSES).default('queued'),
  source: z.enum(AGENT_SOURCES).optional().nullable(),
  targetUrl: urlSchema.optional().nullable(),
  payload: z.record(z.unknown()).default({}),
  result: z.record(z.unknown()).optional().nullable(),
  error: z.string().max(4000).optional().nullable(),
  attempts: z.number().int().nonnegative().default(0),
  maxAttempts: z.number().int().positive().default(3),
  progress: z.number().min(0).max(100).default(0),
  priority: z.number().int().min(0).max(10).default(5),
  scheduledFor: z.string().optional().nullable(),
  startedAt: z.string().optional().nullable(),
  finishedAt: z.string().optional().nullable(),
});
export type AgentJob = z.infer<typeof agentJobSchema>;

export const agentLogSchema = z.object({
  level: z.enum(LOG_LEVELS),
  message: z.string().max(4000),
  jobId: z.string().uuid().optional().nullable(),
  scope: z.string().max(60).default('agent'),
  meta: z.record(z.unknown()).optional().nullable(),
});
export type AgentLog = z.infer<typeof agentLogSchema>;

/** What a scraper adapter must return before normalisation/AI enrichment. */
export const scrapedGameSchema = z.object({
  source: z.enum(AGENT_SOURCES),
  sourceUrl: urlSchema,
  title: z.string().min(2).max(200),
  originalName: z.string().max(200).optional().nullable(),
  version: z.string().max(64).optional().nullable(),
  modVersion: z.string().max(64).optional().nullable(),
  packageName: z.string().max(160).optional().nullable(),
  developer: z.string().max(160).optional().nullable(),
  publisher: z.string().max(160).optional().nullable(),
  categoryHint: z.string().max(80).optional().nullable(),
  androidVersion: z.string().max(40).optional().nullable(),
  requirements: z.string().max(400).optional().nullable(),
  sizeText: z.string().max(40).optional().nullable(),
  sizeBytes: z.number().int().nonnegative().optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
  descriptionHtml: z.string().max(60000).optional().nullable(),
  descriptionText: z.string().max(40000).optional().nullable(),
  modFeatures: z.array(z.string().max(240)).max(40).default([]),
  whatsNew: z.string().max(6000).optional().nullable(),
  iconUrl: urlSchema.optional().nullable(),
  bannerUrl: urlSchema.optional().nullable(),
  screenshotUrls: z.array(urlSchema).max(24).default([]),
  playStoreUrl: urlSchema.optional().nullable(),
  originalApkUrl: urlSchema.optional().nullable(),
  modApkUrl: urlSchema.optional().nullable(),
  releaseDate: z.string().max(60).optional().nullable(),
  updatedDate: z.string().max(60).optional().nullable(),
  scrapedAt: z.string(),
});
export type ScrapedGame = z.infer<typeof scrapedGameSchema>;

/** Payload the agent posts to /api/agent/publish on the web app. */
export const publishRequestSchema = z.object({
  mode: z.enum(['create', 'update', 'upsert']).default('upsert'),
  dryRun: z.boolean().default(false),
  jobId: z.string().uuid().optional().nullable(),
  game: gameSchema,
  review: reviewSchema.optional().nullable(),
  changeSummary: z.array(z.string().max(300)).max(40).default([]),
});
export type PublishRequest = z.infer<typeof publishRequestSchema>;

export const publishResponseSchema = z.object({
  ok: z.boolean(),
  action: z.enum(['created', 'updated', 'skipped', 'dry-run']),
  gameId: z.string().uuid().optional().nullable(),
  slug: slugSchema.optional().nullable(),
  changes: z.array(z.string()).default([]),
  message: z.string().optional().nullable(),
});
export type PublishResponse = z.infer<typeof publishResponseSchema>;

export const manualIngestSchema = z.object({
  url: urlSchema,
  autoPublish: z.boolean().default(true),
  uploadToMega: z.boolean().default(true),
  generateReview: z.boolean().default(true),
  generateWallpapers: z.boolean().default(false),
  generateBlogDraft: z.boolean().default(false),
  overrideCategory: z.enum(GAME_CATEGORIES).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});
export type ManualIngest = z.infer<typeof manualIngestSchema>;

export const recommendationSchema = z.object({
  kind: z.enum(['new-game', 'trending', 'upcoming', 'needs-update']),
  title: z.string().min(2).max(200),
  sourceUrl: urlSchema,
  source: z.enum(AGENT_SOURCES),
  score: z.number().min(0).max(100),
  reason: z.string().min(10).max(600),
  packageName: z.string().max(160).optional().nullable(),
  existingGameSlug: slugSchema.optional().nullable(),
  meta: z.record(z.unknown()).default({}),
  status: z.enum(['new', 'accepted', 'dismissed', 'queued']).default('new'),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

/* ─────────────────── AI generation contracts ─────────────────── */

export const aiSeoBundleSchema = z.object({
  seoTitle: z.string().min(10).max(70),
  metaDescription: z.string().min(50).max(180),
  keywords: z.array(z.string().min(2).max(60)).min(5).max(20),
  slug: slugSchema,
  shortDescription: z.string().min(40).max(320),
  longDescription: z.string().min(400).max(9000),
  modFeatures: z.array(z.string().min(3).max(200)).min(3).max(20),
  installationGuide: z.array(z.string().min(5).max(400)).min(3).max(12),
  faqs: z.array(faqItemSchema).min(3).max(8),
  ogTitle: z.string().max(95),
  ogDescription: z.string().max(200),
  twitterTitle: z.string().max(70),
  twitterDescription: z.string().max(200),
  internalLinkAnchors: z.array(z.string().min(2).max(80)).max(10).default([]),
  tags: z.array(z.string().min(2).max(40)).min(3).max(16),
  genres: z.array(z.string().min(2).max(40)).max(8).default([]),
  category: z.enum(GAME_CATEGORIES),
  collections: z.array(z.enum(GAME_COLLECTIONS)).max(6).default([]),
});
export type AiSeoBundle = z.infer<typeof aiSeoBundleSchema>;

export const aiReviewBundleSchema = z.object({
  title: z.string().min(6).max(160),
  summary: z.string().min(40).max(400),
  body: z.string().min(600).max(12000),
  score: z.number().min(0).max(10),
  scoreBreakdown: z.object({
    gameplay: z.number().min(0).max(10),
    graphics: z.number().min(0).max(10),
    content: z.number().min(0).max(10),
    performance: z.number().min(0).max(10),
    value: z.number().min(0).max(10),
  }),
  pros: z.array(z.string().min(3).max(200)).min(3).max(8),
  cons: z.array(z.string().min(3).max(200)).min(2).max(6),
  verdict: z.string().min(60).max(1000),
});
export type AiReviewBundle = z.infer<typeof aiReviewBundleSchema>;

/* ─────────────────────────── settings ─────────────────────────── */

export const siteSettingsSchema = z.object({
  siteName: z.string().min(2).max(80).default('MODVerse'),
  tagline: z.string().max(180).default('Premium MOD APK games, verified and updated daily.'),
  defaultTheme: z.enum(['dark', 'light', 'system']).default('system'),
  logoUrl: urlSchema.optional().nullable(),
  faviconUrl: urlSchema.optional().nullable(),
  ogImageUrl: urlSchema.optional().nullable(),
  socialLinks: z
    .object({
      twitter: urlSchema.optional().nullable(),
      telegram: urlSchema.optional().nullable(),
      discord: urlSchema.optional().nullable(),
      youtube: urlSchema.optional().nullable(),
      facebook: urlSchema.optional().nullable(),
      reddit: urlSchema.optional().nullable(),
    })
    .default({}),
  ads: z
    .object({
      enabled: z.boolean().default(false),
      client: z.string().max(80).optional().nullable(),
      headerSlot: z.string().max(40).optional().nullable(),
      sidebarSlot: z.string().max(40).optional().nullable(),
      downloadSlot: z.string().max(40).optional().nullable(),
      inArticleSlot: z.string().max(40).optional().nullable(),
    })
    .default({}),
  analytics: z
    .object({
      gaId: z.string().max(40).optional().nullable(),
      plausibleDomain: z.string().max(120).optional().nullable(),
    })
    .default({}),
  downloadCountdownSeconds: z.number().int().min(0).max(60).default(10),
  agent: z
    .object({
      enabled: z.boolean().default(true),
      dryRun: z.boolean().default(true),
      autoPublish: z.boolean().default(false),
      concurrency: z.number().int().min(1).max(8).default(2),
      requestDelayMs: z.number().int().min(500).max(60000).default(2500),
      respectRobots: z.boolean().default(true),
      sources: z.array(z.enum(AGENT_SOURCES)).default([...AGENT_SOURCES]),
      cronDiscovery: z.string().max(40).default('0 */6 * * *'),
      cronUpdates: z.string().max(40).default('0 3 * * *'),
      cronRecommendations: z.string().max(40).default('0 9 * * *'),
    })
    .default({}),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

/* ═══════════════════ CMS: media library ═══════════════════ */

export const mediaItemSchema = z.object({
  id: z.string(),
  path: z.string().max(500),
  name: z.string().max(300),
  url: urlSchema,
  folder: z.enum(MEDIA_FOLDERS),
  bytes: z.number().int().nonnegative().default(0),
  width: z.number().int().positive().optional().nullable(),
  height: z.number().int().positive().optional().nullable(),
  mimeType: z.string().max(80).default('image/webp'),
  createdAt: z.string(),
  /** Slug of the entity this asset belongs to, when known. */
  ownerSlug: z.string().max(160).optional().nullable(),
});
export type MediaItem = z.infer<typeof mediaItemSchema>;

export const mediaQuerySchema = z.object({
  q: z.string().max(120).optional(),
  folder: z.enum(MEDIA_FOLDERS).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(40),
  sort: z.enum(['newest', 'oldest', 'largest', 'name']).default('newest'),
});
export type MediaQuery = z.infer<typeof mediaQuerySchema>;

/* ═══════════════════ CMS: AI suggestions ═══════════════════ */

export const suggestionSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(SUGGESTION_KINDS),
  title: z.string().min(2).max(240),
  detail: z.string().max(1200).default(''),
  score: z.number().min(0).max(100).default(50),
  severity: z.enum(['info', 'warn', 'error']).default('info'),
  /** Where acting on this suggestion takes the admin. */
  actionHref: z.string().max(500).optional().nullable(),
  actionLabel: z.string().max(60).optional().nullable(),
  entitySlug: z.string().max(200).optional().nullable(),
  meta: z.record(z.unknown()).default({}),
  status: z.enum(['new', 'accepted', 'dismissed']).default('new'),
  createdAt: z.string().optional(),
});
export type Suggestion = z.infer<typeof suggestionSchema>;

/* ═══════════════════ CMS: AI generation requests ═══════════════════ */

/** Actions the Review Generator panel can invoke. */
export const REVIEW_ACTIONS = [
  'generate',
  'regenerate',
  'improve-seo',
  'improve-rating',
  'expand',
  'translate',
] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

/**
 * The review currently in the editor, sent as CONTEXT for a refinement action.
 *
 * Deliberately loose: `reviewSchema.partial()` would still enforce the
 * published-content minimums (200-char body, 40-char summary), which blocks
 * refining a short draft — exactly when the generator is most useful.
 */
export const reviewContextSchema = z.object({
  title: z.string().max(300).optional().nullable(),
  summary: z.string().max(2000).optional().nullable(),
  body: z.string().max(60000).optional().nullable(),
  score: z.number().min(0).max(10).optional().nullable(),
  scoreBreakdown: z
    .object({
      gameplay: z.number().min(0).max(10),
      graphics: z.number().min(0).max(10),
      content: z.number().min(0).max(10),
      performance: z.number().min(0).max(10),
      value: z.number().min(0).max(10),
    })
    .partial()
    .optional()
    .nullable(),
  pros: z.array(z.string().max(400)).max(20).optional(),
  cons: z.array(z.string().max(400)).max(20).optional(),
  verdict: z.string().max(4000).optional().nullable(),
  gameplay: z.string().max(20000).optional().nullable(),
  graphics: z.string().max(20000).optional().nullable(),
  performance: z.string().max(20000).optional().nullable(),
});
export type ReviewContext = z.infer<typeof reviewContextSchema>;

export const reviewGenerateRequestSchema = z.object({
  action: z.enum(REVIEW_ACTIONS).default('generate'),
  gameSlug: slugSchema.optional().nullable(),
  /** Free-form context when no game record exists yet. */
  gameName: z.string().max(200).optional().nullable(),
  existingReview: reviewContextSchema.optional().nullable(),
  targetLanguage: z.string().max(10).optional().nullable(),
  tone: z.enum(['balanced', 'enthusiastic', 'critical']).default('balanced'),
  notes: z.string().max(1000).optional().nullable(),
});
export type ReviewGenerateRequest = z.infer<typeof reviewGenerateRequestSchema>;

export const blogGenerateRequestSchema = z.object({
  template: z.enum(BLOG_TEMPLATES),
  topic: z.string().max(240).optional().nullable(),
  gameSlug: slugSchema.optional().nullable(),
  gameNames: z.array(z.string().max(160)).max(20).default([]),
  category: z.enum(BLOG_CATEGORIES).default('guides'),
  isNews: z.boolean().default(false),
  wordCount: z.number().int().min(400).max(3000).default(1100),
  autoPublish: z.boolean().default(false),
});
export type BlogGenerateRequest = z.infer<typeof blogGenerateRequestSchema>;

export const wallpaperGenerateRequestSchema = z.object({
  gameSlug: slugSchema.optional().nullable(),
  /** Source images; when omitted the agent pulls the game's screenshots. */
  sourceUrls: z.array(urlSchema).max(24).default([]),
  presets: z.array(z.enum(['phone', 'tablet', 'desktop', 'ultrawide'])).min(1).default(['phone', 'desktop']),
  category: z.enum(WALLPAPER_CATEGORIES).default('action'),
  autoPublish: z.boolean().default(false),
  maxCount: z.number().int().min(1).max(24).default(6),
});
export type WallpaperGenerateRequest = z.infer<typeof wallpaperGenerateRequestSchema>;

/* ─────────────── AI output contracts ─────────────── */

export const aiBlogBundleSchema = z.object({
  title: z.string().min(6).max(180),
  slug: slugSchema,
  excerpt: z.string().min(40).max(400),
  content: z.string().min(400).max(60000),
  category: z.enum(BLOG_CATEGORIES),
  tags: z.array(z.string().min(2).max(40)).min(3).max(16),
  readingMinutes: z.number().int().min(1).max(90),
  seoTitle: z.string().min(10).max(70),
  metaDescription: z.string().min(50).max(180),
  keywords: z.array(z.string().min(2).max(60)).min(4).max(20),
});
export type AiBlogBundle = z.infer<typeof aiBlogBundleSchema>;

export const aiWallpaperMetaSchema = z.object({
  title: z.string().min(3).max(140),
  slug: slugSchema,
  category: z.enum(WALLPAPER_CATEGORIES),
  tags: z.array(z.string().min(2).max(40)).min(2).max(16),
  seoTitle: z.string().min(10).max(70),
  metaDescription: z.string().min(50).max(180),
  keywords: z.array(z.string().min(2).max(60)).min(3).max(16),
  altText: z.string().min(10).max(220),
});
export type AiWallpaperMeta = z.infer<typeof aiWallpaperMetaSchema>;

export const aiKeywordIdeaSchema = z.object({
  keyword: z.string().min(2).max(90),
  intent: z.enum(['informational', 'transactional', 'navigational']).default('informational'),
  difficulty: z.number().min(0).max(100),
  opportunity: z.number().min(0).max(100),
  rationale: z.string().max(400).default(''),
});
export type AiKeywordIdea = z.infer<typeof aiKeywordIdeaSchema>;

/* ═══════════════════ CMS: generic content publish ═══════════════════ */

/** Payload the agent posts to /api/agent/content for non-game content. */
export const contentPublishSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('wallpaper'), dryRun: z.boolean().default(false), data: wallpaperSchema }),
  z.object({ kind: z.literal('review'), dryRun: z.boolean().default(false), data: reviewSchema }),
  z.object({ kind: z.literal('post'), dryRun: z.boolean().default(false), data: blogPostSchema }),
]);
export type ContentPublish = z.infer<typeof contentPublishSchema>;

export const contentPublishResponseSchema = z.object({
  ok: z.boolean(),
  action: z.enum(['created', 'updated', 'skipped', 'dry-run']),
  id: z.string().optional().nullable(),
  slug: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
});
export type ContentPublishResponse = z.infer<typeof contentPublishResponseSchema>;
