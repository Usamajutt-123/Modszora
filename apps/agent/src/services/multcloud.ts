import { setTimeout as delay } from 'node:timers/promises';
import { slugify } from '@modverse/shared';
import { config, features } from '../config/index.js';
import { createLogger } from '../core/logger.js';
import { probeFileSize } from '../core/http.js';

const log = createLogger('multcloud');

/**
 * Remote upload: MOD APK URL → Mega, without the file ever touching this
 * server. MultCloud pulls from the source URL and writes into the connected
 * Mega account, so a 2 GB APK costs us zero bandwidth and zero disk.
 *
 * The public MultCloud REST surface has shifted between versions, so every
 * response is parsed defensively: we look for the task id and the resulting
 * share link across several plausible field names rather than assuming one
 * exact schema. If the API shape is unrecognised the transfer is reported as
 * failed (never silently "successful").
 */

export interface TransferResult {
  ok: boolean;
  taskId?: string;
  megaUrl?: string;
  bytesTotal?: number | null;
  error?: string;
  skipped?: boolean;
  durationMs?: number;
}

export interface TransferOptions {
  sourceUrl: string;
  fileName: string;
  targetPath?: string;
  onProgress?: (percent: number, note: string) => void;
  signal?: AbortSignal;
}

interface MultCloudResponse {
  code?: number | string;
  status?: string | number;
  message?: string;
  msg?: string;
  error?: string;
  data?: Record<string, any>;
  task_id?: string;
  taskId?: string;
  id?: string;
  [key: string]: unknown;
}

function apiHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${config.MULTCLOUD_API_KEY}`,
    'X-API-Key': config.MULTCLOUD_API_KEY ?? '',
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': config.AGENT_USER_AGENT,
  };
}

async function callApi(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<MultCloudResponse | null> {
  const { timeoutMs = 45_000, ...rest } = init;
  const url = `${config.MULTCLOUD_API_BASE.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

  try {
    const res = await fetch(url, {
      ...rest,
      headers: { ...apiHeaders(), ...(rest.headers as Record<string, string> | undefined) },
      signal: AbortSignal.timeout(timeoutMs),
    });

    const text = await res.text();
    let body: MultCloudResponse | null = null;
    try {
      body = text ? (JSON.parse(text) as MultCloudResponse) : null;
    } catch {
      log.warn(`non-JSON response from ${path}: ${text.slice(0, 160)}`);
      return null;
    }

    if (!res.ok) {
      log.warn(`MultCloud ${path} → HTTP ${res.status}: ${body?.message ?? body?.msg ?? body?.error ?? 'unknown'}`);
      return body;
    }
    return body;
  } catch (err) {
    log.warn(`MultCloud ${path} request failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/** Pulls a task id out of whichever field the API used. */
function extractTaskId(res: MultCloudResponse | null): string | undefined {
  if (!res) return undefined;
  const candidates = [res.task_id, res.taskId, res.id, res.data?.task_id, res.data?.taskId, res.data?.id];
  const hit = candidates.find((v) => typeof v === 'string' && v.length > 0);
  return hit as string | undefined;
}

/** Pulls a Mega share link out of whichever field the API used. */
function extractMegaUrl(res: MultCloudResponse | null): string | undefined {
  if (!res) return undefined;
  const candidates = [
    res.data?.share_url,
    res.data?.shareUrl,
    res.data?.link,
    res.data?.url,
    res.data?.public_url,
    (res as any).share_url,
    (res as any).link,
  ];
  const hit = candidates.find((v) => typeof v === 'string' && /mega\.(nz|io)\//.test(v));
  if (hit) return hit as string;

  // Some responses embed the link in a nested file object.
  const file = res.data?.file ?? res.data?.result;
  if (file && typeof file === 'object') {
    const nested = [(file as any).share_url, (file as any).link, (file as any).url].find(
      (v) => typeof v === 'string' && /mega\.(nz|io)\//.test(v),
    );
    if (nested) return nested as string;
  }
  return undefined;
}

function normaliseStatus(res: MultCloudResponse | null): 'pending' | 'running' | 'completed' | 'failed' | 'unknown' {
  if (!res) return 'unknown';
  const raw = String(res.data?.status ?? res.status ?? res.data?.state ?? '').toLowerCase();
  if (['success', 'succeed', 'succeeded', 'completed', 'complete', 'finished', 'done', '3'].includes(raw)) return 'completed';
  if (['fail', 'failed', 'error', 'cancelled', 'canceled', '4', '5'].includes(raw)) return 'failed';
  if (['running', 'transferring', 'processing', 'in_progress', '2'].includes(raw)) return 'running';
  if (['pending', 'queued', 'waiting', 'created', '1', '0'].includes(raw)) return 'pending';
  return 'unknown';
}

function extractProgress(res: MultCloudResponse | null): number {
  const raw = res?.data?.progress ?? res?.data?.percent ?? (res as any)?.progress;
  const n = typeof raw === 'string' ? Number.parseFloat(raw) : typeof raw === 'number' ? raw : NaN;
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

/**
 * Starts a remote upload and polls until it finishes.
 *
 * Returns `{ ok:false, skipped:true }` when MultCloud is not configured so
 * callers can fall back to storing the direct MOD link instead of failing
 * the whole publish.
 */
export async function remoteUploadToMega(opts: TransferOptions): Promise<TransferResult> {
  const started = Date.now();
  const { sourceUrl, fileName, targetPath = config.MULTCLOUD_TARGET_PATH, onProgress, signal } = opts;

  if (!features.multcloud) {
    log.info('MultCloud not configured — skipping remote upload');
    return { ok: false, skipped: true, error: 'MultCloud not configured' };
  }
  if (!/^https?:\/\//i.test(sourceUrl)) {
    return { ok: false, error: `Invalid source URL: ${sourceUrl}` };
  }

  const safeName = fileName.endsWith('.apk') || fileName.endsWith('.xapk') ? fileName : `${slugify(fileName)}.apk`;
  const destination = `${targetPath.replace(/\/+$/, '')}/${safeName}`;

  log.info(`starting remote upload → Mega: ${safeName}`);
  onProgress?.(2, 'Creating MultCloud transfer task');

  const bytesTotal = await probeFileSize(sourceUrl);
  if (bytesTotal) log.debug(`source reports ${(bytesTotal / 1024 / 1024).toFixed(1)} MB`);

  // 1) create the task
  const create = await callApi('tasks/url-upload', {
    method: 'POST',
    body: JSON.stringify({
      url: sourceUrl,
      source_url: sourceUrl,
      cloud_id: config.MULTCLOUD_MEGA_CLOUD_ID,
      target_cloud_id: config.MULTCLOUD_MEGA_CLOUD_ID,
      path: destination,
      target_path: destination,
      file_name: safeName,
      overwrite: true,
      create_share_link: true,
    }),
  });

  const taskId = extractTaskId(create);
  if (!taskId) {
    const msg = create?.message ?? create?.msg ?? create?.error ?? 'MultCloud did not return a task id';
    log.error(`remote upload could not start: ${msg}`);
    return { ok: false, error: String(msg), bytesTotal, durationMs: Date.now() - started };
  }

  log.info(`transfer task created: ${taskId}`);
  onProgress?.(6, `Transfer queued (task ${taskId})`);

  // 2) poll until terminal
  const deadline = Date.now() + config.MULTCLOUD_MAX_POLL_MS;
  let lastProgress = 6;
  let unknownStreak = 0;

  while (Date.now() < deadline) {
    if (signal?.aborted) return { ok: false, taskId, error: 'Aborted', bytesTotal, durationMs: Date.now() - started };

    await delay(config.MULTCLOUD_POLL_INTERVAL_MS);

    const status = await callApi(`tasks/${encodeURIComponent(taskId)}`, { method: 'GET', timeoutMs: 20_000 });
    const state = normaliseStatus(status);

    if (state === 'unknown') {
      unknownStreak += 1;
      // Ten consecutive unreadable polls means the API contract changed.
      if (unknownStreak >= 10) {
        return { ok: false, taskId, error: 'Unrecognised MultCloud status response', bytesTotal, durationMs: Date.now() - started };
      }
      continue;
    }
    unknownStreak = 0;

    const pct = extractProgress(status);
    if (pct > lastProgress) {
      lastProgress = pct;
      onProgress?.(Math.min(95, 6 + pct * 0.85), `Transferring to Mega — ${pct.toFixed(0)}%`);
    }

    if (state === 'failed') {
      const msg = status?.data?.error ?? status?.message ?? 'Transfer failed';
      log.error(`transfer ${taskId} failed: ${msg}`);
      return { ok: false, taskId, error: String(msg), bytesTotal, durationMs: Date.now() - started };
    }

    if (state === 'completed') {
      onProgress?.(96, 'Transfer complete — requesting share link');

      let megaUrl = extractMegaUrl(status);

      // 3) ask for a share link if the task response did not include one
      if (!megaUrl) {
        const share = await callApi('files/share', {
          method: 'POST',
          body: JSON.stringify({
            cloud_id: config.MULTCLOUD_MEGA_CLOUD_ID,
            path: destination,
            file_path: destination,
            share_type: 'public',
            provider: 'mega',
          }),
        });
        megaUrl = extractMegaUrl(share);
      }

      if (!megaUrl) {
        log.warn(`transfer ${taskId} completed but no Mega link was returned`);
        return {
          ok: false,
          taskId,
          error: 'Transfer completed but no share link was returned',
          bytesTotal,
          durationMs: Date.now() - started,
        };
      }

      const seconds = Math.round((Date.now() - started) / 1000);
      log.info(`remote upload finished in ${seconds}s → ${megaUrl}`);
      onProgress?.(100, 'Mega link ready');
      return { ok: true, taskId, megaUrl, bytesTotal, durationMs: Date.now() - started };
    }
  }

  log.error(`transfer ${taskId} timed out after ${config.MULTCLOUD_MAX_POLL_MS / 1000}s`);
  return { ok: false, taskId, error: 'Transfer timed out', bytesTotal, durationMs: Date.now() - started };
}

/** Lists the clouds connected to the MultCloud account (used by settings UI). */
export async function listClouds(): Promise<Array<{ id: string; name: string; type: string }>> {
  if (!features.multcloud) return [];
  const res = await callApi('clouds', { method: 'GET' });
  const list = (res?.data?.clouds ?? res?.data?.list ?? res?.data) as unknown;
  if (!Array.isArray(list)) return [];
  return list
    .map((c: any) => ({ id: String(c.id ?? c.cloud_id ?? ''), name: String(c.name ?? c.title ?? ''), type: String(c.type ?? c.provider ?? '') }))
    .filter((c) => c.id);
}

export async function multcloudHealth(): Promise<{ configured: boolean; reachable: boolean; message: string }> {
  if (!features.multcloud) {
    return { configured: false, reachable: false, message: 'MULTCLOUD_API_KEY or MULTCLOUD_MEGA_CLOUD_ID not set' };
  }
  const res = await callApi('clouds', { method: 'GET', timeoutMs: 12_000 });
  return {
    configured: true,
    reachable: res !== null,
    message: res ? 'API reachable' : 'API unreachable or credentials rejected',
  };
}

/** Builds a clean, descriptive APK filename. */
export function buildApkFileName(gameName: string, version: string): string {
  const base = slugify(gameName, { maxLength: 60 });
  const ver = version.replace(/[^\w.]/g, '') || '1.0';
  return `${base}-v${ver}-MODSzora.apk`;
}
