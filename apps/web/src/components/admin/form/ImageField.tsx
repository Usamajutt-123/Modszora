'use client';

import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ImageIcon, Loader2, Trash2, Upload, X } from 'lucide-react';
import { formatBytes, type MediaAsset } from '@modverse/shared';
import { cn } from '@/lib/utils';

/**
 * Image upload field.
 *
 * Uploads go to /api/admin/media/upload, which normalises everything through
 * Sharp (EXIF rotation, size cap, WebP conversion) before it reaches storage,
 * so the admin never has to think about image optimisation.
 *
 * Supports drag-and-drop, paste, and reports how many bytes the optimisation
 * saved so the value is visible rather than invisible.
 */

interface UploadResult {
  url: string;
  path: string;
  name: string;
  bytes: number;
  width: number | null;
  height: number | null;
  savedBytes: number;
}

async function uploadFile(file: File, folder: string, ownerSlug?: string): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('folder', folder);
  if (ownerSlug) form.append('ownerSlug', ownerSlug);

  const res = await fetch('/api/admin/media/upload', { method: 'POST', body: form });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error?.message ?? `Upload failed (${res.status})`);
  }
  return json.data as UploadResult;
}

export function ImageField({
  label,
  value,
  onChange,
  folder = 'uploads',
  ownerSlug,
  aspect = 'banner',
  hint,
  required,
}: {
  label: string;
  value: MediaAsset | null;
  onChange: (asset: MediaAsset | null) => void;
  folder?: string;
  ownerSlug?: string;
  aspect?: 'banner' | 'square' | 'portrait';
  hint?: string;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      setSaved(null);
      try {
        const result = await uploadFile(file, folder, ownerSlug);
        onChange({
          url: result.url,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          format: 'webp',
          alt: null,
          blurDataUrl: null,
        });
        if (result.savedBytes > 0) setSaved(result.savedBytes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setBusy(false);
      }
    },
    [folder, ownerSlug, onChange],
  );

  const aspectClass =
    aspect === 'square' ? 'aspect-square' : aspect === 'portrait' ? 'aspect-[9/16]' : 'aspect-video';

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {label}
          {required ? <span className="ml-1 text-danger">*</span> : null}
        </span>
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setSaved(null);
            }}
            className="inline-flex items-center gap-1 text-2xs text-faint transition-colors hover:text-danger"
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </button>
        ) : null}
      </div>

      {value?.url ? (
        <div className={cn('group relative overflow-hidden rounded-xl border border-line bg-surface-2', aspectClass)}>
          <Image src={value.url} alt={value.alt ?? label} fill sizes="400px" className="object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/70 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="btn-secondary btn-sm btn"
              disabled={busy}
            >
              <Upload className="h-3.5 w-3.5" />
              Replace
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 py-1.5">
            <p className="truncate text-2xs text-white/90">
              {value.width}×{value.height} · {formatBytes(value.bytes ?? 0)}
            </p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          onPaste={(e) => {
            const file = e.clipboardData.files?.[0];
            if (file) void handleFile(file);
          }}
          disabled={busy}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors',
            aspectClass,
            dragging ? 'border-brand bg-brand/10' : 'border-line bg-surface-2/40 hover:border-brand/50',
            busy && 'pointer-events-none opacity-60',
          )}
        >
          {busy ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
              <span className="text-xs text-muted">Optimising and uploading…</span>
            </>
          ) : (
            <>
              <ImageIcon className="h-6 w-6 text-faint" />
              <span className="text-xs font-medium text-ink">Click, drop or paste an image</span>
              <span className="text-2xs text-faint">PNG, JPEG, WebP or AVIF · max 25 MB</span>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />

      {error ? (
        <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-2xs text-danger">
          <AlertCircle className="mt-px h-3 w-3 shrink-0" />
          {error}
        </p>
      ) : saved ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-2xs text-success">
          <CheckCircle2 className="mt-px h-3 w-3 shrink-0" />
          Optimised — saved {formatBytes(saved)}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-2xs text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

/** Multi-image field used for blog galleries and screenshot sets. */
export function GalleryField({
  label,
  values,
  onChange,
  folder = 'uploads',
  ownerSlug,
  max = 12,
  hint,
}: {
  label: string;
  values: MediaAsset[];
  onChange: (assets: MediaAsset[]) => void;
  folder?: string;
  ownerSlug?: string;
  max?: number;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const handleFiles = useCallback(
    async (files: FileList) => {
      const room = max - values.length;
      const list = Array.from(files).slice(0, room);
      if (!list.length) return;

      setBusy(true);
      setError(null);
      setProgress({ done: 0, total: list.length });

      const added: MediaAsset[] = [];
      for (let i = 0; i < list.length; i += 1) {
        try {
          const r = await uploadFile(list[i]!, folder, ownerSlug);
          added.push({
            url: r.url,
            width: r.width,
            height: r.height,
            bytes: r.bytes,
            format: 'webp',
            alt: null,
            blurDataUrl: null,
          });
        } catch (err) {
          // One bad file should not discard the rest of the batch.
          setError(err instanceof Error ? err.message : 'One image failed to upload');
        }
        setProgress({ done: i + 1, total: list.length });
      }

      if (added.length) onChange([...values, ...added]);
      setBusy(false);
    },
    [values, onChange, folder, ownerSlug, max],
  );

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
        <span className="font-mono text-2xs text-faint">
          {values.length}/{max}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {values.map((asset, i) => (
          <div key={asset.url} className="group relative aspect-video overflow-hidden rounded-lg border border-line bg-surface-2">
            <Image src={asset.url} alt={asset.alt ?? `${label} ${i + 1}`} fill sizes="200px" className="object-cover" />
            <button
              type="button"
              onClick={() => onChange(values.filter((_, x) => x !== i))}
              aria-label={`Remove image ${i + 1}`}
              className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-md bg-black/70 text-white opacity-0 transition-opacity hover:bg-danger group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {values.length < max ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
            }}
            className="flex aspect-video flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line bg-surface-2/40 transition-colors hover:border-brand/50 disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-brand" />
                <span className="text-2xs text-muted">
                  {progress.done}/{progress.total}
                </span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 text-faint" />
                <span className="text-2xs text-faint">Add</span>
              </>
            )}
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/avif"
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {error ? (
        <p role="alert" className="mt-1.5 text-2xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-2xs text-faint">{hint}</p>
      ) : null}
    </div>
  );
}
