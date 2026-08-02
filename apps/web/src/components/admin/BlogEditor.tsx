'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Newspaper,
  Sparkles,
  Star,
  Trash2,
  Wand2,
  XCircle,
} from 'lucide-react';
import {
  BLOG_CATEGORIES,
  BLOG_TEMPLATE_LABELS,
  BLOG_TEMPLATES,
  readingMinutes,
  slugify,
  type BlogPost,
  type BlogTemplate,
  type PublishStatus,
  type Seo,
} from '@modverse/shared';
import { FormSection, SelectField, TagInput, TextArea, TextField, Toggle } from '@/components/admin/form/Fields';
import { GalleryField, ImageField } from '@/components/admin/form/ImageField';
import { SeoPanel, deriveSeo } from '@/components/admin/form/SeoPanel';
import { PublishBar } from '@/components/admin/form/PublishBar';
import { cn } from '@/lib/utils';

type Draft = Omit<BlogPost, 'seo'> & { seo: Seo };

function emptyDraft(isNews = false): Draft {
  return {
    title: '',
    slug: '',
    category: isNews ? 'news' : 'guides',
    excerpt: '',
    content: '',
    cover: null,
    gallery: [],
    tags: [],
    author: 'MODVerse Editorial',
    readingMinutes: 4,
    featured: false,
    views: 0,
    isNews,
    relatedGameSlug: null,
    status: 'draft',
    publishedAt: null,
    scheduledFor: null,
    seo: deriveSeo({ title: '', description: '' }),
  };
}

export function BlogEditor({
  initial,
  id,
  games = [],
  isNews = false,
  presetTemplate,
  presetTopic,
}: {
  initial?: BlogPost & { id?: string };
  id?: string | null;
  games?: Array<{ slug: string; name: string }>;
  isNews?: boolean;
  presetTemplate?: BlogTemplate | null;
  presetTopic?: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() =>
    initial ? { ...emptyDraft(isNews), ...initial } : emptyDraft(isNews),
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));

  const [template, setTemplate] = useState<BlogTemplate>(presetTemplate ?? (isNews ? 'news-roundup' : 'how-to-install'));
  const [topic, setTopic] = useState(presetTopic ?? '');
  const [wordCount, setWordCount] = useState(1100);

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  useEffect(() => {
    if (!slugTouched && draft.title) setDraft((d) => ({ ...d, slug: slugify(d.title) }));
  }, [draft.title, slugTouched]);

  // Keep the reading estimate honest as the body changes.
  useEffect(() => {
    const plain = draft.content.replace(/<[^>]+>/g, ' ');
    const mins = readingMinutes(plain);
    if (mins !== draft.readingMinutes && plain.trim().length > 50) {
      setDraft((d) => ({ ...d, readingMinutes: mins }));
    }
  }, [draft.content, draft.readingMinutes]);

  const wordTotal = useMemo(
    () => draft.content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
    [draft.content],
  );

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (draft.title.trim().length < 6) e.title = 'Title must be at least 6 characters.';
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(draft.slug)) e.slug = 'Slug must be lowercase words separated by hyphens.';
    if (draft.excerpt.trim().length < 40) e.excerpt = 'Excerpt must be at least 40 characters.';
    if (draft.content.trim().length < 200) e.content = 'Content must be at least 200 characters.';
    if ((draft.seo.title ?? '').length < 10) e.seoTitle = 'SEO title must be at least 10 characters.';
    if ((draft.seo.description ?? '').length < 50) e.seoDescription = 'Meta description must be at least 50 characters.';
    return e;
  }, [draft]);

  const valid = Object.keys(errors).length === 0;

  async function generate() {
    setGenerating(true);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/agent/generate/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template,
          topic: topic || null,
          gameSlug: draft.relatedGameSlug,
          gameNames: games.slice(0, 10).map((g) => g.name),
          category: draft.category,
          isNews: draft.isNews,
          wordCount,
          autoPublish: false,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Generation could not start');

      setNotice({
        kind: 'ok',
        text: 'Article generation started. It appears as a draft in the list when the job finishes — usually under a minute.',
      });
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Generation failed.' });
    } finally {
      setGenerating(false);
    }
  }

  async function save(status?: PublishStatus) {
    if (!valid) {
      setNotice({ kind: 'err', text: 'Fix the highlighted fields before saving.' });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(id ? `/api/admin/posts/${id}` : '/api/admin/posts', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(status ? { ...draft, status } : draft),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Save failed');
      setNotice({ kind: 'ok', text: id ? 'Post updated.' : 'Post created.' });
      if (!id && json.data?.id) router.replace(`/admin/blog/${json.data.id}`);
      router.refresh();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!id || !confirm('Delete this post? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/posts/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Delete failed');
      router.push(draft.isNews ? '/admin/news' : '/admin/blog');
      router.refresh();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Delete failed.' });
      setDeleting(false);
    }
  }

  const kindLabel = draft.isNews ? 'news article' : 'blog post';

  return (
    <div className="space-y-6 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(draft.isNews ? '/admin/news' : '/admin/blog')}
            className="btn-ghost btn-sm btn"
            aria-label="Back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-extrabold">
              {id ? draft.title || `Edit ${kindLabel}` : `New ${kindLabel}`}
            </h1>
            <p className="text-2xs text-faint">
              {id ? `/blog/${draft.slug}` : 'Write manually or generate with AI'}
              {wordTotal > 0 ? ` · ${wordTotal} words · ${draft.readingMinutes} min read` : ''}
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
        <div className={cn('flex items-start gap-2.5 rounded-xl p-3.5', notice.kind === 'ok' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger')}>
          {notice.kind === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <p className="text-sm">{notice.text}</p>
        </div>
      ) : null}

      {/* ═══ Article Generator ═══ */}
      <section className="card-gradient">
        <div className="p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-bold">
            <Wand2 className="h-4 w-4 text-brand" />
            Article Generator
          </h2>
          <p className="mt-1 text-xs text-muted">
            Pick a template and the agent writes a complete, structured article grounded in your live catalogue.
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <SelectField
              label="Template"
              value={template}
              onChange={(v) => setTemplate(v)}
              options={BLOG_TEMPLATES.map((t) => ({ value: t, label: BLOG_TEMPLATE_LABELS[t] }))}
            />
            <TextField
              label="Topic (optional)"
              value={topic}
              onChange={setTopic}
              placeholder="Leave empty to use the template default"
              maxLength={240}
            />
            <div className="flex items-end">
              <button type="button" onClick={generate} disabled={generating} className="btn-primary btn w-full lg:w-auto">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-2xs text-muted">
              Length
              <input
                type="range"
                min={500}
                max={2400}
                step={100}
                value={wordCount}
                onChange={(e) => setWordCount(Number(e.target.value))}
                className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-surface-2 accent-brand"
              />
              <span className="font-mono tabular-nums text-ink">{wordCount}w</span>
            </label>
            <p className="text-2xs text-faint">
              Templates: {BLOG_TEMPLATES.map((t) => BLOG_TEMPLATE_LABELS[t]).join(' · ')}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="space-y-5">
          <FormSection title="Content" icon={draft.isNews ? <Newspaper className="h-4 w-4" /> : <FileText className="h-4 w-4" />}>
            <TextField
              label="Title"
              value={draft.title}
              onChange={(v) => set('title', v)}
              maxLength={180}
              minLength={6}
              placeholder="How to Install MOD APK Files Safely on Android"
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
              error={errors.slug}
              required
            />
            <TextArea
              label="Excerpt"
              value={draft.excerpt}
              onChange={(v) => set('excerpt', v)}
              rows={3}
              maxLength={400}
              minLength={40}
              placeholder="The promise of the article in one or two sentences."
              error={errors.excerpt}
              required
            />
            <TextArea
              label="Body (HTML)"
              value={draft.content}
              onChange={(v) => set('content', v)}
              rows={22}
              maxLength={80000}
              minLength={200}
              mono
              placeholder="<p>Opening paragraph…</p>&#10;<h2>Section</h2>"
              error={errors.content}
              hint="Use <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong> and <blockquote>."
              required
            />
          </FormSection>

          <FormSection title="Media" icon={<ImageIcon className="h-4 w-4" />}>
            <ImageField
              label="Featured image"
              value={draft.cover ?? null}
              onChange={(a) => set('cover', a)}
              folder="covers"
              ownerSlug={draft.slug || undefined}
              hint="Used on cards and social shares."
            />
            <GalleryField
              label="Gallery"
              values={draft.gallery}
              onChange={(v) => set('gallery', v)}
              folder="uploads"
              ownerSlug={draft.slug || undefined}
              max={12}
              hint="Optional images rendered in an in-article gallery."
            />
          </FormSection>

          <SeoPanel
            seo={draft.seo}
            onChange={(s) => set('seo', s)}
            path={`/blog/${draft.slug || 'slug'}`}
            onAutoFill={() =>
              set(
                'seo',
                deriveSeo({
                  title: draft.title.slice(0, 70),
                  description: draft.excerpt.slice(0, 180),
                  keywords: [...draft.tags, draft.category, 'android', 'mod apk'].slice(0, 12),
                  imageUrl: draft.cover?.url ?? null,
                }),
              )
            }
          />
        </div>

        <div className="space-y-5">
          <FormSection title="Classification">
            <SelectField
              label="Category"
              value={draft.category}
              onChange={(v) => set('category', v)}
              options={BLOG_CATEGORIES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
            />
            <Toggle
              checked={draft.isNews}
              onChange={(v) => set('isNews', v)}
              label="News article"
              hint="News appears in the news feed; guides stay evergreen."
              icon={<Newspaper className="h-3.5 w-3.5 text-brand" />}
            />
            <Toggle
              checked={draft.featured}
              onChange={(v) => set('featured', v)}
              label="Featured"
              hint="Pinned to the top of the index."
              icon={<Star className="h-3.5 w-3.5 text-warning" />}
            />
            <TagInput
              label="Tags"
              values={draft.tags}
              onChange={(v) => set('tags', v)}
              maxItems={16}
              suggestions={['android', 'mod apk', 'guide', 'tips', 'install', 'update', 'security']}
            />
            <SelectField
              label="Related game"
              value={draft.relatedGameSlug ?? ''}
              onChange={(v) => set('relatedGameSlug', v || null)}
              options={[{ value: '', label: 'None' }, ...games.map((g) => ({ value: g.slug, label: g.name }))]}
              hint="Cross-links the article and the listing."
            />
          </FormSection>

          <FormSection title="Attribution">
            <TextField label="Author" value={draft.author} onChange={(v) => set('author', v)} maxLength={80} />
            <div className="rounded-xl bg-surface-2/50 px-3.5 py-2.5">
              <div className="flex justify-between text-2xs">
                <span className="text-faint">Words</span>
                <span className="font-mono tabular-nums text-ink">{wordTotal}</span>
              </div>
              <div className="mt-1 flex justify-between text-2xs">
                <span className="text-faint">Reading time</span>
                <span className="font-mono tabular-nums text-ink">{draft.readingMinutes} min</span>
              </div>
              {id ? (
                <div className="mt-1 flex justify-between text-2xs">
                  <span className="text-faint">Views</span>
                  <span className="font-mono tabular-nums text-ink">{draft.views.toLocaleString()}</span>
                </div>
              ) : null}
            </div>
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
        previewHref={draft.status === 'published' ? `/blog/${draft.slug}` : null}
        errorCount={Object.keys(errors).length}
      />
    </div>
  );
}
