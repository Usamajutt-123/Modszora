'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Gamepad2,
  HardDrive,
  Info,
  ListChecks,
  Loader2,
  Package,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import {
  ANDROID_VERSIONS,
  CATEGORY_LABELS,
  COLLECTION_LABELS,
  GAME_CATEGORIES,
  GAME_COLLECTIONS,
  formatBytes,
  gameSlug as toGameSlug,
  slugify,
  type DownloadLink,
  type Game,
  type GameCollection,
  type MediaAsset,
  type PublishStatus,
  type Seo,
} from '@modverse/shared';
import {
  FormSection,
  ListEditor,
  SelectField,
  TagInput,
  TextArea,
  TextField,
  Toggle,
} from '@/components/admin/form/Fields';
import { GalleryField, ImageField } from '@/components/admin/form/ImageField';
import { SeoPanel, deriveSeo } from '@/components/admin/form/SeoPanel';
import { PublishBar } from '@/components/admin/form/PublishBar';
import { cn } from '@/lib/utils';

/**
 * Manual game editor.
 *
 * Additive to the AI agent: this is the hand-entry path for creating and
 * updating listings. It validates against the same `gameSchema` the agent
 * uses and posts to /api/admin/games, which writes the identical row shape —
 * so a manual listing and an agent listing are indistinguishable downstream.
 */

type Draft = Omit<Game, 'seo'> & { seo: Seo };

const MB = 1024 * 1024;

function emptyDraft(): Draft {
  return {
    name: '',
    originalName: null,
    slug: '',
    version: '1.0',
    modVersion: null,
    packageName: '',
    developer: '',
    publisher: null,
    category: 'action',
    genres: [],
    tags: [],
    collections: [],
    androidVersion: '7.0+',
    requirements: null,
    sizeBytes: 80 * MB,
    rating: 0,
    ratingCount: 0,
    downloads: 0,
    views: 0,
    shortDescription: '',
    description: '',
    modFeatures: [],
    whatsNew: null,
    installationGuide: [],
    releaseDate: null,
    updatedDate: null,
    status: 'draft',
    publishedAt: null,
    scheduledFor: null,
    featured: false,
    icon: null,
    banner: null,
    screenshots: [],
    downloadLinks: [],
    virusScan: {
      provider: 'manual',
      status: 'unscanned',
      scannedAt: null,
      reportUrl: null,
      detections: 0,
      engines: 0,
      sha256: null,
    },
    faqs: [],
    playStoreUrl: null,
    originalApkUrl: null,
    modApkUrl: null,
    megaUrl: null,
    sourceSite: null,
    sourceUrl: null,
    contentHash: null,
    seo: deriveSeo({ title: '', description: '' }),
  };
}

/** Sensible default install steps so a manual listing is never empty. */
function defaultInstallGuide(name: string): string[] {
  const n = name || 'the game';
  return [
    `Tap the download button above and wait for the ${n} APK to finish downloading.`,
    'Open Settings → Security and enable "Install unknown apps" for your browser or file manager.',
    'Uninstall any existing copy of the game to avoid a signature conflict.',
    'Open the downloaded APK and confirm the installation prompt.',
    'Launch the game and grant storage permission if prompted.',
  ];
}

const LINK_KINDS: Array<{ value: DownloadLink['kind']; label: string }> = [
  { value: 'mega', label: 'Mega' },
  { value: 'mirror', label: 'Mirror' },
  { value: 'direct', label: 'Direct' },
  { value: 'playstore', label: 'Play Store' },
  { value: 'original', label: 'Original APK' },
  { value: 'multcloud', label: 'MultCloud' },
];

export function GameEditor({ initial, id }: { initial?: Game & { id?: string }; id?: string | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => (initial ? { ...emptyDraft(), ...initial } : emptyDraft()));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [sizeMb, setSizeMb] = useState(() =>
    initial?.sizeBytes ? String(Number((initial.sizeBytes / MB).toFixed(1))) : '80',
  );

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  // Derive the slug from the name until the admin edits it directly.
  useEffect(() => {
    if (!slugTouched && draft.name) {
      setDraft((d) => ({ ...d, slug: toGameSlug(d.name) }));
    }
  }, [draft.name, slugTouched]);

  // Size is entered in MB but stored in bytes.
  useEffect(() => {
    const mb = Number.parseFloat(sizeMb);
    if (Number.isFinite(mb) && mb > 0) {
      const bytes = Math.round(mb * MB);
      if (bytes !== draft.sizeBytes) setDraft((d) => ({ ...d, sizeBytes: bytes }));
    }
  }, [sizeMb, draft.sizeBytes]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (draft.name.trim().length < 2) e.name = 'Name must be at least 2 characters.';
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(draft.slug)) e.slug = 'Slug must be lowercase words separated by hyphens.';
    if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(draft.packageName)) {
      e.packageName = 'Use a valid Android package, e.g. com.studio.game';
    }
    if (draft.developer.trim().length < 1) e.developer = 'Developer is required.';
    if (draft.version.trim().length < 1) e.version = 'Version is required.';
    if (!(draft.sizeBytes > 0)) e.sizeBytes = 'Size must be greater than zero.';
    if (draft.shortDescription.trim().length < 40) e.shortDescription = 'Short description must be at least 40 characters.';
    if (draft.description.trim().length < 120) e.description = 'Description must be at least 120 characters.';
    if (draft.modFeatures.length < 1) e.modFeatures = 'Add at least one MOD feature.';
    if ((draft.seo.title ?? '').length < 10) e.seoTitle = 'SEO title must be at least 10 characters.';
    if ((draft.seo.description ?? '').length < 50) e.seoDescription = 'Meta description must be at least 50 characters.';
    return e;
  }, [draft]);

  const valid = Object.keys(errors).length === 0;

  const autoFillSeo = useCallback(() => {
    const year = new Date().getFullYear();
    const feature = draft.modFeatures[0] ?? 'Unlimited Money';
    set(
      'seo',
      deriveSeo({
        title: `${draft.name || 'Game'} MOD APK ${draft.version} (${feature})`,
        description:
          draft.shortDescription.slice(0, 175) ||
          `Download ${draft.name || 'this game'} MOD APK v${draft.version} for Android — ${draft.modFeatures
            .slice(0, 2)
            .join(', ')}. Free, safe and updated ${year}.`,
        keywords: [
          `${draft.name.toLowerCase()} mod apk`,
          `${draft.name.toLowerCase()} hack`,
          `download ${draft.name.toLowerCase()}`,
          `${draft.category} mod apk`,
          `mod apk ${year}`,
        ].filter((k) => k.length > 8),
        imageUrl: draft.banner?.url ?? draft.icon?.url ?? null,
      }),
    );
  }, [draft.name, draft.version, draft.modFeatures, draft.shortDescription, draft.category, draft.banner, draft.icon, set]);

  function toggleCollection(c: GameCollection) {
    set('collections', draft.collections.includes(c) ? draft.collections.filter((x) => x !== c) : [...draft.collections, c]);
  }

  function updateLink(index: number, patch: Partial<DownloadLink>) {
    const next = [...draft.downloadLinks];
    next[index] = { ...next[index]!, ...patch };
    set('downloadLinks', next);
  }

  async function save(status?: PublishStatus) {
    if (!valid) {
      setNotice({ kind: 'err', text: 'Fix the highlighted fields before saving.' });
      return;
    }
    setSaving(true);
    setNotice(null);

    const payload: Draft = status ? { ...draft, status } : draft;

    try {
      const res = await fetch(id ? `/api/admin/games/${id}` : '/api/admin/games', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Save failed');

      setNotice({ kind: 'ok', text: id ? 'Game updated.' : 'Game created.' });
      if (!id && json.data?.id) router.replace(`/admin/games/manage/${json.data.id}`);
      router.refresh();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!id || !confirm(`Delete "${draft.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/games/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Delete failed');
      router.push('/admin/games');
      router.refresh();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Delete failed.' });
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/games')}
            className="btn-ghost btn-sm btn"
            aria-label="Back to games"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-extrabold">
              {id ? draft.name || 'Edit game' : 'New game'}
            </h1>
            <p className="text-2xs text-faint">
              {id ? `/game/${draft.slug}` : 'Enter the listing details manually'}
            </p>
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
          {/* ── identity ── */}
          <FormSection title="Game" icon={<Gamepad2 className="h-4 w-4" />}>
            <TextField
              label="Name"
              value={draft.name}
              onChange={(v) => set('name', v)}
              maxLength={160}
              minLength={2}
              placeholder="Subway Surfers"
              error={errors.name}
              required
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Original name"
                value={draft.originalName ?? ''}
                onChange={(v) => set('originalName', v || null)}
                maxLength={160}
                placeholder="Defaults to the name"
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
                error={errors.slug}
                hint="Changing this on a live listing breaks existing links."
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Developer"
                value={draft.developer}
                onChange={(v) => set('developer', v)}
                maxLength={120}
                placeholder="SYBO Games"
                error={errors.developer}
                required
              />
              <TextField
                label="Publisher"
                value={draft.publisher ?? ''}
                onChange={(v) => set('publisher', v || null)}
                maxLength={120}
                placeholder="Defaults to the developer"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                label="Version"
                value={draft.version}
                onChange={(v) => set('version', v)}
                maxLength={48}
                mono
                placeholder="3.41.0"
                error={errors.version}
                required
              />
              <TextField
                label="MOD version"
                value={draft.modVersion ?? ''}
                onChange={(v) => set('modVersion', v || null)}
                maxLength={64}
                mono
                placeholder="v3.41-mod"
              />
              <div>
                <TextField
                  label="Size (MB)"
                  value={sizeMb}
                  onChange={setSizeMb}
                  type="number"
                  mono
                  placeholder="152"
                  error={errors.sizeBytes}
                  hint={draft.sizeBytes > 0 ? formatBytes(draft.sizeBytes) : undefined}
                  required
                />
              </div>
            </div>

            <TextField
              label="Package name"
              value={draft.packageName}
              onChange={(v) => set('packageName', v.trim())}
              mono
              maxLength={160}
              placeholder="com.kiloo.subwaysurf"
              error={errors.packageName}
              hint="The Android application ID. Must be unique — it is how duplicates are detected."
              required
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Category"
                value={draft.category}
                onChange={(v) => set('category', v)}
                options={GAME_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
              />
              <SelectField
                label="Android version"
                value={draft.androidVersion}
                onChange={(v) => set('androidVersion', v)}
                options={ANDROID_VERSIONS.map((v) => ({ value: v, label: `Android ${v}` }))}
              />
            </div>

            <TextField
              label="Requirements"
              value={draft.requirements ?? ''}
              onChange={(v) => set('requirements', v || null)}
              maxLength={400}
              placeholder="Android 7.0 or higher · 2 GB RAM · 300 MB free storage"
            />
          </FormSection>

          {/* ── content ── */}
          <FormSection title="Description" icon={<Info className="h-4 w-4" />}>
            <TextArea
              label="Short description"
              value={draft.shortDescription}
              onChange={(v) => set('shortDescription', v)}
              rows={3}
              maxLength={320}
              minLength={40}
              placeholder="One sentence a reader could stop at and still know what this is."
              error={errors.shortDescription}
              required
            />
            <TextArea
              label="Full description (HTML)"
              value={draft.description}
              onChange={(v) => set('description', v)}
              rows={14}
              maxLength={20000}
              minLength={120}
              mono
              placeholder="<p>Opening paragraph…</p>&#10;<h2>About the game</h2>"
              error={errors.description}
              hint="Use <p>, <h2>, <h3>, <ul>, <li> and <strong>."
              required
            />
            <TextArea
              label="What's new"
              value={draft.whatsNew ?? ''}
              onChange={(v) => set('whatsNew', v || null)}
              rows={5}
              maxLength={4000}
              placeholder={'• Updated to the latest version\n• Performance improvements'}
              hint="One change per line. Bullet characters are stripped automatically."
            />
          </FormSection>

          <FormSection
            title="MOD features"
            icon={<Sparkles className="h-4 w-4" />}
            description="What this build unlocks. Shown as the feature grid on the game page."
          >
            <ListEditor
              label="Features"
              values={draft.modFeatures}
              onChange={(v) => set('modFeatures', v)}
              maxItems={30}
              tone="positive"
              placeholder="Unlimited Coins"
              error={errors.modFeatures}
            />
          </FormSection>

          <FormSection
            title="Installation guide"
            icon={<ListChecks className="h-4 w-4" />}
            actions={
              <button
                type="button"
                onClick={() => set('installationGuide', defaultInstallGuide(draft.name))}
                className="btn-ghost btn-sm btn"
              >
                Use default steps
              </button>
            }
          >
            <ListEditor
              label="Steps"
              values={draft.installationGuide}
              onChange={(v) => set('installationGuide', v)}
              maxItems={20}
              placeholder="Add a step"
            />
          </FormSection>

          {/* ── media ── */}
          <FormSection title="Media" icon={<Package className="h-4 w-4" />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageField
                label="Icon"
                value={draft.icon ?? null}
                onChange={(a) => set('icon', a)}
                folder="icons"
                ownerSlug={draft.slug || undefined}
                aspect="square"
                hint="Square. Shown on cards and search results."
              />
              <ImageField
                label="Banner"
                value={draft.banner ?? null}
                onChange={(a) => set('banner', a)}
                folder="banners"
                ownerSlug={draft.slug || undefined}
                aspect="banner"
                hint="16:9. Used as the page header and OG image."
              />
            </div>
            <GalleryField
              label="Screenshots"
              values={draft.screenshots}
              onChange={(v) => set('screenshots', v as MediaAsset[])}
              folder="screenshots"
              ownerSlug={draft.slug || undefined}
              max={20}
              hint="Three or more converts noticeably better."
            />
          </FormSection>

          {/* ── downloads ── */}
          <FormSection
            title="Download links"
            icon={<Download className="h-4 w-4" />}
            description="At least one link is needed before the listing is useful."
            actions={
              <button
                type="button"
                onClick={() =>
                  set('downloadLinks', [
                    ...draft.downloadLinks,
                    {
                      label: 'Mega (Fast)',
                      url: '',
                      kind: 'mega',
                      sizeBytes: draft.sizeBytes,
                      isPrimary: draft.downloadLinks.length === 0,
                    },
                  ])
                }
                disabled={draft.downloadLinks.length >= 12}
                className="btn-secondary btn-sm btn"
              >
                <Plus className="h-3 w-3" />
                Add link
              </button>
            }
          >
            {draft.downloadLinks.length ? (
              <div className="space-y-2.5">
                {draft.downloadLinks.map((link, i) => (
                  <div key={i} className="rounded-xl border border-line/70 bg-surface-2/40 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={link.kind}
                        onChange={(e) => updateLink(i, { kind: e.target.value as DownloadLink['kind'] })}
                        aria-label={`Link ${i + 1} type`}
                        className="input h-8 w-auto py-0 text-xs"
                      >
                        {LINK_KINDS.map((k) => (
                          <option key={k.value} value={k.value}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                      <input
                        value={link.label}
                        onChange={(e) => updateLink(i, { label: e.target.value })}
                        placeholder="Button label"
                        aria-label={`Link ${i + 1} label`}
                        className="input h-8 w-36 py-0 text-xs"
                      />
                      <label className="flex items-center gap-1.5 text-2xs text-muted">
                        <input
                          type="checkbox"
                          checked={link.isPrimary}
                          onChange={(e) => {
                            // Only one link can be primary.
                            const next = draft.downloadLinks.map((l, x) => ({
                              ...l,
                              isPrimary: x === i ? e.target.checked : false,
                            }));
                            set('downloadLinks', next);
                          }}
                          className="h-3.5 w-3.5 rounded border-line bg-surface-2 text-brand focus:ring-2 focus:ring-brand/30"
                        />
                        Primary
                      </label>
                      <button
                        type="button"
                        onClick={() => set('downloadLinks', draft.downloadLinks.filter((_, x) => x !== i))}
                        aria-label={`Remove link ${i + 1}`}
                        className="ml-auto text-faint transition-colors hover:text-danger"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      value={link.url}
                      onChange={(e) => updateLink(i, { url: e.target.value })}
                      placeholder="https://mega.nz/file/..."
                      aria-label={`Link ${i + 1} URL`}
                      className="input mt-2 font-mono text-xs"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
                No download links yet. Add at least one so visitors have something to download.
              </p>
            )}

            <div className="grid gap-4 border-t border-line/60 pt-4 sm:grid-cols-2">
              <TextField
                label="Play Store URL"
                value={draft.playStoreUrl ?? ''}
                onChange={(v) => set('playStoreUrl', v || null)}
                type="url"
                mono
                placeholder="https://play.google.com/store/apps/details?id=..."
              />
              <TextField
                label="Mega URL"
                value={draft.megaUrl ?? ''}
                onChange={(v) => set('megaUrl', v || null)}
                type="url"
                mono
                placeholder="https://mega.nz/file/..."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="MOD APK URL"
                value={draft.modApkUrl ?? ''}
                onChange={(v) => set('modApkUrl', v || null)}
                type="url"
                mono
                placeholder="Mirror or direct link"
              />
              <TextField
                label="Original APK URL"
                value={draft.originalApkUrl ?? ''}
                onChange={(v) => set('originalApkUrl', v || null)}
                type="url"
                mono
                placeholder="Unmodified build"
              />
            </div>
          </FormSection>

          <SeoPanel
            seo={draft.seo}
            onChange={(s) => set('seo', s)}
            path={`/game/${draft.slug || 'slug'}`}
            onAutoFill={autoFillSeo}
          />
        </div>

        {/* ── sidebar ── */}
        <div className="space-y-5">
          <FormSection title="Visibility" icon={<Star className="h-4 w-4" />}>
            <Toggle
              checked={draft.featured}
              onChange={(v) => set('featured', v)}
              label="Featured"
              hint="Appears in the homepage hero rotation."
              icon={<Star className="h-3.5 w-3.5 text-warning" />}
            />
            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Collections</span>
              <div className="flex flex-wrap gap-1.5">
                {GAME_COLLECTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCollection(c)}
                    className={cn('chip text-2xs', draft.collections.includes(c) && 'chip-active')}
                  >
                    {COLLECTION_LABELS[c]}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-2xs text-faint">Drives the homepage rails and /collection pages.</p>
            </div>
          </FormSection>

          <FormSection title="Taxonomy">
            <TagInput
              label="Genres"
              values={draft.genres}
              onChange={(v) => set('genres', v)}
              maxItems={12}
              suggestions={['Arcade', 'Runner', 'Sandbox', 'Multiplayer', 'Offline', 'Open World']}
            />
            <TagInput
              label="Tags"
              values={draft.tags}
              onChange={(v) => set('tags', v)}
              maxItems={24}
              suggestions={['mod apk', 'android', 'unlimited money', 'offline', 'mod menu']}
            />
          </FormSection>

          <FormSection title="Rating" icon={<Star className="h-4 w-4" />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Rating (0–5)"
                value={String(draft.rating)}
                onChange={(v) => {
                  const n = Number.parseFloat(v);
                  set('rating', Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : 0);
                }}
                type="number"
                mono
              />
              <TextField
                label="Rating count"
                value={String(draft.ratingCount)}
                onChange={(v) => {
                  const n = Number.parseInt(v, 10);
                  set('ratingCount', Number.isFinite(n) && n >= 0 ? n : 0);
                }}
                type="number"
                mono
              />
            </div>
            {id ? (
              <div className="rounded-xl bg-surface-2/50 px-3.5 py-2.5">
                <div className="flex justify-between text-2xs">
                  <span className="text-faint">Downloads</span>
                  <span className="font-mono tabular-nums text-ink">{draft.downloads.toLocaleString()}</span>
                </div>
                <div className="mt-1 flex justify-between text-2xs">
                  <span className="text-faint">Views</span>
                  <span className="font-mono tabular-nums text-ink">{draft.views.toLocaleString()}</span>
                </div>
                <p className="mt-1.5 text-2xs text-faint">Traffic counters are never overwritten by an edit.</p>
              </div>
            ) : null}
          </FormSection>

          <FormSection title="Virus scan" icon={<ShieldCheck className="h-4 w-4" />}>
            <SelectField
              label="Status"
              value={draft.virusScan?.status ?? 'unscanned'}
              onChange={(v) =>
                set('virusScan', {
                  ...(draft.virusScan ?? emptyDraft().virusScan!),
                  status: v as NonNullable<Draft['virusScan']>['status'],
                  scannedAt: v === 'unscanned' ? null : new Date().toISOString(),
                })
              }
              options={[
                { value: 'unscanned', label: 'Not scanned' },
                { value: 'clean', label: 'Clean' },
                { value: 'suspicious', label: 'Suspicious' },
                { value: 'failed', label: 'Scan failed' },
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Engines"
                value={String(draft.virusScan?.engines ?? 0)}
                onChange={(v) => {
                  const n = Number.parseInt(v, 10);
                  set('virusScan', {
                    ...(draft.virusScan ?? emptyDraft().virusScan!),
                    engines: Number.isFinite(n) && n >= 0 ? n : 0,
                  });
                }}
                type="number"
                mono
              />
              <TextField
                label="Detections"
                value={String(draft.virusScan?.detections ?? 0)}
                onChange={(v) => {
                  const n = Number.parseInt(v, 10);
                  set('virusScan', {
                    ...(draft.virusScan ?? emptyDraft().virusScan!),
                    detections: Number.isFinite(n) && n >= 0 ? n : 0,
                  });
                }}
                type="number"
                mono
              />
            </div>
            <TextField
              label="Provider"
              value={draft.virusScan?.provider ?? 'manual'}
              onChange={(v) =>
                set('virusScan', { ...(draft.virusScan ?? emptyDraft().virusScan!), provider: v || 'manual' })
              }
              maxLength={60}
            />
          </FormSection>

          <FormSection title="Dates" icon={<HardDrive className="h-4 w-4" />}>
            <TextField
              label="Release date"
              value={draft.releaseDate ? draft.releaseDate.slice(0, 10) : ''}
              onChange={(v) => set('releaseDate', v ? new Date(v).toISOString() : null)}
              type="text"
              mono
              placeholder="YYYY-MM-DD"
            />
            <TextField
              label="Last updated"
              value={draft.updatedDate ? draft.updatedDate.slice(0, 10) : ''}
              onChange={(v) => set('updatedDate', v ? new Date(v).toISOString() : null)}
              type="text"
              mono
              placeholder="YYYY-MM-DD"
              hint="Shown as the 'Updated' date on the listing."
            />
          </FormSection>
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
        previewHref={draft.status === 'published' ? `/game/${draft.slug}` : null}
        errorCount={Object.keys(errors).length}
      />
    </div>
  );
}
