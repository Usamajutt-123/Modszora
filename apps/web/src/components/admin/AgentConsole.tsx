'use client';

import { useCallback, useState } from 'react';
import {
  AlertCircle,
  Ban,
  Bot,
  CheckCircle2,
  ChevronRight,
  Compass,
  Download,
  Lightbulb,
  Link2,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Terminal,
  XCircle,
} from 'lucide-react';
import { AGENT_SOURCES, AGENT_SOURCE_META, CATEGORY_LABELS, GAME_CATEGORIES, timeAgo, type AgentStatusSnapshot } from '@modverse/shared';
import usePolling from '@/hooks/usePolling';
import { cn } from '@/lib/utils';

interface Job {
  id: string;
  type: string;
  status: string;
  targetUrl?: string | null;
  progress: number;
  attempts: number;
  maxAttempts: number;
  error?: string | null;
  createdAt: string;
  result?: Record<string, unknown> | null;
}

interface LogEntry {
  id: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  scope: string;
  message: string;
  at: string;
}

const STATUS_STYLES: Record<string, string> = {
  queued: 'bg-surface-2 text-faint',
  running: 'bg-brand/15 text-brand',
  retrying: 'bg-warning/15 text-warning',
  completed: 'bg-success/15 text-success',
  failed: 'bg-danger/15 text-danger',
  cancelled: 'bg-surface-2 text-faint line-through',
};

const LEVEL_STYLES: Record<string, string> = {
  debug: 'text-faint',
  info: 'text-muted',
  warn: 'text-warning',
  error: 'text-danger',
};

export function AgentConsole() {
  const status = usePolling<AgentStatusSnapshot>('/api/admin/agent/status', 8000);
  const jobs = usePolling<{ jobs: Job[] }>('/api/admin/agent/jobs?limit=30', 4000);
  const logs = usePolling<{ logs: LogEntry[] }>('/api/admin/agent/logs?limit=80', 6000);

  const [url, setUrl] = useState('');
  const [autoPublish, setAutoPublish] = useState(false);
  const [uploadMega, setUploadMega] = useState(true);
  const [genReview, setGenReview] = useState(true);
  const [dryRun, setDryRun] = useState(true);
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const online = Boolean(status.data?.online) && !status.error;

  const refreshAll = useCallback(() => {
    void status.refresh();
    void jobs.refresh();
    void logs.refresh();
  }, [status, jobs, logs]);

  async function submitIngest(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !url.trim()) return;
    setBusy(true);
    setNotice(null);

    try {
      const res = await fetch('/api/admin/agent/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          autoPublish,
          uploadToMega: uploadMega,
          generateReview: genReview,
          overrideCategory: category || undefined,
          dryRun,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Ingestion could not start');
      setNotice({ kind: 'ok', text: `Job queued (${String(json.data.job.id).slice(0, 8)}). Watch progress below.` });
      setUrl('');
      setTimeout(refreshAll, 800);
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Something went wrong' });
    } finally {
      setBusy(false);
    }
  }

  async function trigger(action: 'discover' | 'check-updates' | 'recommend') {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/agent/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, limitPerSource: 12, limit: 25, autoIngest: false }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Could not start task');
      setNotice({ kind: 'ok', text: `${action} started.` });
      setTimeout(refreshAll, 800);
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setBusy(false);
    }
  }

  async function cancelJob(id: string) {
    await fetch(`/api/admin/agent/jobs/${id}`, { method: 'POST' });
    setTimeout(refreshAll, 500);
  }

  return (
    <div className="space-y-6">
      {/* ── offline banner ── */}
      {!online ? (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/35 bg-warning/[0.07] p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-warning">Agent offline</p>
            <p className="mt-1 text-xs text-muted">
              {status.error?.message ?? 'Cannot reach the agent service.'} Start it with{' '}
              <code className="font-mono text-brand">npm run dev:agent</code>, then set{' '}
              <code className="font-mono text-brand">NEXT_PUBLIC_AGENT_URL</code> and{' '}
              <code className="font-mono text-brand">AGENT_API_KEY</code>.
            </p>
          </div>
        </div>
      ) : null}

      {/* ── manual ingest ── */}
      <section className="card-gradient">
        <div className="p-5 md:p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Link2 className="h-5 w-5 text-brand" />
            One-click publish from a URL
          </h2>
          <p className="mt-1 text-sm text-muted">
            Paste any supported MOD APK page. The agent scrapes it, generates SEO, processes images, uploads the APK to
            Mega and publishes — automatically.
          </p>

          <form onSubmit={submitIngest} className="mt-4 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://happymod.com/example-game/com.example.game/"
                className="input flex-1"
                aria-label="Game URL"
              />
              <button type="submit" disabled={busy || !online} className="btn-primary btn shrink-0 sm:px-6">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Ingest
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {[
                { id: 'dry', label: 'Dry run', checked: dryRun, set: setDryRun, hint: 'Preview without writing' },
                { id: 'pub', label: 'Publish immediately', checked: autoPublish, set: setAutoPublish },
                { id: 'mega', label: 'Upload to Mega', checked: uploadMega, set: setUploadMega },
                { id: 'rev', label: 'Generate review', checked: genReview, set: setGenReview },
              ].map((c) => (
                <label key={c.id} htmlFor={c.id} className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                  <input
                    id={c.id}
                    type="checkbox"
                    checked={c.checked}
                    onChange={(e) => c.set(e.target.checked)}
                    className="h-4 w-4 rounded border-line bg-surface-2 text-brand focus:ring-2 focus:ring-brand/30"
                  />
                  {c.label}
                  {c.hint ? <span className="text-faint">({c.hint})</span> : null}
                </label>
              ))}

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Override category"
                className="input h-8 w-auto py-0 text-xs"
              >
                <option value="">Auto-detect category</option>
                {GAME_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>

            {notice ? (
              <p
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
                  notice.kind === 'ok' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
                )}
              >
                {notice.kind === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                {notice.text}
              </p>
            ) : null}
          </form>
        </div>
      </section>

      {/* ── quick actions ── */}
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { action: 'discover' as const, icon: Compass, title: 'Discover new games', body: 'Crawl every source for titles not yet in the library.' },
          { action: 'check-updates' as const, icon: RefreshCw, title: 'Check for updates', body: 'Re-scrape tracked games and detect version bumps.' },
          { action: 'recommend' as const, icon: Lightbulb, title: 'Research & recommend', body: 'Score candidates without publishing anything.' },
        ].map(({ action, icon: Icon, title, body }) => (
          <button
            key={action}
            type="button"
            onClick={() => trigger(action)}
            disabled={busy || !online}
            className="card card-hover p-4 text-left disabled:opacity-50"
          >
            <Icon className="h-5 w-5 text-brand" />
            <p className="mt-2.5 text-sm font-bold text-ink">{title}</p>
            <p className="mt-1 text-xs text-muted">{body}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-2xs font-semibold text-brand">
              Run now <ChevronRight className="h-3 w-3" />
            </span>
          </button>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* ── job queue ── */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-base font-bold">
              <Bot className="h-4 w-4 text-brand" />
              Job queue
            </h2>
            <button type="button" onClick={refreshAll} className="btn-ghost btn-sm btn" aria-label="Refresh">
              <RefreshCw className={cn('h-3.5 w-3.5', jobs.loading && 'animate-spin')} />
            </button>
          </div>

          {jobs.data?.jobs?.length ? (
            <ul className="space-y-2">
              {jobs.data.jobs.map((job) => (
                <li key={job.id} className="rounded-xl border border-line/70 bg-surface-2/50 p-3">
                  <div className="flex items-center gap-2">
                    <span className={cn('rounded-md px-2 py-0.5 text-2xs font-bold uppercase', STATUS_STYLES[job.status] ?? '')}>
                      {job.status}
                    </span>
                    <span className="font-mono text-2xs text-faint">{job.type}</span>
                    <span className="ml-auto text-2xs text-faint">{timeAgo(job.createdAt)}</span>
                    {['running', 'queued', 'retrying'].includes(job.status) ? (
                      <button
                        type="button"
                        onClick={() => cancelJob(job.id)}
                        className="text-faint transition-colors hover:text-danger"
                        aria-label="Cancel job"
                        title="Cancel job"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>

                  {job.targetUrl ? (
                    <p className="mt-1.5 truncate font-mono text-2xs text-muted" title={job.targetUrl}>
                      {job.targetUrl}
                    </p>
                  ) : null}

                  {['running', 'retrying'].includes(job.status) ? (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full bg-grad-brand transition-all duration-500"
                        style={{ width: `${Math.max(3, job.progress)}%` }}
                      />
                    </div>
                  ) : null}

                  {job.attempts > 1 ? (
                    <p className="mt-1.5 text-2xs text-warning">
                      attempt {job.attempts}/{job.maxAttempts}
                    </p>
                  ) : null}

                  {job.error ? <p className="mt-1.5 break-words text-2xs text-danger">{job.error}</p> : null}

                  {job.status === 'completed' && job.result ? (
                    <p className="mt-1.5 text-2xs text-success">
                      {String((job.result as any).action ?? 'done')}
                      {(job.result as any).slug ? ` → ${(job.result as any).slug}` : ''}
                      {(job.result as any).fresh !== undefined ? ` · ${(job.result as any).fresh} new` : ''}
                      {(job.result as any).updatesFound !== undefined ? ` · ${(job.result as any).updatesFound} updates` : ''}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-10 text-center text-sm text-muted">
              {online ? 'No jobs yet. Trigger one above.' : 'Agent offline.'}
            </p>
          )}
        </section>

        {/* ── right column ── */}
        <div className="space-y-5">
          {/* sources */}
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
              <Download className="h-4 w-4 text-brand" />
              Monitored sources
            </h2>
            <ul className="space-y-1.5">
              {(status.data?.sources ?? AGENT_SOURCES.map((id) => ({ id, label: AGENT_SOURCE_META[id].label, enabled: false, lastCrawledAt: null, health: 'ok' as const }))).map(
                (s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'h-1.5 w-1.5 shrink-0 rounded-full',
                          s.health === 'ok' ? 'bg-success' : s.health === 'degraded' ? 'bg-warning' : 'bg-danger',
                        )}
                      />
                      <span className="text-ink">{s.label}</span>
                    </span>
                    <span className="text-2xs text-faint">{s.lastCrawledAt ? timeAgo(s.lastCrawledAt) : 'never'}</span>
                  </li>
                ),
              )}
            </ul>
          </section>

          {/* live logs */}
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
              <Terminal className="h-4 w-4 text-brand" />
              Live logs
            </h2>
            <div className="scrollbar-none max-h-80 overflow-y-auto rounded-xl bg-surface-2/60 p-3 font-mono text-2xs leading-relaxed">
              {logs.data?.logs?.length ? (
                logs.data.logs.map((entry) => (
                  <div key={entry.id} className="flex gap-2 border-b border-line/30 py-0.5 last:border-0">
                    <span className="shrink-0 text-faint">{entry.at.slice(11, 19)}</span>
                    <span className={cn('shrink-0 font-bold uppercase', LEVEL_STYLES[entry.level])}>
                      {entry.level.slice(0, 4)}
                    </span>
                    <span className="shrink-0 text-brand">[{entry.scope}]</span>
                    <span className="min-w-0 break-words text-muted">{entry.message}</span>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-muted">No log output.</p>
              )}
            </div>
          </section>

          {/* api usage */}
          {status.data ? (
            <section className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
                <Play className="h-4 w-4 text-brand" />
                API usage
              </h2>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted">OpenAI calls</dt>
                  <dd className="font-semibold text-ink">{status.data.apiUsage.openaiCalls24h}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">OpenAI tokens</dt>
                  <dd className="font-semibold text-ink">{status.data.apiUsage.openaiTokens24h.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Mega transfers</dt>
                  <dd className="font-semibold text-ink">{status.data.apiUsage.multcloudTransfers24h}</dd>
                </div>
                <div className="flex justify-between border-t border-line/60 pt-2">
                  <dt className="text-muted">Storage objects</dt>
                  <dd className="font-semibold text-ink">{status.data.storage.objectCount}</dd>
                </div>
              </dl>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
