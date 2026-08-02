import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CheckCircle2, Gamepad2, XCircle } from 'lucide-react';
import { breadcrumbJsonLd, formatDate, reviewJsonLd, type Crumb } from '@modverse/shared';
import { getAllReviewSlugs, getReviewBySlug, listReviews } from '@/lib/repositories/content';
import { getGameBySlug } from '@/lib/repositories/games';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Prose, Section, SectionHeader } from '@/components/ui';
import { ShareButtons } from '@/components/game/ShareButtons';
import { GameCard } from '@/components/game/GameCard';
import { AdSlot } from '@/components/ads/AdSlot';
import { buildMetadata, jsonLdScript } from '@/lib/metadata';
import { env, siteUrl } from '@/lib/env';

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllReviewSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const review = await getReviewBySlug(slug);
  if (!review) {
    return buildMetadata({ title: 'Review not found', description: 'Unavailable.', path: `/reviews/${slug}`, noindex: true });
  }
  return buildMetadata({
    title: review.seo?.title || review.title,
    description: review.seo?.description || review.summary,
    path: `/reviews/${review.slug}`,
    keywords: review.seo?.keywords ?? [],
    image: review.seo?.ogImage ?? review.cover?.url ?? null,
    type: 'article',
    publishedTime: review.publishedAt,
    authors: [review.author],
  });
}

const BREAKDOWN_LABELS: Record<string, string> = {
  gameplay: 'Gameplay',
  graphics: 'Graphics',
  content: 'Content',
  performance: 'Performance',
  value: 'Value',
};

export default async function ReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const review = await getReviewBySlug(slug);
  if (!review) notFound();

  const [game, more] = await Promise.all([
    review.gameSlug ? getGameBySlug(review.gameSlug) : Promise.resolve(null),
    listReviews({ pageSize: 4 }),
  ]);

  const base = siteUrl();
  const ctx = { siteUrl: base, siteName: env.NEXT_PUBLIC_SITE_NAME || 'MODVerse' };
  const crumbs: Crumb[] = [
    { name: 'Reviews', path: '/reviews' },
    { name: review.title, path: `/reviews/${review.slug}` },
  ];
  const schemas = [reviewJsonLd(ctx, review, game?.name), breadcrumbJsonLd(ctx, crumbs)];

  const scoreColor = review.score >= 8.5 ? 'text-success' : review.score >= 7 ? 'text-brand' : review.score >= 5.5 ? 'text-warning' : 'text-danger';

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(schemas) }} />

      <article className="container py-6">
        <Breadcrumbs crumbs={crumbs} className="mb-5" />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <header>
              <h1 className="text-display-sm font-extrabold leading-tight">{review.title}</h1>
              <p className="mt-3 text-base leading-relaxed text-muted">{review.summary}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-faint">
                <span>By {review.author}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={review.publishedAt ?? undefined}>{formatDate(review.publishedAt)}</time>
              </div>
            </header>

            {review.cover?.url ? (
              <div className="relative mt-6 aspect-banner overflow-hidden rounded-2xl border border-line/70">
                <Image src={review.cover.url} alt="" fill priority sizes="(max-width:1024px) 100vw, 760px" className="object-cover" />
              </div>
            ) : null}

            {/* score panel */}
            <div className="card mt-6 p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex shrink-0 items-baseline gap-1.5">
                  <span className={`font-display text-6xl font-extrabold leading-none ${scoreColor}`}>
                    {review.score.toFixed(1)}
                  </span>
                  <span className="text-lg font-semibold text-faint">/10</span>
                </div>

                {review.scoreBreakdown ? (
                  <dl className="grid flex-1 gap-2.5 sm:grid-cols-2">
                    {Object.entries(review.scoreBreakdown).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2.5">
                        <dt className="w-24 shrink-0 text-2xs font-semibold uppercase tracking-wide text-faint">
                          {BREAKDOWN_LABELS[key] ?? key}
                        </dt>
                        <dd className="flex flex-1 items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                            <div className="h-full rounded-full bg-grad-brand" style={{ width: `${(value / 10) * 100}%` }} />
                          </div>
                          <span className="w-7 shrink-0 text-right text-2xs font-bold text-ink">{value.toFixed(1)}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            </div>

            {/* pros / cons */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-success/25 bg-success/[0.06] p-5">
                <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Pros
                </h2>
                <ul className="space-y-2">
                  {review.pros.map((p) => (
                    <li key={p} className="flex gap-2.5 text-sm text-muted">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-danger/25 bg-danger/[0.06] p-5">
                <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-danger">
                  <XCircle className="h-4 w-4" />
                  Cons
                </h2>
                <ul className="space-y-2">
                  {review.cons.map((c) => (
                    <li key={c} className="flex gap-2.5 text-sm text-muted">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <AdSlot format="in-article" className="mt-6" />

            <div className="mt-8">
              <Prose html={review.body} />
            </div>

            {/* verdict */}
            <div className="card-gradient mt-8">
              <div className="p-6">
                <h2 className="font-display text-lg font-bold">Verdict</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{review.verdict}</p>
                {game ? (
                  <Link href={`/download/${game.slug}`} className="btn-primary btn mt-4">
                    Download {game.name} MOD APK
                  </Link>
                ) : null}
              </div>
            </div>

            <ShareButtons url={`${base}/reviews/${review.slug}`} title={review.title} className="mt-6" />
          </div>

          {/* sidebar */}
          <aside className="min-w-0 space-y-5">
            {game ? (
              <div className="card p-5 lg:sticky lg:top-24">
                <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
                  <Gamepad2 className="h-4 w-4 text-brand" />
                  Reviewed Game
                </h2>
                <GameCard game={game} variant="compact" />
                <Link href={`/game/${game.slug}`} className="btn-secondary btn mt-3 w-full">
                  View game page
                </Link>
              </div>
            ) : null}
            <AdSlot format="rectangle" />
          </aside>
        </div>
      </article>

      {more.items.length > 1 ? (
        <Section className="pt-0">
          <div className="container">
            <SectionHeader title="More Reviews" href="/reviews" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {more.items
                .filter((r) => r.slug !== review.slug)
                .slice(0, 4)
                .map((r) => (
                  <Link key={r.slug} href={`/reviews/${r.slug}`} className="card card-hover group overflow-hidden">
                    <div className="relative aspect-banner overflow-hidden">
                      {r.cover?.url ? (
                        <Image src={r.cover.url} alt="" fill sizes="25vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : null}
                      <span className="absolute right-2 top-2 rounded-lg bg-grad-brand px-2 py-0.5 text-xs font-bold text-white">
                        {r.score.toFixed(1)}
                      </span>
                    </div>
                    <div className="p-3">
                      <h3 className="line-clamp-2 text-sm font-semibold text-ink group-hover:text-brand">{r.title}</h3>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </Section>
      ) : null}
    </>
  );
}
