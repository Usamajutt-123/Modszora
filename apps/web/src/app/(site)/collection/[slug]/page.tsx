import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Clock, Flame, Sparkles, Star, TrendingUp, Trophy, WifiOff, Zap } from 'lucide-react';
import {
  breadcrumbJsonLd,
  COLLECTION_LABELS,
  GAME_COLLECTIONS,
  itemListJsonLd,
  searchQuerySchema,
  type Crumb,
  type GameCollection,
} from '@modverse/shared';
import { getAllTags, getCategoryCounts, getDevelopers, listGames } from '@/lib/repositories/games';
import { GameGrid } from '@/components/game/GameGrid';
import { FilterPanel } from '@/components/search/FilterPanel';
import { Pagination } from '@/components/ui/Pagination';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { buildMetadata, jsonLdScript } from '@/lib/metadata';
import { env, siteUrl } from '@/lib/env';

// The set of categories/collections is finite and fully enumerated by
// generateStaticParams, so anything else is genuinely a 404.
export const dynamicParams = false;
export const revalidate = 600;

export function generateStaticParams() {
  return GAME_COLLECTIONS.map((slug) => ({ slug }));
}

const META: Record<GameCollection, { description: string; icon: typeof Flame; sort: 'trending' | 'newest' | 'popular' | 'rating' }> = {
  trending: {
    description: 'The mods gaining downloads fastest right now, ranked by a time-decayed velocity score rather than raw totals.',
    icon: Flame,
    sort: 'trending',
  },
  latest: {
    description: 'Freshly ingested titles. Our agent monitors eight upstream sources continuously and publishes new games as they appear.',
    icon: Sparkles,
    sort: 'newest',
  },
  popular: {
    description: 'The all-time download leaders — proven mods that the community keeps coming back to.',
    icon: TrendingUp,
    sort: 'popular',
  },
  'mod-menu': {
    description: 'Games shipping an in-game mod menu so you can toggle cheats like god mode, damage multipliers and unlimited currency mid-run.',
    icon: Zap,
    sort: 'popular',
  },
  premium: {
    description: 'Paid Play Store games with the purchase requirement removed. Full versions, all DLC, zero cost.',
    icon: Star,
    sort: 'rating',
  },
  offline: {
    description: 'No connection required. Perfect for flights, commutes and anywhere with unreliable data.',
    icon: WifiOff,
    sort: 'popular',
  },
  'editors-choice': {
    description: 'Hand-picked by the MODVerse team for mod quality, stability and how well the game holds up on mobile.',
    icon: Trophy,
    sort: 'rating',
  },
  'recently-updated': {
    description: 'Listings refreshed in the last two weeks with new versions, changelogs and re-verified download links.',
    icon: Clock,
    sort: 'newest',
  },
};

function isCollection(v: string): v is GameCollection {
  return (GAME_COLLECTIONS as readonly string[]).includes(v);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!isCollection(slug)) {
    return buildMetadata({ title: 'Collection not found', description: 'Unknown collection.', path: `/collection/${slug}`, noindex: true });
  }
  const label = COLLECTION_LABELS[slug];
  const year = new Date().getFullYear();
  return buildMetadata({
    title: `${label} — MOD APK Downloads (${year})`,
    description: META[slug].description.slice(0, 175),
    path: `/collection/${slug}`,
    keywords: [`${slug.replace('-', ' ')} mod apk`, `${label.toLowerCase()}`, 'mod apk collection', `best mod apk ${year}`],
  });
}

type SP = Record<string, string | string[] | undefined>;
const firstOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SP>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  if (!isCollection(slug)) notFound();

  const meta = META[slug];
  const parsed = searchQuerySchema.safeParse({
    collection: slug,
    category: firstOf(sp.category),
    developer: firstOf(sp.developer),
    androidVersion: firstOf(sp.androidVersion),
    tag: firstOf(sp.tag),
    minRating: firstOf(sp.minRating),
    sort: firstOf(sp.sort) ?? meta.sort,
    page: firstOf(sp.page) ?? 1,
    pageSize: 24,
  });
  const query = parsed.success ? parsed.data : { collection: slug, sort: meta.sort, page: 1, pageSize: 24 };

  const [result, developers, tags, categoryCounts] = await Promise.all([
    listGames(query),
    getDevelopers(),
    getAllTags(20),
    getCategoryCounts(),
  ]);

  const label = COLLECTION_LABELS[slug];
  const Icon = meta.icon;
  const ctx = { siteUrl: siteUrl(), siteName: env.NEXT_PUBLIC_SITE_NAME || 'MODVerse' };
  const crumbs: Crumb[] = [
    { name: 'Games', path: '/browse' },
    { name: label, path: `/collection/${slug}` },
  ];

  const schemas = [
    breadcrumbJsonLd(ctx, crumbs),
    itemListJsonLd(
      ctx,
      result.items.slice(0, 20).map((g) => ({ name: g.name, path: `/game/${g.slug}`, image: g.icon?.url })),
      label,
    ),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(schemas) }} />

      <div className="container py-6">
        <Breadcrumbs crumbs={crumbs} className="mb-5" />

        <header className="mb-7">
          <h1 className="flex items-center gap-2.5 text-display-sm font-extrabold">
            <Icon className="h-7 w-7 text-brand" />
            {label}
          </h1>
          <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-muted">{meta.description}</p>
          <p className="mt-1.5 text-xs text-faint">{result.total.toLocaleString()} games</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <FilterPanel
            developers={developers}
            tags={tags}
            categoryCounts={categoryCounts}
            basePath={`/collection/${slug}`}
            showCollection={false}
          />

          <div className="min-w-0">
            <GameGrid games={result.items} emptyTitle={`Nothing in ${label} yet`} emptyDescription="Check back shortly." />
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              basePath={`/collection/${slug}`}
              searchParams={{
                category: query.category,
                developer: query.developer,
                tag: query.tag,
                sort: query.sort !== meta.sort ? query.sort : undefined,
              }}
              className="mt-10"
            />
          </div>
        </div>
      </div>
    </>
  );
}
