'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  Image as ImageIcon,
  Lightbulb,
  Link2Off,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  SUGGESTION_KIND_LABELS,
  type Suggestion,
  type SuggestionKind,
} from '@modverse/shared';
import { cn } from '@/lib/utils';

const KIND_ICON: Record<SuggestionKind, typeof Lightbulb> = {
  'new-game': Sparkles,
  'game-update': RefreshCw,
  'trending-blog': TrendingUp,
  'trending-wallpaper': ImageIcon,
  'trending-keyword': Search,
  'low-competition-keyword': Search,
  'missing-screenshots': ImageIcon,
  'broken-link': Link2Off,
  'duplicate-game': Copy,
};

const SEVERITY_STYLE: Record<string, { chip: string; bar: string }> = {
  info: { chip: 'bg-brand/15 text-brand', bar: 'bg-brand' },
  warn: { chip: 'bg-warning/15 text-warning', bar: 'bg-warning' },
  error: { chip: 'bg-danger/15 text-danger', bar: 'bg-danger' },
};

/**
 * AI suggestions dashboard.
 *
 * Groups the analyser's findings by type, sorted by score, with one-click
 * actions that deep-link to the exact editor needed to resolve each item.
 */
export function SuggestionsPanel({
  initial,
  demoMode = false,
}: {
  initial: Suggestion[];
  demoMode?: boolean;
}) {
  const [items, setItems] = useState<Suggestion[]>(initial);
  const [filter, setFilter] = useState<SuggestionKind | 'all'>('all');
  const [analyzing, setAnalyzing] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map = new Map<SuggestionKind, number>();
    for (const s of items) map.set(s.kind, (map.get(s.kind) ?? 0) + 1);
    return map;
  }, [items]);

  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((s) => s.kind === filter)).sort((a, b) => b.score - a.score),
    [items, filter],
  );

  const bySeverity = useMemo(
    () => ({
      error: items.filter((s) => s.severity === 'error').length,
      warn: items.filter((s) => s.severity === 'warn').length,
      info: items.filter((s) => s.severity === 'info').length,
    }),
    [items],
  );

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/agent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Analysis could not start');
      setNotice({
        kind: 'ok',
        text: 'Analysis started. Findings appear here as each check completes — refresh in a moment.',
      });
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Analysis failed.' });
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const dismiss = useCallback(async (id: string) => {
    setBusyId(id);
    // Optimistic: the list is advisory, so remove immediately.
    setItems((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch(`/api/admin/suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' }),
      });
    } catch {
      /* dismissal is best-effort */
    } finally {
      setBusyId(null);
    }
  }, []);

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {bySeverity.error > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-danger/15 px-2.5 py-1 text-2xs font-bold text-danger">
              <AlertTriangle className="h-3 w-3" />
              {bySeverity.error} critical
            </span>
          ) : null}
          {bySeverity.warn > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-warning/15 px-2.5 py-1 text-2xs font-bold text-warning">
              {bySeverity.warn} warnings
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand/15 px-2.5 py-1 text-2xs font-bold text-brand">
            {bySeverity.info} opportunities
          </span>
        </div>

        <button type="button" onClick={runAnalysis} disabled={analyzing} className="btn-primary btn-sm btn">
          {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Run analysis
        </button>
      </div>

      {notice ? (
        <div
          className={cn(
            'rounded-xl p-3.5 text-sm',
            notice.kind === 'ok' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
          )}
        >
          {notice.text}
        </div>
      ) : null}

      {demoMode ? (
        <div className="rounded-xl border border-brand/25 bg-brand/[0.06] p-3.5">
          <p className="text-xs leading-relaxed text-muted">
            <strong className="text-ink">Demo mode:</strong> these findings are computed live against the bundled
            catalogue — missing screenshots, games without reviews, stale listings and keyword gaps are all real
            analysis of the demo data. Connect Supabase and the agent to analyse your own library.
          </p>
        </div>
      ) : null}

      {/* filters */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={cn('chip', filter === 'all' && 'chip-active')}
        >
          All
          <span className="text-faint">{items.length}</span>
        </button>
        {[...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([kind, count]) => {
            const Icon = KIND_ICON[kind];
            return (
              <button
                key={kind}
                type="button"
                onClick={() => setFilter(kind)}
                className={cn('chip', filter === kind && 'chip-active')}
              >
                <Icon className="h-3 w-3" />
                {SUGGESTION_KIND_LABELS[kind]}
                <span className="text-faint">{count}</span>
              </button>
            );
          })}
      </div>

      {/* list */}
      {visible.length ? (
        <ul className="space-y-2.5">
          {visible.map((s) => {
            const Icon = KIND_ICON[s.kind];
            const style = SEVERITY_STYLE[s.severity] ?? SEVERITY_STYLE.info!;
            return (
              <li
                key={s.id ?? s.title}
                className="group relative overflow-hidden rounded-2xl border border-line/70 bg-surface transition-all duration-200 hover:border-brand/40 hover:shadow-glow"
              >
                {/* score bar */}
                <span
                  className={cn('absolute inset-y-0 left-0 w-1 transition-all', style.bar)}
                  style={{ opacity: 0.3 + (s.score / 100) * 0.7 }}
                />

                <div className="flex flex-wrap items-start gap-3 p-4 pl-5">
                  <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', style.chip)}>
                    <Icon className="h-4 w-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink">{s.title}</h3>
                      <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase', style.chip)}>
                        {SUGGESTION_KIND_LABELS[s.kind]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{s.detail}</p>

                    {s.meta && Object.keys(s.meta).length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(s.meta)
                          .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
                          .slice(0, 4)
                          .map(([k, v]) => (
                            <span key={k} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-faint">
                              {k}: {String(v)}
                            </span>
                          ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="hidden font-mono text-2xs tabular-nums text-faint sm:inline">
                      {Math.round(s.score)}
                    </span>
                    {s.actionHref ? (
                      <Link href={s.actionHref} className="btn-secondary btn-sm btn">
                        {s.actionLabel ?? 'Open'}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : null}
                    {s.id && !demoMode ? (
                      <button
                        type="button"
                        onClick={() => dismiss(s.id!)}
                        disabled={busyId === s.id}
                        aria-label="Dismiss suggestion"
                        title="Dismiss"
                        className="grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-2 hover:text-danger"
                      >
                        {busyId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line py-14 text-center">
          <Check className="mb-3 h-10 w-10 text-success" />
          <p className="text-sm font-medium text-ink">
            {filter === 'all' ? 'No outstanding suggestions' : 'Nothing in this category'}
          </p>
          <p className="mt-1 max-w-sm text-xs text-muted">
            {filter === 'all'
              ? 'Run the analysis to scan for missing media, stale listings, broken links, duplicates and keyword gaps.'
              : 'Try another filter.'}
          </p>
        </div>
      )}
    </div>
  );
}
