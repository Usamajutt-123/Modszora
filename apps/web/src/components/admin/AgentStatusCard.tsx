'use client';

import Link from 'next/link';
import usePolling from '@/hooks/usePolling';
import { Activity, Bot, CircleDot, Loader2, WifiOff } from 'lucide-react';
import type { AgentStatusSnapshot } from '@modverse/shared';
import { cn } from '@/lib/utils';

/** Live agent health widget. Polls the proxy route every 10 seconds. */
export function AgentStatusCard() {
  const { data, error, loading } = usePolling<AgentStatusSnapshot>('/api/admin/agent/status', 10_000);

  const online = Boolean(data?.online) && !error;

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <Bot className="h-4 w-4 text-brand" />
          AI Agent
        </h2>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-bold uppercase',
            online ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger',
          )}
        >
          {loading && !data ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
          ) : online ? (
            <CircleDot className="h-2.5 w-2.5 animate-pulse" />
          ) : (
            <WifiOff className="h-2.5 w-2.5" />
          )}
          {loading && !data ? 'checking' : online ? 'online' : 'offline'}
        </span>
      </div>

      {online && data ? (
        <>
          <dl className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'Running', value: data.queue.running },
              { label: 'Queued', value: data.queue.queued },
              { label: 'Completed', value: data.queue.completed },
              { label: 'Failed', value: data.queue.failed },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-surface-2 p-2.5">
                <dt className="text-2xs font-semibold uppercase tracking-wide text-faint">{s.label}</dt>
                <dd className="mt-0.5 font-display text-lg font-bold text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-3 space-y-1.5 border-t border-line/60 pt-3">
            <div className="flex items-center justify-between text-2xs">
              <span className="text-faint">Mode</span>
              <span className={cn('font-semibold', data.dryRun ? 'text-warning' : 'text-success')}>
                {data.dryRun ? 'Dry run' : 'Live publishing'}
              </span>
            </div>
            <div className="flex items-center justify-between text-2xs">
              <span className="text-faint">Concurrency</span>
              <span className="font-semibold text-ink">{data.concurrency}</span>
            </div>
            <div className="flex items-center justify-between text-2xs">
              <span className="text-faint">Uptime</span>
              <span className="font-semibold text-ink">{Math.floor(data.uptimeSeconds / 60)}m</span>
            </div>
            <div className="flex items-center justify-between text-2xs">
              <span className="text-faint">Sources online</span>
              <span className="font-semibold text-ink">
                {data.sources.filter((s) => s.health === 'ok').length}/{data.sources.length}
              </span>
            </div>
          </div>

          {data.crons.length ? (
            <div className="mt-3 border-t border-line/60 pt-3">
              <p className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-faint">Scheduled</p>
              <ul className="space-y-1">
                {data.crons.map((c) => (
                  <li key={c.name} className="flex items-center justify-between gap-2 text-2xs">
                    <span className="truncate text-muted">{c.name}</span>
                    <code className={cn('shrink-0 font-mono', c.enabled ? 'text-brand' : 'text-faint line-through')}>
                      {c.expression}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-line p-4 text-center">
          <Activity className="mx-auto mb-2 h-6 w-6 text-faint" />
          <p className="text-xs font-medium text-ink">Agent unreachable</p>
          <p className="mt-1 text-2xs text-muted">
            Start it with <code className="font-mono text-brand">npm run dev:agent</code> and set{' '}
            <code className="font-mono text-brand">NEXT_PUBLIC_AGENT_URL</code>.
          </p>
        </div>
      )}

      <Link href="/admin/agent" className="btn-secondary btn-sm btn mt-4 w-full">
        Open control panel
      </Link>
    </section>
  );
}
