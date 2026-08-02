'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Expand,
  Gamepad2,
  Languages,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TrendingUp,
  Trash,
  XCircle,
} from 'lucide-react';
import {
  slugify,
  TRANSLATE_LANGUAGES,
  type PublishStatus,
  type Review,
  type ReviewAction,
  type Seo,
} from '@modverse/shared';
import { FormSection, ListEditor, ScoreSlider, SelectField, TextArea, TextField, Toggle } from '@/components/admin/form/Fields';
import { ImageField } from '@/components/admin/form/ImageField';
import { SeoPanel, deriveSeo } from '@/components/admin/form/SeoPanel';
import { PublishBar } from '@/components/admin/form/PublishBar';
import { cn } from '@/lib/utils';

type Draft = Omit<Review, 'seo'> & { seo: Seo };

const DEFAULT_BREAKDOWN = { gameplay: 7.5, graphics: 7.5, content: 7.5, performance: 7.5, value: 8.5 };

function emptyDraft(): Draft {
  return {
    title: '',
    slug: '',
    gameSlug: null,
    summary: '',
    body: '',
    score: 7.5,
    scoreBreakdown: { ...DEFAULT_BREAKDOWN },
    pros: [],
    cons: [],
    verdict: '',
    gameplay: null,
    graphics: null,
    performance: null,
    cover: null,
    author: 'MODVerse Editorial',
    featured: false,
    status: 'draft',
    publishedAt: null,
    scheduledFor: null,
    seo: deriveSeo({ title: '', description: '' }),
  };
}

/** The six actions exposed by the Review Generator panel. */
const ACTIONS: Array<{
  action: ReviewAction;
  label: string;
  icon: typeof Sparkles;
  hint: string;
  needsExisting: boolean;
}> = [
  { action: 'generate', label: 'Generate review', icon: Sparkles, hint: 'Write a complete review from the game data.', needsExisting: false },
  { action: 'regenerate', label: 'Regenerate', icon: RefreshCw, hint: 'Rewrite from scratch with a fresh angle.', needsExisting: true },
  { action: 'improve-seo', label: 'Improve SEO', icon: Search, hint: 'Retarget the title and headings for search.', needsExisting: true },
  { action: 'improve-rating', label: 'Improve rating', icon: TrendingUp, hint: 'Make the sub-scores and prose consistent.', needsExisting: true },
  { action: 'expand', label: 'Expand review', icon: Expand, hint: 'Add depth on performance, pacing and value.', needsExisting: true },
  { action: 'translate', label: 'Translate', icon: Languages, hint: 'Translate the whole review, keeping structure.', needsExisting: true },
];

export function ReviewEditor({
  initial,
  id,
  games = [],
  presetGameSlug,
}: {
  initial?: Review & { id?: string };
  id?: string | null;
  games?: Array<{ slug: string; name: string }>;
  presetGameSlug?: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => (initial ? { ...emptyDraft(), ...initial } : emptyDraft()));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busyAction, setBusyAction] = useState<ReviewAction | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [language, setLanguage] = useState<string>('es');
  const [tone, setTone] = useState<'balanced' | 'enthusiastic' | 'critical'>('balanced');

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  useEffect(() => {
    if (!slugTouched && draft.title) setDraft((d) => ({ ...d, slug: slugify(d.title) }));
  }, [draft.title, slugTouched]);

  useEffect(() => {
    if (presetGameSlug && !draft.gameSlug) set('gameSlug', presetGameSlug);
  }, [presetGameSlug, draft.gameSlug, set]);

  const hasContent = draft.body.length > 100;
  const selectedGame = games.find((g) => g.slug === draft.gameSlug);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (draft.title.trim().length < 6) e.title = 'Title must be at least 6 characters.';
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(draft.slug)) e.slug = 'Slug must be lowercase words separated by hyphens.';
    if (draft.summary.trim().length < 40) e.summary = 'Summary must be at least 40 characters.';
    if (draft.body.trim().length < 200) e.body = 'Body must be at least 200 characters.';
    if (draft.verdict.trim().length < 40) e.verdict = 'Verdict must be at least 40 characters.';
    if (!draft.pros.length) e.pros = 'Add at least one pro.';
    if (!draft.cons.length) e.cons = 'Add at least one con.';
    if ((draft.seo.title ?? '').length < 10) e.seoTitle = 'SEO title must be at least 10 characters.';
    if ((draft.seo.description ?? '').length < 50) e.seoDescription = 'Meta description must be at least 50 characters.';
    return e;
  }, [draft]);

  const valid = Object.keys(errors).length === 0;

  /** Recomputes the headline score as the average of its parts. */
  const recomputeScore = useCallback(() => {
    const b = draft.scoreBreakdown ?? DEFAULT_BREAKDOWN;
    const avg = Object.values(b).reduce((a, x) => a + x, 0) / 5;
    set('score', Number(avg.toFixed(1)));
  }, [draft.scoreBreakdown, set]);

  async function runAction(action: ReviewAction) {
    if (!draft.gameSlug && !selectedGame) {
      setNotice({ kind: 'err', text: 'Select the game this review is about first.' });
      return;
    }
    setBusyAction(action);
    setNotice(null);

    try {
      const res = await fetch('/api/admin/agent/generate/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          gameSlug: draft.gameSlug,
          gameName: selectedGame?.name ?? null,
          existingReview: action === 'generate' ? null : draft,
          targetLanguage: action === 'translate' ? language : null,
          tone,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Generation failed');

      const r = json.data.review as {
        title: string;
        summary: string;
        body: string;
        score: number;
        scoreBreakdown: typeof DEFAULT_BREAKDOWN;
        pros: string[];
        cons: string[];
        verdict: string;
      };

      setDraft((d) => ({
        ...d,
        title: r.title,
        summary: r.summary,
        body: r.body,
        score: r.score,
        scoreBreakdown: r.scoreBreakdown,
        pros: r.pros,
        cons: r.cons,
        verdict: r.verdict,
        // Keep SEO in step unless the admin already customised it.
        seo:
          d.seo.title && action !== 'improve-seo'
            ? d.seo
            : deriveSeo({
                title: r.title.slice(0, 70),
                description: r.summary.slice(0, 180),
                keywords: d.seo.keywords,
                imageUrl: d.cover?.url ?? null,
              }),
      }));

      const via = json.data.source === 'openai' ? 'OpenAI' : 'the built-in generator';
      setNotice({ kind: 'ok', text: `Review ${action.replace('-', ' ')}d using ${via}.` });
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Generation failed.' });
    } finally {
      setBusyAction(null);
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
      const res = await fetch(id ? `/api/admin/reviews/${id}` : '/api/admin/reviews', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(status ? { ...draft, status } : draft),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Save failed');
      setNotice({ kind: 'ok', text: id ? 'Review updated.' : 'Review created.' });
      if (!id && json.data?.id) router.replace(`/admin/reviews/${json.data.id}`);
      router.refresh();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!id || !confirm('Delete this review? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Delete failed');
      router.push('/admin/reviews');
      router.refresh();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Delete failed.' });
      setDeleting(false);
    }
  }

  const scoreTone =
    draft.score >= 8.5 ? 'text-success' : draft.score >= 7 ? 'text-brand' : draft.score >= 5.5 ? 'text-warning' : 'text-danger';

  return (
    <div className="space-y-6 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.push('/admin/reviews')} className="btn-ghost btn-sm btn" aria-label="Back">
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-extrabold">{id ? draft.title || 'Edit review' : 'New review'}</h1>
            <p className="text-2xs text-faint">{id ? `/reviews/${draft.slug}` : 'Write manually or generate with AI'}</p>
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

      {/* ═══ Review Generator ═══ */}
      <section className="card-gradient">
        <div className="p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-display text-base font-bold">
                <Sparkles className="h-4 w-4 text-brand" />
                Review Generator
              </h2>
              <p className="mt-1 text-xs text-muted">
                {selectedGame
                  ? `Grounded in the stored facts for ${selectedGame.name}.`
                  : 'Select a game below to enable generation.'}
              </p>
            </div>
            <div className="flex gap-2">
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as typeof tone)}
                aria-label="Tone"
                className="input h-8 w-auto py-0 text-xs"
              >
                <option value="balanced">Balanced tone</option>
                <option value="enthusiastic">Enthusiastic</option>
                <option value="critical">Critical</option>
              </select>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                aria-label="Translation language"
                className="input h-8 w-auto py-0 text-xs"
              >
                {TRANSLATE_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ACTIONS.map(({ action, label, icon: Icon, hint, needsExisting }) => {
              const disabled = Boolean(busyAction) || (needsExisting && !hasContent) || !draft.gameSlug;
              const busy = busyAction === action;
              return (
                <button
                  key={action}
                  type="button"
                  onClick={() => runAction(action)}
                  disabled={disabled}
                  title={needsExisting && !hasContent ? 'Generate a review first' : hint}
                  className={cn(
                    'group flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all duration-200',
                    disabled
                      ? 'cursor-not-allowed border-line/50 bg-surface-2/30 opacity-50'
                      : 'border-line bg-surface-2/60 hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-glow',
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin text-brand" /> : <Icon className="h-4 w-4 text-brand" />}
                    {label}
                  </span>
                  <span className="text-2xs leading-snug text-faint">{hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="space-y-5">
          <FormSection title="Review" icon={<Star className="h-4 w-4" />}>
            <SelectField
              label="Game"
              value={draft.gameSlug ?? ''}
              onChange={(v) => set('gameSlug', v || null)}
              options={[{ value: '', label: 'Not linked to a game' }, ...games.map((g) => ({ value: g.slug, label: g.name }))]}
              hint="Links the review to its listing and enables AI generation."
            />

            <TextField
              label="Review title"
              value={draft.title}
              onChange={(v) => set('title', v)}
              maxLength={160}
              minLength={6}
              placeholder="Game Name Review — Is the MOD Worth It?"
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
              label="Summary"
              value={draft.summary}
              onChange={(v) => set('summary', v)}
              rows={3}
              maxLength={400}
              minLength={40}
              placeholder="One paragraph a reader could stop at and still know your verdict."
              error={errors.summary}
              required
            />

            <TextArea
              label="Body (HTML)"
              value={draft.body}
              onChange={(v) => set('body', v)}
              rows={16}
              maxLength={40000}
              minLength={200}
              mono
              placeholder="<p>Opening paragraph…</p>"
              error={errors.body}
              hint="Use <p>, <h2>, <h3>, <ul>, <li> and <strong>."
              required
            />
          </FormSection>

          <FormSection title="Detailed sections" description="Optional blocks rendered separately on the review page.">
            <TextArea label="Gameplay" value={draft.gameplay ?? ''} onChange={(v) => set('gameplay', v || null)} rows={4} maxLength={8000} mono />
            <TextArea label="Graphics" value={draft.graphics ?? ''} onChange={(v) => set('graphics', v || null)} rows={4} maxLength={8000} mono />
            <TextArea label="Performance" value={draft.performance ?? ''} onChange={(v) => set('performance', v || null)} rows={4} maxLength={8000} mono />
          </FormSection>

          <div className="grid gap-5 md:grid-cols-2">
            <FormSection title="Pros" icon={<ThumbsUp className="h-4 w-4" />}>
              <ListEditor label="What works" values={draft.pros} onChange={(v) => set('pros', v)} maxItems={10} tone="positive" error={errors.pros} placeholder="Add a strength" />
            </FormSection>
            <FormSection title="Cons" icon={<ThumbsDown className="h-4 w-4" />}>
              <ListEditor label="What does not" values={draft.cons} onChange={(v) => set('cons', v)} maxItems={10} tone="negative" error={errors.cons} placeholder="Add a weakness" />
            </FormSection>
          </div>

          <FormSection title="Verdict">
            <TextArea
              label="Final verdict"
              value={draft.verdict}
              onChange={(v) => set('verdict', v)}
              rows={4}
              maxLength={1200}
              minLength={40}
              placeholder="The one paragraph a skimmer will read."
              error={errors.verdict}
              required
            />
          </FormSection>

          <SeoPanel
            seo={draft.seo}
            onChange={(s) => set('seo', s)}
            path={`/reviews/${draft.slug || 'slug'}`}
            onAutoFill={() =>
              set(
                'seo',
                deriveSeo({
                  title: `${draft.title} — ${draft.score.toFixed(1)}/10`.slice(0, 70),
                  description: draft.summary.slice(0, 180),
                  keywords: [
                    `${(selectedGame?.name ?? draft.title).toLowerCase()} review`,
                    'mod apk review',
                    'android game review',
                  ],
                  imageUrl: draft.cover?.url ?? null,
                }),
              )
            }
          />
        </div>

        {/* sidebar */}
        <div className="space-y-5">
          <FormSection
            title="Score"
            icon={<Star className="h-4 w-4" />}
            actions={
              <button type="button" onClick={recomputeScore} className="btn-ghost btn-sm btn" title="Set the overall score to the average">
                <RefreshCw className="h-3 w-3" />
                Average
              </button>
            }
          >
            <div className="rounded-xl bg-surface-2/60 p-4 text-center">
              <span className={cn('font-display text-5xl font-extrabold leading-none', scoreTone)}>
                {draft.score.toFixed(1)}
              </span>
              <span className="ml-1 text-lg font-semibold text-faint">/10</span>
            </div>

            <ScoreSlider label="Overall" value={draft.score} onChange={(v) => set('score', v)} />

            <div className="space-y-2.5 border-t border-line/60 pt-3">
              {(['gameplay', 'graphics', 'content', 'performance', 'value'] as const).map((key) => (
                <ScoreSlider
                  key={key}
                  label={key.charAt(0).toUpperCase() + key.slice(1)}
                  value={draft.scoreBreakdown?.[key] ?? 7.5}
                  onChange={(v) =>
                    set('scoreBreakdown', { ...(draft.scoreBreakdown ?? DEFAULT_BREAKDOWN), [key]: v })
                  }
                />
              ))}
            </div>
          </FormSection>

          <FormSection title="Cover image" icon={<Gamepad2 className="h-4 w-4" />}>
            <ImageField
              label="Featured image"
              value={draft.cover ?? null}
              onChange={(a) => set('cover', a)}
              folder="covers"
              ownerSlug={draft.slug || undefined}
              hint="Shown on the review card and social shares."
            />
          </FormSection>

          <FormSection title="Options">
            <TextField label="Author" value={draft.author} onChange={(v) => set('author', v)} maxLength={80} />
            <Toggle
              checked={draft.featured}
              onChange={(v) => set('featured', v)}
              label="Featured review"
              hint="Highlighted on the reviews index."
              icon={<Star className="h-3.5 w-3.5 text-warning" />}
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
        previewHref={draft.status === 'published' ? `/reviews/${draft.slug}` : null}
        errorCount={Object.keys(errors).length}
      />
    </div>
  );
}
