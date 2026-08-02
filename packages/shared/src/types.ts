import type {
  AgentSource,
  GameCategory,
  GameCollection,
  JobStatus,
  JobType,
  LogLevel,
  PublishStatus,
} from './constants.js';
import type { DownloadLink, FaqItem, MediaAsset, Seo, VirusScan } from './schemas.js';

/* ─────────────── Database row shapes (snake_case ⇄ camelCase) ─────────────── */

export interface GameRow {
  id: string;
  slug: string;
  name: string;
  original_name: string | null;
  version: string;
  mod_version: string | null;
  package_name: string;
  developer: string;
  publisher: string | null;
  category: GameCategory;
  genres: string[];
  tags: string[];
  collections: GameCollection[];
  android_version: string;
  requirements: string | null;
  size_bytes: number;
  rating: number;
  rating_count: number;
  downloads: number;
  views: number;
  short_description: string;
  description: string;
  mod_features: string[];
  whats_new: string | null;
  installation_guide: string[];
  release_date: string | null;
  updated_date: string | null;
  status: PublishStatus;
  published_at: string | null;
  scheduled_for: string | null;
  featured: boolean;
  icon: MediaAsset | null;
  banner: MediaAsset | null;
  screenshots: MediaAsset[];
  download_links: DownloadLink[];
  virus_scan: VirusScan | null;
  faqs: FaqItem[];
  seo: Seo;
  play_store_url: string | null;
  original_apk_url: string | null;
  mod_apk_url: string | null;
  mega_url: string | null;
  source_site: AgentSource | null;
  source_url: string | null;
  content_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentJobRow {
  id: string;
  type: JobType;
  status: JobStatus;
  source: AgentSource | null;
  target_url: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  attempts: number;
  max_attempts: number;
  progress: number;
  priority: number;
  scheduled_for: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentLogRow {
  id: string;
  job_id: string | null;
  level: LogLevel;
  scope: string;
  message: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface RecommendationRow {
  id: string;
  kind: 'new-game' | 'trending' | 'upcoming' | 'needs-update';
  title: string;
  source: AgentSource;
  source_url: string;
  score: number;
  reason: string;
  package_name: string | null;
  existing_game_slug: string | null;
  meta: Record<string, unknown>;
  status: 'new' | 'accepted' | 'dismissed' | 'queued';
  created_at: string;
}

/* ─────────────────────────── API envelopes ─────────────────────────── */

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiFailure {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/* ─────────────────────────── dashboard ─────────────────────────── */

export interface DashboardStats {
  totals: {
    games: number;
    published: number;
    drafts: number;
    scheduled: number;
    wallpapers: number;
    reviews: number;
    posts: number;
    comments: number;
    pendingComments: number;
  };
  traffic: { views: number; downloads: number; viewsTrend: number; downloadsTrend: number };
  storage: { usedBytes: number; limitBytes: number; objectCount: number };
  agent: {
    online: boolean;
    running: number;
    queued: number;
    completed24h: number;
    failed24h: number;
    lastRunAt: string | null;
    nextRunAt: string | null;
  };
  seo: { indexedPages: number; missingMeta: number; avgTitleLength: number; brokenLinks: number };
  topGames: Array<{ slug: string; name: string; views: number; downloads: number; icon: string | null }>;
  recentUploads: Array<{ slug: string; name: string; createdAt: string; status: PublishStatus }>;
  errors: Array<{ id: string; message: string; scope: string; createdAt: string }>;
}

export interface AgentStatusSnapshot {
  online: boolean;
  version: string;
  uptimeSeconds: number;
  dryRun: boolean;
  concurrency: number;
  queue: { queued: number; running: number; completed: number; failed: number; retrying: number };
  crons: Array<{ name: string; expression: string; nextRun: string | null; enabled: boolean }>;
  sources: Array<{ id: AgentSource; label: string; enabled: boolean; lastCrawledAt: string | null; health: 'ok' | 'degraded' | 'down' }>;
  apiUsage: { openaiCalls24h: number; openaiTokens24h: number; multcloudTransfers24h: number };
  storage: { usedBytes: number; objectCount: number };
}
