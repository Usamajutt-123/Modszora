import type { Metadata } from 'next';
import { SearchIcon } from 'lucide-react';
import { searchQuerySchema } from '@modverse/shared';
import { getAllTags, getCategoryCounts, getDevelopers, listGames } from '@/lib/repositories/games';
import { GameList } from '@/components/game/GameGrid';
import { FilterPanel } from '@/components/search/FilterPanel';
import { SearchBar } from '@/components/search/SearchBar';
import { Pagination } from '@/components/ui/Pagination';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { buildMetadata } from '@/lib/metadata';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

const firstOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const q = firstOf(sp.q);
  return buildMetadata({
    title: q ? `Search results for “${q}” — MODVerse` : 'Advanced MOD APK Search',
    description: q
      ? `MOD APK games matching “${q}”. Filter by category, developer, Android version and rating.`
      : 'Search the full MODVerse library with advanced filters: category, developer, Android version, genre, tags and rating.',
    path: '/search',
    // Search result pages should not be indexed — they create infinite crawl paths.
    noindex: true,
  });
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  const parsed = searchQuerySchema.safeParse({
    q: firstOf(sp.q),
    category: firstOf(sp.category),
    collection: firstOf(sp.collection),
    developer: firstOf(sp.developer),
    androidVersion: firstOf(sp.androidVersion),
    tag: firstOf(sp.tag),
    minRating: firstOf(sp.minRating),
    sort: firstOf(sp.sort) ?? 'newest',
    page: firstOf(sp.page) ?? 1,
    pageSize: 20,
  });

  const query = parsed.success ? parsed.data : { sort: 'newest' as const, page: 1, pageSize: 20 };
  const hasQuery = Boolean(query.q || query.category || query.developer || query.tag || query.collection);

  const [result, developers, tags, categoryCounts] = await Promise.all([
    hasQuery ? listGames(query) : Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1, hasMore: false }),
    getDevelopers(),
    getAllTags(24),
    getCategoryCounts(),
  ]);

  return (
    <div className="container py-6">
      <Breadcrumbs crumbs={[{ name: 'Search', path: '/search' }]} className="mb-5" />

      <header className="mb-6">
        <h1 className="flex items-center gap-2.5 text-display-sm font-extrabold">
          <SearchIcon className="h-7 w-7 text-brand" />
          Advanced Search
        </h1>
        <p className="mt-2 text-sm text-muted">
          Search by name, developer or tag, then narrow with the filters.
        </p>
        <div className="mt-4 max-w-2xl">
          <SearchBar autoFocus />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <FilterPanel developers={developers} tags={tags} categoryCounts={categoryCounts} basePath="/search" />

        <div className="min-w-0">
          {hasQuery ? (
            <>
              <p className="mb-4 text-sm text-muted">
                <strong className="text-ink">{result.total.toLocaleString()}</strong> result
                {result.total === 1 ? '' : 's'}
                {query.q ? (
                  <>
                    {' '}
                    for “<span className="font-semibold text-ink">{query.q}</span>”
                  </>
                ) : null}
              </p>
              <GameList games={result.items} />
              <Pagination
                page={result.page}
                totalPages={result.totalPages}
                basePath="/search"
                searchParams={{
                  q: query.q,
                  category: query.category,
                  developer: query.developer,
                  androidVersion: query.androidVersion,
                  tag: query.tag,
                  sort: query.sort !== 'newest' ? query.sort : undefined,
                }}
                className="mt-10"
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line py-20 text-center">
              <SearchIcon className="mb-3 h-10 w-10 text-faint" />
              <p className="text-base font-semibold text-ink">Start typing to search</p>
              <p className="mt-1 max-w-sm text-sm text-muted">
                Search across {Object.values(categoryCounts).reduce((a, b) => a + b, 0)} games, or pick a filter to browse.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
