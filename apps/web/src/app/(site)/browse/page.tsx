import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LayoutGrid } from 'lucide-react';
import { itemListJsonLd, searchQuerySchema, breadcrumbJsonLd, type Crumb } from '@modverse/shared';
import { getCategoryCounts, getDevelopers, getAllTags, listGames } from '@/lib/repositories/games';
import { GameGrid } from '@/components/game/GameGrid';
import { FilterPanel } from '@/components/search/FilterPanel';
import { Pagination } from '@/components/ui/Pagination';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { GameCardSkeleton } from '@/components/ui';
import { buildMetadata, jsonLdScript } from '@/lib/metadata';
import { env, siteUrl } from '@/lib/env';

export const revalidate = 600;

export const metadata: Metadata = buildMetadata({
  title: 'Browse All MOD APK Games',
  description:
    'Browse the full MODSzora library of modded Android games. Filter by category, developer, Android version, rating and more. Every APK virus-scanned and version-tracked.',
  path: '/browse',
  keywords: ['browse mod apk', 'all mod games', 'android mod apk list', 'mod apk library'],
});

type SP = Record<string, string | string[] | undefined>;

function firstOf(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function BrowsePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  const parsed = searchQuerySchema.safeParse({
    q: firstOf(sp.q),
    category: firstOf(sp.category),
    collection: firstOf(sp.collection),
    developer: firstOf(sp.developer),
    androidVersion: firstOf(sp.androidVersion),
    tag: firstOf(sp.tag),
    genre: firstOf(sp.genre),
    minRating: firstOf(sp.minRating),
    sort: firstOf(sp.sort) ?? 'newest',
    page: firstOf(sp.page) ?? 1,
    pageSize: 24,
  });

  const query = parsed.success ? parsed.data : { sort: 'newest' as const, page: 1, pageSize: 24 };

  const [result, developers, tags, categoryCounts] = await Promise.all([
    listGames(query),
    getDevelopers(),
    getAllTags(24),
    getCategoryCounts(),
  ]);

  const ctx = { siteUrl: siteUrl(), siteName: env.NEXT_PUBLIC_SITE_NAME || 'MODSzora' };
  const crumbs: Crumb[] = [{ name: 'Browse Games', path: '/browse' }];

  const schemas = [
    breadcrumbJsonLd(ctx, crumbs),
    itemListJsonLd(
      ctx,
      result.items.slice(0, 20).map((g) => ({ name: g.name, path: `/game/${g.slug}`, image: g.icon?.url })),
      'MOD APK Games',
    ),
  ];

  // Preserve current filters when building pagination links.
  const paginationParams: Record<string, string | undefined> = {
    q: query.q,
    category: query.category,
    collection: query.collection,
    developer: query.developer,
    androidVersion: query.androidVersion,
    tag: query.tag,
    minRating: query.minRating ? String(query.minRating) : undefined,
    sort: query.sort !== 'newest' ? query.sort : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(schemas) }} />

      <div className="container py-6">
        <Breadcrumbs crumbs={crumbs} className="mb-5" />

        <header className="mb-6">
          <h1 className="flex items-center gap-2.5 text-display-sm font-extrabold">
            <LayoutGrid className="h-7 w-7 text-brand" />
            Browse Games
          </h1>
          <p className="mt-2 text-sm text-muted">
            {result.total.toLocaleString()} modded game{result.total === 1 ? '' : 's'} in the library
            {query.category ? ` · ${query.category}` : ''}
            {query.developer ? ` · ${query.developer}` : ''}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <FilterPanel developers={developers} tags={tags} categoryCounts={categoryCounts} basePath="/browse" />

          <div className="min-w-0">
            <Suspense
              fallback={
                <div className="grid grid-auto-fill gap-4">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <GameCardSkeleton key={i} />
                  ))}
                </div>
              }
            >
              <GameGrid
                games={result.items}
                emptyTitle="No games match those filters"
                emptyDescription="Try widening your search — remove a filter or pick a different category."
              />
            </Suspense>

            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              basePath="/browse"
              searchParams={paginationParams}
              className="mt-10"
            />
          </div>
        </div>
      </div>
    </>
  );
}
