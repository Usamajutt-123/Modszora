import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Star } from 'lucide-react';
import { breadcrumbJsonLd, formatDate, itemListJsonLd, type Crumb } from '@modverse/shared';
import { listReviews } from '@/lib/repositories/content';
import { Pagination } from '@/components/ui/Pagination';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { EmptyState } from '@/components/ui';
import { buildMetadata, jsonLdScript } from '@/lib/metadata';
import { env, siteUrl } from '@/lib/env';

export const revalidate = 1800;

export const metadata: Metadata = buildMetadata({
  title: 'MOD APK Game Reviews — Hands-On Verdicts',
  description:
    'In-depth reviews of modded Android games. Real device testing, performance notes, mod menu stability, pros, cons and a scored verdict for every title.',
  path: '/reviews',
  keywords: ['mod apk review', 'android game review', 'mobile game reviews', 'mod menu review'],
});

const firstOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function scoreTone(score: number): string {
  if (score >= 8.5) return 'text-success';
  if (score >= 7) return 'text-brand';
  if (score >= 5.5) return 'text-warning';
  return 'text-danger';
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const page = Number(firstOf(sp.page) ?? 1) || 1;
  const result = await listReviews({ page, pageSize: 12 });

  const ctx = { siteUrl: siteUrl(), siteName: env.NEXT_PUBLIC_SITE_NAME || 'MODSzora' };
  const crumbs: Crumb[] = [{ name: 'Reviews', path: '/reviews' }];

  const schemas = [
    breadcrumbJsonLd(ctx, crumbs),
    itemListJsonLd(
      ctx,
      result.items.map((r) => ({ name: r.title, path: `/reviews/${r.slug}`, image: r.cover?.url })),
      'Game Reviews',
    ),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(schemas) }} />

      <div className="container py-6">
        <Breadcrumbs crumbs={crumbs} className="mb-5" />

        <header className="mb-7">
          <h1 className="flex items-center gap-2.5 text-display-sm font-extrabold">
            <Star className="h-7 w-7 text-brand" />
            Game Reviews
          </h1>
          <p className="mt-2.5 max-w-2xl text-sm text-muted">
            Every review is written after real hands-on testing on both mid-range and flagship hardware — performance, mod
            stability, and whether the unlock actually improves the game.
          </p>
        </header>

        {result.items.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {result.items.map((review) => (
              <article key={review.slug} className="card card-hover group overflow-hidden">
                <Link href={`/reviews/${review.slug}`} className="block">
                  <div className="relative aspect-banner overflow-hidden">
                    {review.cover?.url ? (
                      <Image
                        src={review.cover.url}
                        alt=""
                        fill
                        sizes="(max-width:768px) 100vw, (max-width:1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute right-3 top-3 rounded-xl bg-surface/95 px-3 py-1.5 shadow-glass backdrop-blur">
                      <span className={`font-display text-lg font-extrabold ${scoreTone(review.score)}`}>
                        {review.score.toFixed(1)}
                      </span>
                      <span className="ml-0.5 text-2xs text-faint">/10</span>
                    </div>
                  </div>

                  <div className="p-4">
                    <h2 className="line-clamp-2 font-display text-base font-bold text-ink transition-colors group-hover:text-brand">
                      {review.title}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-sm text-muted">{review.summary}</p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {review.pros.slice(0, 2).map((p) => (
                        <span key={p} className="chip border-success/30 bg-success/10 text-2xs text-success">
                          + {p.length > 26 ? `${p.slice(0, 26)}…` : p}
                        </span>
                      ))}
                    </div>

                    <p className="mt-3 border-t border-line/60 pt-2.5 text-2xs text-faint">
                      {review.author} · {formatDate(review.publishedAt)}
                    </p>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No reviews published yet"
            description="Our editors are testing games right now. Check back soon."
            icon={<Star className="h-10 w-10" />}
          />
        )}

        <Pagination page={result.page} totalPages={result.totalPages} basePath="/reviews" className="mt-10" />
      </div>
    </>
  );
}
