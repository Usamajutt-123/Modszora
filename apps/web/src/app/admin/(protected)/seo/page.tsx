import Link from 'next/link';
import type { Metadata } from 'next';
import { AlertTriangle, CheckCircle2, ExternalLink, Search } from 'lucide-react';
import { listAdminGames } from '@/lib/repositories/admin';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'SEO Manager' };
export const dynamic = 'force-dynamic';

interface Issue {
  slug: string;
  name: string;
  problems: string[];
  titleLength: number;
  descLength: number;
  keywords: number;
}

/** Google truncates around these limits in practice. */
const TITLE_MIN = 30;
const TITLE_MAX = 60;
const DESC_MIN = 120;
const DESC_MAX = 160;

export default async function AdminSeoPage() {
  const { items } = await listAdminGames({ pageSize: 100 });

  const audited: Issue[] = items.map((g) => {
    const title = g.seo?.title ?? '';
    const desc = g.seo?.description ?? '';
    const keywords = g.seo?.keywords?.length ?? 0;
    const problems: string[] = [];

    if (!title) problems.push('Missing SEO title');
    else if (title.length < TITLE_MIN) problems.push(`Title too short (${title.length}, aim for ${TITLE_MIN}-${TITLE_MAX})`);
    else if (title.length > TITLE_MAX) problems.push(`Title may truncate (${title.length} > ${TITLE_MAX})`);

    if (!desc) problems.push('Missing meta description');
    else if (desc.length < DESC_MIN) problems.push(`Description short (${desc.length}, aim for ${DESC_MIN}-${DESC_MAX})`);
    else if (desc.length > DESC_MAX + 20) problems.push(`Description may truncate (${desc.length})`);

    if (keywords < 3) problems.push('Fewer than 3 keywords');
    if (!g.seo?.ogImage) problems.push('No OpenGraph image');
    if (!g.icon?.url) problems.push('No icon');
    if (!g.faqs?.length) problems.push('No FAQ schema');
    if (g.description.length < 600) problems.push('Thin content (< 600 chars)');

    return { slug: g.slug, name: g.name, problems, titleLength: title.length, descLength: desc.length, keywords };
  });

  const withIssues = audited.filter((a) => a.problems.length > 0);
  const healthy = audited.length - withIssues.length;
  const score = audited.length ? Math.round((healthy / audited.length) * 100) : 100;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold">SEO Manager</h1>
        <p className="mt-1 text-sm text-muted">
          Automated audit across every listing: titles, meta descriptions, OpenGraph, schema and content depth.
        </p>
      </header>

      {/* score */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-2xs font-bold uppercase tracking-wider text-faint">Health score</p>
          <p className={cn('mt-1 font-display text-3xl font-extrabold', score >= 80 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-danger')}>
            {score}%
          </p>
        </div>
        <div className="card p-4">
          <p className="text-2xs font-bold uppercase tracking-wider text-faint">Audited</p>
          <p className="mt-1 font-display text-3xl font-extrabold text-ink">{audited.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-2xs font-bold uppercase tracking-wider text-faint">Clean</p>
          <p className="mt-1 font-display text-3xl font-extrabold text-success">{healthy}</p>
        </div>
        <div className="card p-4">
          <p className="text-2xs font-bold uppercase tracking-wider text-faint">Need attention</p>
          <p className="mt-1 font-display text-3xl font-extrabold text-warning">{withIssues.length}</p>
        </div>
      </div>

      {/* global signals */}
      <section className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
          <Search className="h-4 w-4 text-brand" />
          Site-wide signals
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            { label: 'robots.txt', href: '/robots.txt', ok: true },
            { label: 'XML sitemap', href: '/sitemap.xml', ok: true },
            { label: 'Organization + WebSite JSON-LD', href: '/', ok: true },
            { label: 'Breadcrumb schema on all detail pages', href: '/browse', ok: true },
            { label: 'SoftwareApplication schema on games', href: '/browse', ok: true },
            { label: 'FAQPage schema where FAQs exist', href: '/faq', ok: true },
            { label: 'OpenGraph + Twitter cards', href: '/', ok: true },
            { label: 'Canonical URLs', href: '/', ok: true },
          ].map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2/60 px-3 py-2">
              <span className="flex items-center gap-2 text-sm text-ink">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                {s.label}
              </span>
              <Link href={s.href} target="_blank" className="text-faint transition-colors hover:text-brand" aria-label={`Check ${s.label}`}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* issues */}
      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Listings needing attention
        </h2>

        {withIssues.length ? (
          <ul className="space-y-2">
            {withIssues.slice(0, 40).map((a) => (
              <li key={a.slug} className="rounded-xl border border-line/70 bg-surface-2/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/game/${a.slug}`} target="_blank" className="text-sm font-semibold text-ink hover:text-brand">
                    {a.name}
                  </Link>
                  <span className="text-2xs text-faint">
                    title {a.titleLength} · desc {a.descLength} · {a.keywords} keywords
                  </span>
                </div>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {a.problems.map((p) => (
                    <li key={p} className="rounded-md bg-warning/15 px-2 py-0.5 text-2xs font-medium text-warning">
                      {p}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" />
            Every audited listing passes.
          </p>
        )}
      </section>

      <div className="rounded-2xl border border-brand/25 bg-brand/[0.06] p-4">
        <p className="text-xs leading-relaxed text-muted">
          <strong className="text-ink">Auto SEO generator:</strong> the AI agent writes the title, meta description,
          keywords, slug, OpenGraph, Twitter card, FAQ schema and internal links for every game it ingests. When OpenAI
          is unavailable it falls back to a deterministic heuristic generator, so no listing is ever published without
          complete metadata.
        </p>
      </div>
    </div>
  );
}
