'use client';

import { Search, Sparkles } from 'lucide-react';
import type { Seo } from '@modverse/shared';
import { FormSection, TagInput, TextArea, TextField } from './Fields';
import { cn } from '@/lib/utils';

/**
 * SEO editor with a live Google-style preview.
 *
 * The preview uses the same truncation rules search engines apply, so the
 * admin can see exactly where a title or description will be cut instead of
 * guessing from a character count.
 */

const TITLE_LIMIT = 60;
const DESC_LIMIT = 160;

function truncateForPreview(text: string, limit: number): { shown: string; truncated: boolean } {
  if (text.length <= limit) return { shown: text, truncated: false };
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return { shown: (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd(), truncated: true };
}

export function SeoPanel({
  seo,
  onChange,
  path,
  siteUrl = 'https://modszora.app',
  onAutoFill,
  autoFillBusy,
}: {
  seo: Seo;
  onChange: (seo: Seo) => void;
  path: string;
  siteUrl?: string;
  onAutoFill?: () => void;
  autoFillBusy?: boolean;
}) {
  const set = <K extends keyof Seo>(key: K, value: Seo[K]) => onChange({ ...seo, [key]: value });

  const title = truncateForPreview(seo.title || 'Untitled page', TITLE_LIMIT);
  const desc = truncateForPreview(seo.description || 'No meta description set.', DESC_LIMIT);
  const displayUrl = `${siteUrl.replace(/^https?:\/\//, '')}${path}`;

  return (
    <FormSection
      title="SEO"
      description="How this page appears in search results and when shared."
      icon={<Search className="h-4 w-4" />}
      actions={
        onAutoFill ? (
          <button type="button" onClick={onAutoFill} disabled={autoFillBusy} className="btn-secondary btn-sm btn">
            <Sparkles className={cn('h-3.5 w-3.5', autoFillBusy && 'animate-pulse')} />
            Auto-fill
          </button>
        ) : undefined
      }
    >
      {/* live SERP preview */}
      <div className="rounded-xl border border-line/70 bg-surface-2/50 p-4">
        <p className="mb-2 text-2xs font-bold uppercase tracking-wider text-faint">Search preview</p>
        <div className="max-w-xl">
          <p className="truncate text-2xs text-success">{displayUrl}</p>
          <p className="mt-0.5 text-base leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
            {title.shown}
            {title.truncated ? <span className="text-faint">…</span> : null}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            {desc.shown}
            {desc.truncated ? <span className="text-faint">…</span> : null}
          </p>
        </div>
        {(title.truncated || desc.truncated) && (
          <p className="mt-2 text-2xs text-warning">
            {title.truncated ? 'Title' : ''}
            {title.truncated && desc.truncated ? ' and description' : desc.truncated ? 'Description' : ''} will be
            truncated in results.
          </p>
        )}
      </div>

      <TextField
        label="SEO title"
        value={seo.title ?? ''}
        onChange={(v) => set('title', v)}
        maxLength={70}
        minLength={10}
        placeholder="Game Name MOD APK 1.2.3 (Unlimited Money)"
        hint="Aim for 30–60 characters. Front-load the words people search for."
        required
      />

      <TextArea
        label="Meta description"
        value={seo.description ?? ''}
        onChange={(v) => set('description', v)}
        maxLength={180}
        minLength={50}
        rows={3}
        placeholder="Download … — what the reader gets, in one sentence."
        hint="140–160 characters reads best. Describe the payoff, not the page."
        required
      />

      <TagInput
        label="Keywords"
        values={seo.keywords ?? []}
        onChange={(v) => set('keywords', v)}
        maxItems={20}
        placeholder="Add a search phrase"
        hint="Real phrases people type. Three to twelve is plenty."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="OpenGraph title"
          value={seo.ogTitle ?? ''}
          onChange={(v) => set('ogTitle', v || null)}
          maxLength={95}
          placeholder="Defaults to the SEO title"
        />
        <TextField
          label="Twitter title"
          value={seo.twitterTitle ?? ''}
          onChange={(v) => set('twitterTitle', v || null)}
          maxLength={70}
          placeholder="Defaults to the SEO title"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextArea
          label="OpenGraph description"
          value={seo.ogDescription ?? ''}
          onChange={(v) => set('ogDescription', v || null)}
          maxLength={200}
          rows={2}
          placeholder="Defaults to the meta description"
        />
        <TextArea
          label="Twitter description"
          value={seo.twitterDescription ?? ''}
          onChange={(v) => set('twitterDescription', v || null)}
          maxLength={200}
          rows={2}
          placeholder="Defaults to the meta description"
        />
      </div>

      <TextField
        label="Canonical URL"
        value={seo.canonical ?? ''}
        onChange={(v) => set('canonical', v || null)}
        type="url"
        mono
        placeholder={`${siteUrl}${path}`}
        hint="Leave empty unless this page duplicates another URL."
      />

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line/70 bg-surface-2/40 px-3.5 py-3">
        <input
          type="checkbox"
          checked={seo.noindex ?? false}
          onChange={(e) => set('noindex', e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-line bg-surface-2 text-brand focus:ring-2 focus:ring-brand/30"
        />
        <span>
          <span className="block text-sm font-medium text-ink">Hide from search engines</span>
          <span className="mt-0.5 block text-2xs text-faint">
            Adds <code className="font-mono">noindex, nofollow</code>. Use for thin or duplicate pages.
          </span>
        </span>
      </label>
    </FormSection>
  );
}

/** Builds a complete SEO object from the content, used by every "Auto-fill" button. */
export function deriveSeo(input: {
  title: string;
  description: string;
  keywords?: string[];
  imageUrl?: string | null;
}): Seo {
  const title = input.title.slice(0, 70);
  const description = input.description.slice(0, 180);
  return {
    title,
    description,
    keywords: input.keywords ?? [],
    canonical: null,
    ogTitle: title.slice(0, 95),
    ogDescription: description.slice(0, 198),
    ogImage: input.imageUrl ?? null,
    twitterCard: 'summary_large_image',
    twitterTitle: title.slice(0, 70),
    twitterDescription: description.slice(0, 198),
    jsonLd: null,
    noindex: false,
  };
}
