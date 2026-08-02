'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Flame,
  ImageIcon,
  Loader2,
  Save,
  Sparkles,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  gameSlug as _unusedGameSlug,
  slugify,
  WALLPAPER_CATEGORIES,
  type MediaAsset,
  type PublishStatus,
  type Seo,
  type Wallpaper,
} from '@modverse/shared';
import { FormSection, SelectField, TagInput, TextField, Toggle } from '@/components/admin/form/Fields';
import { ImageField } from '@/components/admin/form/ImageField';
import { SeoPanel, deriveSeo } from '@/components/admin/form/SeoPanel';
import { PublishBar } from '@/components/admin/form/PublishBar';
import { cn } from '@/lib/utils';

type Draft = Omit<Wallpaper, 'seo'> & { seo: Seo };

function emptyDraft(): Draft {
  return {
    title: '',
    slug: '',
    category: 'action',
    tags: [],
    image: { url: '', format: 'webp', width: null, height: null, bytes: 0, alt: null, blurDataUrl: null },
    thumbnail: null,
    resolution: '1920x1080',
    width: null,
    height: null,
    downloads: 0,
    views: 0,
    featured: false,
    trending: false,
    gameSlug: null,
    sourceUrl: null,
    status: 'draft',
    publishedAt: null,
    scheduledFor: null,
    seo: deriveSeo({ title: '', description: '' }),
  };
}

export function WallpaperEditor({
  initial,
  id,
  games = [],
  presetGameSlug,
}: {
  initial?: Wallpaper & { id?: string };
  id?: string | null;
  games?: Array<{ slug: string; name: string }>;
  presetGameSlug?: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => (initial ? { ...emptyDraft(), ...initial } : emptyDraft()));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [generating, setGenerating] = useState(false);

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  // Derive the slug from the title until the admin edits it directly.
  useEffect(() => {
    if (!slugTouched && draft.title) {
      setDraft((d) => ({ ...d, slug: slugify(d.title) }));
    }
  }, [draft.title, slugTouched]);

  // Keep resolution/dimensions in sync with the uploaded image.
  useEffect(() => {
    if (draft.image?.width && draft.image?.height) {
      const res = `${draft.image.width}x${draft.image.height}`;
      if (draft.resolution !== res || draft.width !== draft.image.width) {
        setDraft((d) => ({ ...d, resolution: res, width: d.image.width ?? null, height: d.image.height ?? null }));
      }
    }
  }, [draft.image?.width, draft.image?.height, draft.resolution, draft.width]);

  useEffect(() => {
    if (presetGameSlug && !draft.gameSlug) set('gameSlug', presetGameSlug);
  }, [presetGameSlug, draft.gameSlug, set]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (draft.title.trim().length < 3) e.title = 'Title must be at least 3 characters.';
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(draft.slug)) e.slug = 'Slug must be lowercase words separated by hyphens.';
    if (!draft.image?.url) e.image = 'A wallpaper image is required.';
    if ((draft.seo.title ?? '').length < 10) e.seoTitle = 'SEO title must be at least 10 characters.';
    if ((draft.seo.description ?? '').length < 50) e.seoDescription = 'Meta description must be at least 50 characters.';
    return e;
  }, [draft]);

  const valid = Object.keys(errors).length === 0;

  const autoFillSeo = useCallback(() => {
    const catLabel = draft.category.replace('-', ' ');
    set(
      'seo',
      deriveSeo({
        title: `${draft.title || 'Gaming Wallpaper'} — Free ${draft.resolution} Download`,
        description: `Download ${draft.title || 'this gaming wallpaper'} in ${draft.resolution} for free. High-quality ${catLabel} background for phone and desktop, no signup required.`,
        keywords: [
          `${draft.title.toLowerCase()} wallpaper`,
          `${catLabel} wallpaper`,
          'gaming wallpaper hd',
          'phone wallpaper',
          '4k background',
        ].filter((k) => k.length > 4),
        imageUrl: draft.image?.url || null,
      }),
    );
  }, [draft.title, draft.category, draft.resolution, draft.image?.url, set]);

  async function save(status?: PublishStatus) {
    if (!valid) {
      setNotice({ kind: 'err', text: 'Fix the highlighted fields before saving.' });
      return;
    }
    setSaving(true);
    setNotice(null);

    const payload: Draft = status ? { ...draft, status } : draft;

    try {
      const res = await fetch(id ? `/api/admin/wallpapers/${id}` : '/api/admin/wallpapers', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Save failed');

      setNotice({ kind: 'ok', text: id ? 'Wallpaper updated.' : 'Wallpaper created.' });
      if (!id && json.data?.id) {
        router.replace(`/admin/wallpapers/${json.data.id}`);
      }
      router.refresh();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!id || !confirm('Delete this wallpaper? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/wallpapers/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Delete failed');
      router.push('/admin/wallpapers');
      router.refresh();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Delete failed.' });
      setDeleting(false);
    }
  }

  /** Queues AI generation of wallpapers from the selected game's screenshots. */
  async function generateFromGame() {
    if (!draft.gameSlug) {
      setNotice({ kind: 'err', text: 'Pick a source game first.' });
      return;
    }
    setGenerating(true);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/agent/generate/wallpapers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameSlug: draft.gameSlug,
          presets: ['phone', 'desktop'],
          category: draft.category,
          autoPublish: false,
          maxCount: 4,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Generation could not start');
      setNotice({
        kind: 'ok',
        text: 'Generation started. Wallpapers appear as drafts in the list when the job finishes.',
      });
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Generation failed.' });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/wallpapers')}
            className="btn-ghost btn-sm btn"
            aria-label="Back to wallpapers"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-extrabold">
              {id ? draft.title || 'Edit wallpaper' : 'New wallpaper'}
            </h1>
            <p className="text-2xs text-faint">{id ? `/wallpapers/${draft.slug}` : 'Upload or generate a wallpaper'}</p>
          </div>
        </div>
        {id ? (
          <button type="button" onClick={remove} disabled={deleting} className="btn-ghost btn-sm btn text-danger">
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete
          </button>
        ) : null}
      </header>

      {notice ? (
        <div
          className={cn(
            'flex items-start gap-2.5 rounded-xl p-3.5',
            notice.kind === 'ok' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
          )}
        >
          {notice.kind === 'ok' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p className="text-sm">{notice.text}</p>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="space-y-5">
          <FormSection title="Wallpaper" icon={<ImageIcon className="h-4 w-4" />}>
            <TextField
              label="Title"
              value={draft.title}
              onChange={(v) => set('title', v)}
              maxLength={140}
              minLength={3}
              placeholder="Neon Samurai Standoff"
              error={errors.title}
              required
            />

            <TextField
              label="Slug"
              value={draft.slug}
              onChange={(v) => {
                setSlugTouched(true);
                set('slug', slugify(v));
              }}
              mono
              maxLength={120}
              placeholder="neon-samurai-standoff"
              error={errors.slug}
              hint="Used in the public URL. Changing it on a live wallpaper breaks existing links."
              required
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Category"
                value={draft.category}
                onChange={(v) => set('category', v)}
                options={WALLPAPER_CATEGORIES.map((c) => ({
                  value: c,
                  label: c.charAt(0).toUpperCase() + c.slice(1).replace('-', ' '),
                }))}
              />
              <TextField
                label="Resolution"
                value={draft.resolution}
                onChange={(v) => set('resolution', v)}
                mono
                placeholder="1920x1080"
                hint="Filled automatically from the upload."
              />
            </div>

            <TagInput
              label="Tags"
              values={draft.tags}
              onChange={(v) => set('tags', v)}
              maxItems={16}
              suggestions={['4k', 'hd', 'phone', 'desktop', 'dark', 'neon', 'minimal', 'character']}
            />
          </FormSection>

          <FormSection title="Images" icon={<ImageIcon className="h-4 w-4" />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageField
                label="Wallpaper"
                value={draft.image?.url ? draft.image : null}
                onChange={(a) => set('image', a ?? emptyDraft().image)}
                folder="wallpapers"
                ownerSlug={draft.slug || undefined}
                aspect="banner"
                hint="The full-size download."
                required
              />
              <ImageField
                label="Thumbnail"
                value={draft.thumbnail ?? null}
                onChange={(a) => set('thumbnail', a)}
                folder="wallpapers"
                ownerSlug={draft.slug || undefined}
                aspect="banner"
                hint="Optional. Falls back to the full image."
              />
            </div>
            {errors.image ? <p className="text-2xs text-danger">{errors.image}</p> : null}

            {draft.width && draft.height ? (
              <div className="flex flex-wrap gap-4 rounded-xl bg-surface-2/50 px-3.5 py-2.5 text-2xs">
                <span className="text-faint">
                  Dimensions <strong className="ml-1 font-mono text-ink">{draft.width}×{draft.height}</strong>
                </span>
                <span className="text-faint">
                  Aspect{' '}
                  <strong className="ml-1 font-mono text-ink">
                    {(draft.width / draft.height).toFixed(2)}:1
                  </strong>
                </span>
                <span className="text-faint">
                  Orientation{' '}
                  <strong className="ml-1 text-ink">{draft.width >= draft.height ? 'Landscape' : 'Portrait'}</strong>
                </span>
              </div>
            ) : null}
          </FormSection>

          <SeoPanel
            seo={draft.seo}
            onChange={(s) => set('seo', s)}
            path={`/wallpapers/${draft.slug || 'slug'}`}
            onAutoFill={autoFillSeo}
          />
        </div>

        {/* sidebar */}
        <div className="space-y-5">
          <FormSection title="Visibility" icon={<Star className="h-4 w-4" />}>
            <Toggle
              checked={draft.featured}
              onChange={(v) => set('featured', v)}
              label="Featured"
              hint="Pinned to the top of the gallery."
              icon={<Star className="h-3.5 w-3.5 text-warning" />}
            />
            <Toggle
              checked={draft.trending}
              onChange={(v) => set('trending', v)}
              label="Trending"
              hint="Shown in the trending rail."
              icon={<Flame className="h-3.5 w-3.5 text-danger" />}
            />
          </FormSection>

          <FormSection
            title="AI generator"
            description="Turn a game's screenshots into phone and desktop wallpapers."
            icon={<Sparkles className="h-4 w-4" />}
          >
            <SelectField
              label="Source game"
              value={draft.gameSlug ?? ''}
              onChange={(v) => set('gameSlug', v || null)}
              options={[{ value: '', label: 'None — manual upload' }, ...games.map((g) => ({ value: g.slug, label: g.name }))]}
              hint="Links this wallpaper to a game and enables generation."
            />
            <button
              type="button"
              onClick={generateFromGame}
              disabled={generating || !draft.gameSlug}
              className="btn-primary btn w-full"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate from screenshots
            </button>
            <p className="text-2xs text-faint">
              Renders each screenshot at phone and desktop aspect ratios using attention-based cropping, writes SEO
              metadata, and saves them as drafts.
            </p>
          </FormSection>

          {id ? (
            <FormSection title="Stats">
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted">Downloads</dt>
                  <dd className="font-semibold tabular-nums text-ink">{draft.downloads.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Views</dt>
                  <dd className="font-semibold tabular-nums text-ink">{draft.views.toLocaleString()}</dd>
                </div>
              </dl>
            </FormSection>
          ) : null}
        </div>
      </div>

      <PublishBar
        status={draft.status}
        onStatusChange={(s) => set('status', s)}
        scheduledFor={draft.scheduledFor ?? null}
        onScheduleChange={(v) => set('scheduledFor', v)}
        onSave={save}
        saving={saving}
        valid={valid}
        previewHref={draft.status === 'published' ? `/wallpapers/${draft.slug}` : null}
        errorCount={Object.keys(errors).length}
      />
    </div>
  );
}
