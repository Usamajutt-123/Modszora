'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FolderOpen,
  Grid3x3,
  ImageIcon,
  Loader2,
  Replace,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  formatBytes,
  MEDIA_FOLDERS,
  MEDIA_FOLDER_LABELS,
  timeAgo,
  type MediaFolder,
  type MediaItem,
} from '@modverse/shared';
import { cn } from '@/lib/utils';

interface MediaResponse {
  items: MediaItem[];
  total: number;
  page: number;
  totalPages: number;
  folders: Record<string, { count: number; bytes: number }>;
}

/**
 * Media library.
 *
 * Search, folder filtering, preview, replace and delete over every asset in
 * storage. Uploads and replacements route through the same Sharp pipeline as
 * the rest of the CMS so nothing unoptimised enters the bucket.
 */
export function MediaLibrary({ demoMode = false }: { demoMode?: boolean }) {
  const [data, setData] = useState<MediaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [folder, setFolder] = useState<MediaFolder | ''>('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'largest' | 'name'>('newest');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams({ page: String(page), pageSize: '40', sort });
      if (debouncedQ) sp.set('q', debouncedQ);
      if (folder) sp.set('folder', folder);

      const res = await fetch(`/api/admin/media?${sp}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Could not load media');
      setData(json.data as MediaResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load media');
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, folder, sort, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalBytes = useMemo(
    () => Object.values(data?.folders ?? {}).reduce((s, f) => s + f.bytes, 0),
    [data?.folders],
  );

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function remove(item: MediaItem) {
    if (!confirm(`Delete ${item.name}? Pages using it will show a broken image.`)) return;
    setBusy(item.id);
    try {
      const res = await fetch(`/api/admin/media/${item.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Delete failed');
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(null);
    }
  }

  async function upload(files: FileList) {
    setBusy('upload');
    setError(null);
    let uploaded = 0;
    for (const file of Array.from(files).slice(0, 20)) {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', folder || 'uploads');
      try {
        const res = await fetch('/api/admin/media/upload', { method: 'POST', body: form });
        const json = await res.json();
        if (res.ok && json.ok) uploaded += 1;
        else setError(json?.error?.message ?? 'One file failed to upload');
      } catch {
        setError('Upload failed');
      }
    }
    setBusy(null);
    if (uploaded) await load();
  }

  return (
    <div className="space-y-5">
      {/* toolbar */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by filename or owner slug"
            aria-label="Search media"
            className="input pl-9"
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          aria-label="Sort media"
          className="input w-auto"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="largest">Largest first</option>
          <option value="name">Name A–Z</option>
        </select>

        <button
          type="button"
          onClick={() => uploadRef.current?.click()}
          disabled={busy === 'upload' || demoMode}
          className="btn-primary btn shrink-0"
          title={demoMode ? 'Uploads require Supabase storage' : undefined}
        >
          {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload
        </button>
        <input
          ref={uploadRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/avif"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* folders */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setFolder('');
            setPage(1);
          }}
          className={cn('chip', folder === '' && 'chip-active')}
        >
          <Grid3x3 className="h-3 w-3" />
          All
          <span className="text-faint">{data?.total ?? 0}</span>
        </button>
        {MEDIA_FOLDERS.map((f) => {
          const stats = data?.folders?.[f];
          return (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFolder(f);
                setPage(1);
              }}
              className={cn('chip', folder === f && 'chip-active')}
            >
              <FolderOpen className="h-3 w-3" />
              {MEDIA_FOLDER_LABELS[f]}
              {stats?.count ? <span className="text-faint">{stats.count}</span> : null}
            </button>
          );
        })}
        {totalBytes > 0 ? (
          <span className="ml-auto self-center text-2xs text-faint">{formatBytes(totalBytes)} total</span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl bg-danger/10 p-3.5 text-sm text-danger" role="alert">
          {error}
        </div>
      ) : null}

      {/* grid */}
      {loading && !data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="skeleton aspect-square rounded-xl" />
          ))}
        </div>
      ) : data?.items.length ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {data.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                className="group relative aspect-square overflow-hidden rounded-xl border border-line/70 bg-surface-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-glow"
              >
                <Image
                  src={item.url}
                  alt={item.name}
                  fill
                  sizes="(max-width:640px) 50vw, 20vw"
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2">
                  <p className="truncate text-2xs font-medium text-white">{item.name}</p>
                  <p className="text-[10px] text-white/70">
                    {item.width}×{item.height} · {formatBytes(item.bytes)}
                  </p>
                </div>
                <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white/90">
                  {item.folder}
                </span>
              </button>
            ))}
          </div>

          {data.totalPages > 1 ? (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary btn-sm btn"
              >
                Previous
              </button>
              <span className="text-xs text-muted">
                Page {data.page} of {data.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="btn-secondary btn-sm btn"
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line py-16 text-center">
          <ImageIcon className="mb-3 h-10 w-10 text-faint" />
          <p className="text-sm font-medium text-ink">No media found</p>
          <p className="mt-1 max-w-sm text-xs text-muted">
            {debouncedQ || folder
              ? 'Try clearing the search or picking a different folder.'
              : 'Images uploaded through any editor appear here automatically.'}
          </p>
        </div>
      )}

      {/* preview drawer */}
      {selected ? (
        <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-label="Media preview">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="glass-strong relative ml-auto flex h-dvh w-full max-w-md flex-col overflow-y-auto p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="min-w-0 truncate font-display text-base font-bold">{selected.name}</h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close preview"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-2">
              <Image src={selected.url} alt={selected.name} fill sizes="400px" className="object-contain" />
            </div>

            <dl className="mt-4 space-y-2 text-xs">
              {[
                ['Folder', MEDIA_FOLDER_LABELS[selected.folder]],
                ['Dimensions', selected.width && selected.height ? `${selected.width} × ${selected.height}` : 'Unknown'],
                ['Size', formatBytes(selected.bytes)],
                ['Type', selected.mimeType],
                ['Uploaded', timeAgo(selected.createdAt)],
                ['Owner', selected.ownerSlug ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line/50 pb-1.5">
                  <dt className="text-faint">{k}</dt>
                  <dd className="truncate text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-3">
              <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-faint">Public URL</p>
              <code className="block break-all rounded-lg bg-surface-2 p-2 font-mono text-[10px] leading-relaxed text-muted">
                {selected.url}
              </code>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => copyUrl(selected.url)} className="btn-secondary btn-sm btn">
                {copied === selected.url ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === selected.url ? 'Copied' : 'Copy URL'}
              </button>
              <a href={selected.url} download={selected.name} target="_blank" rel="noreferrer" className="btn-secondary btn-sm btn">
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
              <button
                type="button"
                onClick={() => uploadRef.current?.click()}
                disabled={demoMode}
                className="btn-secondary btn-sm btn"
              >
                <Replace className="h-3.5 w-3.5" />
                Replace
              </button>
              <button
                type="button"
                onClick={() => remove(selected)}
                disabled={busy === selected.id || demoMode}
                className="btn-sm btn border border-danger/40 text-danger hover:bg-danger/10"
              >
                {busy === selected.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete
              </button>
            </div>

            {demoMode ? (
              <p className="mt-3 rounded-lg bg-warning/10 p-2.5 text-2xs text-warning">
                Demo mode: uploads and deletions need Supabase storage configured.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
