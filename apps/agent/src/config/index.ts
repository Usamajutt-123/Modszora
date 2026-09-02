import 'dotenv/config';
import { z } from 'zod';
import { AGENT_SOURCES } from '@modverse/shared';

/**
 * Agent configuration.
 *
 * Everything has a safe default so the agent boots and is inspectable even
 * with an empty .env — features simply report themselves as unavailable
 * instead of crashing at import time.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  AGENT_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  AGENT_API_KEY: z.string().min(16).optional(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('modverse'),

  // Web app
  MODVERSE_PUBLISH_URL: z.string().url().default('http://localhost:3000/api/agent/publish'),
  MODVERSE_SITE_URL: z.string().url().default('http://localhost:3000'),

  // OpenAI & Gemini AI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(16000).default(2400),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),
  AI_PROVIDER: z.enum(['auto', 'gemini', 'openai']).default('auto'),

  // Crawl behaviour
  AGENT_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  AGENT_DRY_RUN: z
    .string()
    .default('true')
    .transform((v) => v !== 'false' && v !== '0'),
  AGENT_AUTO_PUBLISH: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  AGENT_RESPECT_ROBOTS: z
    .string()
    .default('true')
    .transform((v) => v !== 'false' && v !== '0'),
  AGENT_REQUEST_DELAY_MS: z.coerce.number().int().min(250).max(120_000).default(2500),
  AGENT_MAX_RETRIES: z.coerce.number().int().min(1).max(10).default(3),
  AGENT_NAV_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(180_000).default(45_000),
  AGENT_USER_AGENT: z.string().default('MODSzora/1.0 (+https://modszora.site/bot)'),
  AGENT_SOURCES_ENABLED: z.string().default(AGENT_SOURCES.join(',')),

  // Cron
  CRON_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  CRON_DISCOVERY: z.string().default('0 */6 * * *'),
  CRON_UPDATES: z.string().default('0 3 * * *'),
  CRON_RECOMMENDATIONS: z.string().default('0 9 * * *'),
  CRON_BLOG: z.string().default('0 8 * * *'),
  CRON_NEWS: z.string().default('0 14 * * *'),
  CRON_REVIEWS: z.string().default('0 18 * * *'),
  CRON_BLOG_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
  CRON_NEWS_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
  CRON_REVIEWS_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true' || v === '1'),

  // MultCloud → Mega
  MULTCLOUD_API_KEY: z.string().optional(),
  MULTCLOUD_API_BASE: z.string().url().default('https://api.multcloud.com/v1'),
  MULTCLOUD_MEGA_CLOUD_ID: z.string().optional(),
  MULTCLOUD_TARGET_PATH: z.string().default('/MODSzora/APK'),
  MULTCLOUD_POLL_INTERVAL_MS: z.coerce.number().int().min(2000).default(10_000),
  MULTCLOUD_MAX_POLL_MS: z.coerce.number().int().min(60_000).default(1_800_000),

  // Secrets
  SECRETS_ENCRYPTION_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('[config] Invalid environment:', parsed.error.flatten().fieldErrors);
}

const raw = parsed.success ? parsed.data : schema.parse({});

export const config = {
  ...raw,
  enabledSources: raw.AGENT_SOURCES_ENABLED.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is (typeof AGENT_SOURCES)[number] => (AGENT_SOURCES as readonly string[]).includes(s)),
} as const;

export type AppConfig = typeof config;

const geminiKey = raw.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;

/** Feature availability — used by /status and to skip work cleanly. */
export const features = {
  supabase: Boolean(raw.NEXT_PUBLIC_SUPABASE_URL && raw.SUPABASE_SERVICE_ROLE_KEY),
  gemini: Boolean(geminiKey),
  openai: Boolean(raw.OPENAI_API_KEY),
  ai: Boolean(geminiKey || raw.OPENAI_API_KEY),
  multcloud: Boolean(raw.MULTCLOUD_API_KEY && raw.MULTCLOUD_MEGA_CLOUD_ID),
  publishing: Boolean(raw.AGENT_API_KEY),
} as const;

export function describeFeatures(): Record<string, string> {
  const activeAi = features.gemini
    ? `Gemini (${raw.GEMINI_MODEL})`
    : features.openai
      ? `OpenAI (${raw.OPENAI_MODEL})`
      : 'heuristic fallback active';

  return {
    supabase: features.supabase ? 'configured' : 'missing SUPABASE_SERVICE_ROLE_KEY / URL',
    ai: activeAi,
    gemini: features.gemini ? `configured (${raw.GEMINI_MODEL})` : 'missing GEMINI_API_KEY',
    openai: features.openai ? `configured (${raw.OPENAI_MODEL})` : 'missing OPENAI_API_KEY',
    multcloud: features.multcloud ? 'configured' : 'missing MULTCLOUD_API_KEY / MEGA cloud id',
    publishing: features.publishing ? 'configured' : 'missing AGENT_API_KEY',
    dryRun: config.AGENT_DRY_RUN ? 'ON (no writes will be published)' : 'OFF (live publishing)',
  };
}
