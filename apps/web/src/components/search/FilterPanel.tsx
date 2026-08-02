'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { Filter, Loader2, RotateCcw, X } from 'lucide-react';
import {
  ANDROID_VERSIONS,
  CATEGORY_LABELS,
  COLLECTION_LABELS,
  GAME_CATEGORIES,
  GAME_COLLECTIONS,
  SORT_LABELS,
  SORT_OPTIONS,
} from '@modverse/shared';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  developers?: Array<{ name: string; count: number }>;
  tags?: Array<{ tag: string; count: number }>;
  categoryCounts?: Record<string, number>;
  showCollection?: boolean;
  basePath?: string;
  className?: string;
}

/**
 * Advanced search / filter sidebar.
 * Every change updates the URL (shareable, back-button friendly) and uses
 * a transition so the list stays interactive while the server re-renders.
 */
export function FilterPanel({
  developers = [],
  tags = [],
  categoryCounts = {},
  showCollection = true,
  basePath = '/browse',
  className,
}: FilterPanelProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [mobileOpen, setMobileOpen] = useState(false);

  const current = useMemo(
    () => ({
      q: params.get('q') ?? '',
      category: params.get('category') ?? '',
      collection: params.get('collection') ?? '',
      developer: params.get('developer') ?? '',
      androidVersion: params.get('androidVersion') ?? '',
      tag: params.get('tag') ?? '',
      minRating: params.get('minRating') ?? '',
      sort: params.get('sort') ?? 'newest',
    }),
    [params],
  );

  const activeCount = Object.entries(current).filter(([k, v]) => v && k !== 'sort' && k !== 'q').length;

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (!value || next.get(key) === value) next.delete(key);
      else next.set(key, value);
      next.delete('page'); // any filter change resets pagination
      startTransition(() => {
        router.push(`${basePath}${next.toString() ? `?${next}` : ''}`, { scroll: false });
      });
    },
    [params, router, basePath],
  );

  const reset = useCallback(() => {
    const next = new URLSearchParams();
    const q = params.get('q');
    if (q) next.set('q', q);
    startTransition(() => router.push(`${basePath}${next.toString() ? `?${next}` : ''}`, { scroll: false }));
  }, [params, router, basePath]);

  const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="border-b border-line/60 py-4 first:pt-0 last:border-0">
      <h3 className="mb-2.5 text-2xs font-bold uppercase tracking-wider text-ink">{title}</h3>
      {children}
    </div>
  );

  const body = (
    <div className={cn('relative', pending && 'opacity-60 transition-opacity')}>
      {pending ? (
        <div className="absolute right-0 top-0 z-10">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
        </div>
      ) : null}

      <Group title="Sort by">
        <div className="flex flex-wrap gap-1.5">
          {SORT_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => update('sort', s)}
              className={cn('chip', current.sort === s && 'chip-active')}
            >
              {SORT_LABELS[s]}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Category">
        <div className="flex flex-wrap gap-1.5">
          {GAME_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => update('category', c)}
              className={cn('chip', current.category === c && 'chip-active')}
            >
              {CATEGORY_LABELS[c]}
              {categoryCounts[c] ? <span className="text-faint">{categoryCounts[c]}</span> : null}
            </button>
          ))}
        </div>
      </Group>

      {showCollection ? (
        <Group title="Collection">
          <div className="flex flex-wrap gap-1.5">
            {GAME_COLLECTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => update('collection', c)}
                className={cn('chip', current.collection === c && 'chip-active')}
              >
                {COLLECTION_LABELS[c]}
              </button>
            ))}
          </div>
        </Group>
      ) : null}

      <Group title="Android version">
        <div className="flex flex-wrap gap-1.5">
          {ANDROID_VERSIONS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => update('androidVersion', v)}
              className={cn('chip', current.androidVersion === v && 'chip-active')}
            >
              {v}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Minimum rating">
        <div className="flex flex-wrap gap-1.5">
          {['3', '3.5', '4', '4.5'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => update('minRating', r)}
              className={cn('chip', current.minRating === r && 'chip-active')}
            >
              ★ {r}+
            </button>
          ))}
        </div>
      </Group>

      {developers.length ? (
        <Group title="Developer">
          <div className="scrollbar-none max-h-52 space-y-0.5 overflow-y-auto pr-1">
            {developers.slice(0, 24).map((d) => (
              <button
                key={d.name}
                type="button"
                onClick={() => update('developer', d.name)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors',
                  current.developer === d.name ? 'bg-brand/12 font-semibold text-brand' : 'text-muted hover:bg-surface-2',
                )}
              >
                <span className="truncate">{d.name}</span>
                <span className="ml-2 shrink-0 text-faint">{d.count}</span>
              </button>
            ))}
          </div>
        </Group>
      ) : null}

      {tags.length ? (
        <Group title="Tags">
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 20).map((t) => (
              <button
                key={t.tag}
                type="button"
                onClick={() => update('tag', t.tag)}
                className={cn('chip text-2xs', current.tag === t.tag && 'chip-active')}
              >
                {t.tag}
              </button>
            ))}
          </div>
        </Group>
      ) : null}

      {activeCount > 0 ? (
        <button type="button" onClick={reset} className="btn-secondary btn mt-4 w-full">
          <RotateCcw className="h-3.5 w-3.5" />
          Clear {activeCount} filter{activeCount === 1 ? '' : 's'}
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      {/* mobile trigger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="btn-secondary btn w-full lg:hidden"
        aria-expanded={mobileOpen}
      >
        <Filter className="h-4 w-4" />
        Filters
        {activeCount > 0 ? (
          <span className="ml-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-2xs font-bold text-white">
            {activeCount}
          </span>
        ) : null}
      </button>

      {/* desktop panel */}
      <aside className={cn('hidden lg:block', className)} aria-label="Filters">
        <div className="card p-5 lg:sticky lg:top-24">{body}</div>
      </aside>

      {/* mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="glass-strong absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Filters</h2>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close filters"
                className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {body}
            <button type="button" onClick={() => setMobileOpen(false)} className="btn-primary btn mt-5 w-full">
              Show results
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
