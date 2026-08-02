/**
 * Domain constants shared by the web app and the AI agent.
 * Keeping these in one place guarantees the agent never invents a
 * category/status the database or UI does not understand.
 */

export const GAME_CATEGORIES = [
  'action',
  'adventure',
  'simulation',
  'sports',
  'racing',
  'puzzle',
  'arcade',
  'strategy',
  'rpg',
  'casual',
  'shooter',
  'horror',
] as const;
export type GameCategory = (typeof GAME_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<GameCategory, string> = {
  action: 'Action',
  adventure: 'Adventure',
  simulation: 'Simulation',
  sports: 'Sports',
  racing: 'Racing',
  puzzle: 'Puzzle',
  arcade: 'Arcade',
  strategy: 'Strategy',
  rpg: 'RPG',
  casual: 'Casual',
  shooter: 'Shooter',
  horror: 'Horror',
};

/** Curation collections surfaced on the homepage and in the sitemap. */
export const GAME_COLLECTIONS = [
  'trending',
  'latest',
  'popular',
  'mod-menu',
  'premium',
  'offline',
  'editors-choice',
  'recently-updated',
] as const;
export type GameCollection = (typeof GAME_COLLECTIONS)[number];

export const COLLECTION_LABELS: Record<GameCollection, string> = {
  trending: 'Trending Games',
  latest: 'Latest Games',
  popular: 'Popular Games',
  'mod-menu': 'Mod Menu Games',
  premium: 'Premium Games',
  offline: 'Offline Games',
  'editors-choice': "Editor's Choice",
  'recently-updated': 'Recently Updated',
};

export const PUBLISH_STATUSES = ['draft', 'scheduled', 'published', 'archived'] as const;
export type PublishStatus = (typeof PUBLISH_STATUSES)[number];

export const SORT_OPTIONS = ['newest', 'popular', 'trending', 'rating', 'downloads', 'name'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  popular: 'Popular',
  trending: 'Trending',
  rating: 'Rating',
  downloads: 'Downloads',
  name: 'A → Z',
};

export const ANDROID_VERSIONS = [
  '5.0+',
  '6.0+',
  '7.0+',
  '8.0+',
  '9.0+',
  '10.0+',
  '11.0+',
  '12.0+',
  '13.0+',
  '14.0+',
  '15.0+',
] as const;
export type AndroidVersion = (typeof ANDROID_VERSIONS)[number];

/** Sources the agent is allowed to crawl. Anything else is rejected. */
export const AGENT_SOURCES = [
  'apkmirror',
  'apkpure',
  'happymod',
  'moddroid',
  'an1',
  'apkaward',
  'revdl',
  'liteapks',
] as const;
export type AgentSource = (typeof AGENT_SOURCES)[number];

export const AGENT_SOURCE_META: Record<
  AgentSource,
  { label: string; origin: string; kind: 'original' | 'mod'; listPath: string }
> = {
  apkmirror: { label: 'APKMirror', origin: 'https://www.apkmirror.com', kind: 'original', listPath: '/apk/' },
  apkpure: { label: 'APKPure', origin: 'https://apkpure.com', kind: 'original', listPath: '/game' },
  happymod: { label: 'HappyMod', origin: 'https://happymod.com', kind: 'mod', listPath: '/new-mods' },
  moddroid: { label: 'ModDroid', origin: 'https://moddroid.co', kind: 'mod', listPath: '/games' },
  an1: { label: 'AN1', origin: 'https://an1.com', kind: 'mod', listPath: '/games' },
  apkaward: { label: 'APKAward', origin: 'https://apkaward.com', kind: 'mod', listPath: '/games' },
  revdl: { label: 'RevDL', origin: 'https://www.revdl.com', kind: 'mod', listPath: '/category/games' },
  liteapks: { label: 'LiteAPKs', origin: 'https://liteapks.com', kind: 'mod', listPath: '/category/games' },
};

export const JOB_TYPES = [
  'discovery',
  'update-check',
  'ingest-url',
  'media-pipeline',
  'remote-upload',
  'seo-generate',
  'publish',
  'recommendation',
  'blog-generate',
  'wallpaper-generate',
  'review-generate',
  'content-analysis',
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ['queued', 'running', 'completed', 'failed', 'cancelled', 'retrying'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const WALLPAPER_CATEGORIES = [
  'action',
  'anime',
  'racing',
  'fantasy',
  'sci-fi',
  'esports',
  'minimal',
  'characters',
] as const;
export type WallpaperCategory = (typeof WALLPAPER_CATEGORIES)[number];

export const BLOG_CATEGORIES = ['news', 'guides', 'updates', 'esports', 'reviews', 'tips'] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

/** Image pipeline presets — every asset is normalised to these sizes. */
export const IMAGE_PRESETS = {
  icon: { width: 512, height: 512, quality: 90, fit: 'cover' },
  banner: { width: 1280, height: 720, quality: 82, fit: 'cover' },
  screenshot: { width: 1080, height: 1920, quality: 80, fit: 'inside' },
  wallpaperThumb: { width: 640, height: 360, quality: 78, fit: 'cover' },
  og: { width: 1200, height: 630, quality: 85, fit: 'cover' },
} as const;
export type ImagePreset = keyof typeof IMAGE_PRESETS;

export const RATE_LIMITS = {
  publicApi: { windowMs: 60_000, max: 120 },
  search: { windowMs: 60_000, max: 60 },
  agentApi: { windowMs: 60_000, max: 240 },
  adminApi: { windowMs: 60_000, max: 300 },
  download: { windowMs: 60_000, max: 30 },
} as const;

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 60;

/* ═══════════════════ CMS additions ═══════════════════ */

/** Every content type the CMS manages. Drives dashboards and the media library. */
export const CONTENT_KINDS = ['game', 'wallpaper', 'review', 'post', 'news'] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  game: 'Game',
  wallpaper: 'Wallpaper',
  review: 'Review',
  post: 'Blog Post',
  news: 'News Article',
};

/** Logical folders in the media library (derived from the storage path). */
export const MEDIA_FOLDERS = ['icons', 'banners', 'screenshots', 'wallpapers', 'covers', 'uploads'] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

export const MEDIA_FOLDER_LABELS: Record<MediaFolder, string> = {
  icons: 'Icons',
  banners: 'Banners',
  screenshots: 'Screenshots',
  wallpapers: 'Wallpapers',
  covers: 'Covers',
  uploads: 'Uploads',
};

/** AI suggestion categories surfaced on the recommendations dashboard. */
export const SUGGESTION_KINDS = [
  'new-game',
  'game-update',
  'trending-blog',
  'trending-wallpaper',
  'trending-keyword',
  'low-competition-keyword',
  'missing-screenshots',
  'broken-link',
  'duplicate-game',
] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export const SUGGESTION_KIND_LABELS: Record<SuggestionKind, string> = {
  'new-game': 'New trending game',
  'game-update': 'Game needs update',
  'trending-blog': 'Trending blog topic',
  'trending-wallpaper': 'Trending wallpaper',
  'trending-keyword': 'Trending keyword',
  'low-competition-keyword': 'Low-competition keyword',
  'missing-screenshots': 'Missing screenshots',
  'broken-link': 'Broken link',
  'duplicate-game': 'Possible duplicate',
};

export const SUGGESTION_SEVERITY: Record<SuggestionKind, 'info' | 'warn' | 'error'> = {
  'new-game': 'info',
  'game-update': 'warn',
  'trending-blog': 'info',
  'trending-wallpaper': 'info',
  'trending-keyword': 'info',
  'low-competition-keyword': 'info',
  'missing-screenshots': 'warn',
  'broken-link': 'error',
  'duplicate-game': 'error',
};

/** Blog article templates the generator can produce. */
export const BLOG_TEMPLATES = [
  'top-10',
  'how-to-install',
  'update-guide',
  'mod-features-explained',
  'gaming-tips',
  'news-roundup',
] as const;
export type BlogTemplate = (typeof BLOG_TEMPLATES)[number];

export const BLOG_TEMPLATE_LABELS: Record<BlogTemplate, string> = {
  'top-10': 'Top 10 Games',
  'how-to-install': 'How to Install',
  'update-guide': 'Update Guide',
  'mod-features-explained': 'MOD Features Explained',
  'gaming-tips': 'Gaming Tips',
  'news-roundup': 'News Roundup',
};

/** Common wallpaper output sizes generated from a source screenshot. */
export const WALLPAPER_PRESETS = {
  phone: { width: 1080, height: 1920, label: 'Phone (1080×1920)' },
  tablet: { width: 1600, height: 2560, label: 'Tablet (1600×2560)' },
  desktop: { width: 1920, height: 1080, label: 'Desktop (1920×1080)' },
  ultrawide: { width: 2560, height: 1080, label: 'Ultrawide (2560×1080)' },
} as const;
export type WallpaperPreset = keyof typeof WALLPAPER_PRESETS;

/** Languages offered by the review translator. */
export const TRANSLATE_LANGUAGES = [
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'id', label: 'Indonesian' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ru', label: 'Russian' },
] as const;
