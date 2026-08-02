import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AgentSource, GameRecord, JobStatus, JobType, LogLevel, Recommendation } from '@modverse/shared';
import { config, features } from '../config/index.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('supabase');

let client: SupabaseClient | null = null;

export function getDb(): SupabaseClient | null {
  if (!features.supabase) return null;
  if (!client) {
    client = createClient(config.NEXT_PUBLIC_SUPABASE_URL!, config.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-modverse-client': 'agent' } },
    });
  }
  return client;
}

/* ═══════════════════════ storage ═══════════════════════ */

export async function uploadToStorage(path: string, body: Buffer, contentType: string): Promise<string | null> {
  const db = getDb();
  if (!db) {
    log.debug(`storage unavailable — would have uploaded ${path}`);
    return null;
  }

  const bucket = config.SUPABASE_STORAGE_BUCKET;
  const { error } = await db.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: true,
    cacheControl: '31536000', // 1 year — paths are content-addressed by slug
  });

  if (error) {
    log.error(`storage upload failed for ${path}: ${error.message}`);
    return null;
  }

  const { data } = db.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function storageUsage(): Promise<{ usedBytes: number; objectCount: number }> {
  const db = getDb();
  if (!db) return { usedBytes: 0, objectCount: 0 };
  const { data, error } = await db.from('storage_usage').select('*').maybeSingle();
  if (error || !data) return { usedBytes: 0, objectCount: 0 };
  return { usedBytes: Number((data as any).used_bytes ?? 0), objectCount: Number((data as any).object_count ?? 0) };
}

/* ═══════════════════════ games ═══════════════════════ */

export interface ExistingGame {
  id: string;
  slug: string;
  name: string;
  version: string;
  modVersion: string | null;
  packageName: string;
  sizeBytes: number;
  contentHash: string | null;
  megaUrl: string | null;
  sourceUrl: string | null;
  updatedDate: string | null;
  status: string;
  screenshots: unknown[];
}

const EXISTING_COLUMNS =
  'id, slug, name, version, mod_version, package_name, size_bytes, content_hash, mega_url, source_url, updated_date, status, screenshots';

function toExisting(row: any): ExistingGame {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    version: row.version,
    modVersion: row.mod_version,
    packageName: row.package_name,
    sizeBytes: Number(row.size_bytes ?? 0),
    contentHash: row.content_hash,
    megaUrl: row.mega_url,
    sourceUrl: row.source_url,
    updatedDate: row.updated_date,
    status: row.status,
    screenshots: Array.isArray(row.screenshots) ? row.screenshots : [],
  };
}

/**
 * Duplicate detection. Package name is the authoritative identity for an
 * Android app; slug and source URL are secondary signals.
 */
export async function findExistingGame(input: {
  packageName?: string | null;
  slug?: string | null;
  sourceUrl?: string | null;
  name?: string | null;
}): Promise<ExistingGame | null> {
  const db = getDb();
  if (!db) return null;

  if (input.packageName) {
    const { data } = await db.from('games').select(EXISTING_COLUMNS).eq('package_name', input.packageName).maybeSingle();
    if (data) return toExisting(data);
  }
  if (input.slug) {
    const { data } = await db.from('games').select(EXISTING_COLUMNS).eq('slug', input.slug).maybeSingle();
    if (data) return toExisting(data);
  }
  if (input.sourceUrl) {
    const { data } = await db.from('games').select(EXISTING_COLUMNS).eq('source_url', input.sourceUrl).maybeSingle();
    if (data) return toExisting(data);
  }
  // Last resort: exact case-insensitive name match.
  if (input.name) {
    const { data } = await db.from('games').select(EXISTING_COLUMNS).ilike('name', input.name).limit(1).maybeSingle();
    if (data) return toExisting(data);
  }
  return null;
}

export async function listTakenSlugs(prefix: string): Promise<string[]> {
  const db = getDb();
  if (!db) return [];
  const { data } = await db.from('games').select('slug').like('slug', `${prefix}%`).limit(50);
  return (data ?? []).map((r: any) => r.slug);
}

export async function listGamesNeedingUpdateCheck(limit = 40): Promise<ExistingGame[]> {
  const db = getDb();
  if (!db) return [];
  const { data } = await db
    .from('games')
    .select(EXISTING_COLUMNS)
    .eq('status', 'published')
    .not('source_url', 'is', null)
    .order('updated_date', { ascending: true, nullsFirst: true })
    .limit(limit);
  return (data ?? []).map(toExisting);
}

export async function recordGameVersion(input: {
  gameId: string;
  version: string;
  modVersion?: string | null;
  sizeBytes?: number | null;
  whatsNew?: string | null;
  megaUrl?: string | null;
  modApkUrl?: string | null;
  contentHash?: string | null;
  changes: string[];
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  const { error } = await db.from('game_versions').upsert(
    {
      game_id: input.gameId,
      version: input.version,
      mod_version: input.modVersion ?? null,
      size_bytes: input.sizeBytes ?? null,
      whats_new: input.whatsNew ?? null,
      mega_url: input.megaUrl ?? null,
      mod_apk_url: input.modApkUrl ?? null,
      content_hash: input.contentHash ?? null,
      changes: input.changes,
      released_at: new Date().toISOString(),
    },
    { onConflict: 'game_id,version,mod_version', ignoreDuplicates: true },
  );
  if (error) log.warn(`could not record version history: ${error.message}`);
}

/* ═══════════════════════ jobs & logs ═══════════════════════ */

export async function persistJob(job: {
  id: string;
  type: JobType;
  status: JobStatus;
  source?: AgentSource | null;
  targetUrl?: string | null;
  payload?: unknown;
  result?: unknown;
  error?: string | null;
  attempts: number;
  maxAttempts: number;
  progress: number;
  priority: number;
  startedAt?: string | null;
  finishedAt?: string | null;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  const { error } = await db.from('agent_jobs').upsert(
    {
      id: job.id,
      type: job.type,
      status: job.status,
      source: job.source ?? null,
      target_url: job.targetUrl ?? null,
      payload: job.payload ?? {},
      result: job.result ?? null,
      error: job.error ?? null,
      attempts: job.attempts,
      max_attempts: job.maxAttempts,
      progress: job.progress,
      priority: job.priority,
      started_at: job.startedAt ?? null,
      finished_at: job.finishedAt ?? null,
    },
    { onConflict: 'id' },
  );
  if (error) log.debug(`job persist skipped: ${error.message}`);
}

export async function persistLog(entry: {
  level: LogLevel;
  scope: string;
  message: string;
  jobId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  // Only warn/error are persisted; debug/info would flood the table.
  if (entry.level !== 'warn' && entry.level !== 'error') return;
  await db.from('agent_logs').insert({
    level: entry.level,
    scope: entry.scope,
    message: entry.message.slice(0, 4000),
    job_id: entry.jobId ?? null,
    meta: entry.meta ?? null,
  });
}

/* ═══════════════════════ sources & recommendations ═══════════════════════ */

export async function touchSource(source: AgentSource, result: { ok: boolean; itemsFound?: number }): Promise<void> {
  const db = getDb();
  if (!db) return;

  const patch: Record<string, unknown> = { last_crawled_at: new Date().toISOString() };
  if (result.ok) {
    patch.last_success_at = new Date().toISOString();
    patch.health = 'ok';
    patch.error_streak = 0;
    if (typeof result.itemsFound === 'number') patch.items_found = result.itemsFound;
  } else {
    const { data } = await db.from('agent_sources').select('error_streak').eq('id', source).maybeSingle();
    const streak = Number((data as any)?.error_streak ?? 0) + 1;
    patch.error_streak = streak;
    patch.health = streak >= 3 ? 'down' : 'degraded';
  }

  await db.from('agent_sources').update(patch).eq('id', source);
}

export async function getSources(): Promise<
  Array<{ id: AgentSource; label: string; enabled: boolean; lastCrawledAt: string | null; health: 'ok' | 'degraded' | 'down' }>
> {
  const db = getDb();
  if (!db) return [];
  const { data } = await db.from('agent_sources').select('id, label, enabled, last_crawled_at, health');
  return (data ?? []).map((r: any) => ({
    id: r.id,
    label: r.label,
    enabled: r.enabled,
    lastCrawledAt: r.last_crawled_at,
    health: r.health ?? 'ok',
  }));
}

export async function saveRecommendation(rec: Recommendation): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const { error } = await db.from('recommendations').upsert(
    {
      kind: rec.kind,
      title: rec.title,
      source: rec.source,
      source_url: rec.sourceUrl,
      score: rec.score,
      reason: rec.reason,
      package_name: rec.packageName ?? null,
      existing_game_slug: rec.existingGameSlug ?? null,
      meta: rec.meta,
      status: rec.status,
    },
    { onConflict: 'source_url', ignoreDuplicates: false },
  );
  if (error) {
    log.warn(`recommendation save failed: ${error.message}`);
    return false;
  }
  return true;
}

export async function listRecommendations(limit = 50): Promise<Recommendation[]> {
  const db = getDb();
  if (!db) return [];
  const { data } = await db
    .from('recommendations')
    .select('*')
    .eq('status', 'new')
    .order('score', { ascending: false })
    .limit(limit);
  return (data ?? []).map((r: any) => ({
    kind: r.kind,
    title: r.title,
    source: r.source,
    sourceUrl: r.source_url,
    score: Number(r.score),
    reason: r.reason,
    packageName: r.package_name,
    existingGameSlug: r.existing_game_slug,
    meta: r.meta ?? {},
    status: r.status,
  }));
}

/* ═══════════════════════ transfers ═══════════════════════ */

export async function recordTransfer(input: {
  jobId?: string | null;
  gameId?: string | null;
  sourceUrl: string;
  targetPath?: string | null;
  taskId?: string | null;
  status: string;
  progress?: number;
  bytesTotal?: number | null;
  megaUrl?: string | null;
  error?: string | null;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.from('transfers').insert({
    job_id: input.jobId ?? null,
    game_id: input.gameId ?? null,
    source_url: input.sourceUrl,
    target_path: input.targetPath ?? null,
    task_id: input.taskId ?? null,
    status: input.status,
    progress: input.progress ?? 0,
    bytes_total: input.bytesTotal ?? null,
    mega_url: input.megaUrl ?? null,
    error: input.error ?? null,
    finished_at: ['completed', 'failed'].includes(input.status) ? new Date().toISOString() : null,
  });
}

export function supabaseAvailable(): boolean {
  return features.supabase;
}
