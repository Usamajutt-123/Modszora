'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Search, SlidersHorizontal, X } from 'lucide-react';
import { formatBytes } from '@modverse/shared';
import { cn } from '@/lib/utils';

interface Suggestion {
  slug: string;
  name: string;
  developer: string;
  icon: string | null;
  version: string;
  sizeBytes: number;
  rating: number;
}

/** Debounced typeahead search with keyboard navigation. */
export function SearchBar({ className, autoFocus = false }: { className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced fetch
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error('search failed');
        const json = await res.json();
        setItems(json?.data?.items ?? []);
        setOpen(true);
        setHighlight(-1);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setItems([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [term]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // "/" focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        rootRef.current?.querySelector('input')?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const submit = useCallback(
    (value: string) => {
      const q = value.trim();
      if (!q) return;
      setOpen(false);
      router.push(`/search?q=${encodeURIComponent(q)}`);
    },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || !items.length) {
      if (e.key === 'Enter') submit(term);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + items.length) % items.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = items[highlight];
      if (picked) {
        setOpen(false);
        router.push(`/game/${picked.slug}`);
      } else {
        submit(term);
      }
    }
  };

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          type="search"
          value={term}
          autoFocus={autoFocus}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => items.length && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search games, developers, mods…"
          aria-label="Search games"
          aria-expanded={open}
          aria-controls="search-suggestions"
          role="combobox"
          autoComplete="off"
          className="input pl-10 pr-20"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-faint" /> : null}
          {term ? (
            <button
              type="button"
              onClick={() => {
                setTerm('');
                setItems([]);
                setOpen(false);
              }}
              aria-label="Clear search"
              className="grid h-6 w-6 place-items-center rounded-md text-faint transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="hidden rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-faint sm:block">
              /
            </kbd>
          )}
          <Link
            href="/search"
            aria-label="Advanced search"
            title="Advanced search"
            className="grid h-6 w-6 place-items-center rounded-md text-faint transition-colors hover:bg-surface-2 hover:text-brand"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <AnimatePresence>
        {open && items.length > 0 ? (
          <motion.div
            id="search-suggestions"
            role="listbox"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="glass-strong absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(70vh,420px)] overflow-y-auto rounded-2xl p-1.5"
          >
            {items.map((item, i) => (
              <Link
                key={item.slug}
                href={`/game/${item.slug}`}
                role="option"
                aria-selected={i === highlight}
                onClick={() => setOpen(false)}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  'flex items-center gap-3 rounded-xl p-2 transition-colors',
                  i === highlight ? 'bg-brand/12' : 'hover:bg-surface-2',
                )}
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line/70">
                  {item.icon ? <Image src={item.icon} alt="" fill sizes="40px" className="object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
                  <p className="truncate text-2xs text-faint">
                    {item.developer} · v{item.version} · {formatBytes(item.sizeBytes)}
                  </p>
                </div>
                <span className="shrink-0 text-2xs font-bold text-warning">★ {item.rating.toFixed(1)}</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={() => submit(term)}
              className="mt-1 w-full rounded-xl border-t border-line/60 px-3 py-2.5 text-center text-xs font-semibold text-brand transition-colors hover:bg-surface-2"
            >
              See all results for “{term.trim()}”
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
