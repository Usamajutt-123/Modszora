import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Gamepad2 } from 'lucide-react';
import {
  breadcrumbJsonLd,
  CATEGORY_LABELS,
  GAME_CATEGORIES,
  itemListJsonLd,
  searchQuerySchema,
  type Crumb,
  type GameCategory,
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
export const revalidate = 900;

export function generateStaticParams() {
  return GAME_CATEGORIES.map((slug) => ({ slug }));
}

const DESCRIPTIONS: Record<GameCategory, string> = {
  action: 'Fast-paced combat, shooters and beat-em-ups with unlimited ammo, god mode and unlocked characters.',
  adventure: 'Story-driven journeys and open worlds with premium chapters and paid content unlocked from the start.',
  simulation: 'Life, farming, city and vehicle sims with unlimited currency and every item available immediately.',
  sports: 'Football, cricket, basketball and racing sports titles with unlocked squads, stadiums and max stats.',
  racing: 'Arcade and simulation racers with every car unlocked, unlimited nitro and free upgrades.',
  puzzle: 'Brain teasers and match-three games with unlimited lives, hints and all levels unlocked.',
  arcade: 'Pick-up-and-play classics and endless runners with unlimited coins and no advertising.',
  strategy: 'Tower defense, RTS and turn-based tactics with unlimited resources and instant build times.',
  rpg: 'Role-playing epics and gacha games with unlimited gems, max level characters and free summons.',
  casual: 'Relaxed, short-session games with ads removed and premium content unlocked.',
  shooter: 'FPS and battle royale titles with mod menus, no recoil and unlocked weapon skins.',
  horror: 'Survival horror and escape games with unlimited resources and all chapters unlocked.',
};

function isCategory(v: string): v is GameCategory {
  return (GAME_CATEGORIES as readonly string[]).includes(v);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!isCategory(slug)) {
    return buildMetadata({ title: 'Category not found', description: 'Unknown category.', path: `/category/${slug}`, noindex: true });
  }
  const label = CATEGORY_LABELS[slug];
  const year = new Date().getFullYear();
  return buildMetadata({
    title: `${label} MOD APK Games — Free Download (${year})`,
    description: `${DESCRIPTIONS[slug]} Every ${label.toLowerCase()} MOD APK is virus-scanned and updated for the latest Android versions.`,
    path: `/category/${slug}`,
    keywords: [
      `${slug} mod apk`,
      `${slug} games mod`,
      `best ${slug} android games`,
      `${slug} mod apk download`,
      `unlimited money ${slug} games`,
    ],
  });
}

type SP = Record<string, string | string[] | undefined>;
const firstOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SP>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  if (!isCategory(slug)) notFound();

  const parsed = searchQuerySchema.safeParse({
    category: slug,
    developer: firstOf(sp.developer),
    androidVersion: firstOf(sp.androidVersion),
    tag: firstOf(sp.tag),
    minRating: firstOf(sp.minRating),
    sort: firstOf(sp.sort) ?? 'popular',
    page: firstOf(sp.page) ?? 1,
    pageSize: 24,
  });
  const query = parsed.success ? parsed.data : { category: slug, sort: 'popular' as const, page: 1, pageSize: 24 };

  const [result, developers, tags, categoryCounts] = await Promise.all([
    listGames(query),
    getDevelopers(),
    getAllTags(20),
    getCategoryCounts(),
  ]);

  const label = CATEGORY_LABELS[slug];
  const ctx = { siteUrl: siteUrl(), siteName: env.NEXT_PUBLIC_SITE_NAME || 'MODSzora' };
  const crumbs: Crumb[] = [
    { name: 'Games', path: '/browse' },
    { name: label, path: `/category/${slug}` },
  ];

  const schemas = [
    breadcrumbJsonLd(ctx, crumbs),
    itemListJsonLd(
      ctx,
      result.items.slice(0, 20).map((g) => ({ name: g.name, path: `/game/${g.slug}`, image: g.icon?.url })),
      `${label} MOD APK Games`,
    ),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(schemas) }} />

      <div className="container py-6">
        <Breadcrumbs crumbs={crumbs} className="mb-5" />

        <header className="mb-7">
          <h1 className="flex items-center gap-2.5 text-display-sm font-extrabold">
            <Gamepad2 className="h-7 w-7 text-brand" />
            {label} MOD APK Games
          </h1>
          <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-muted">{DESCRIPTIONS[slug]}</p>
          <p className="mt-1.5 text-xs text-faint">
            {result.total.toLocaleString()} {label.toLowerCase()} game{result.total === 1 ? '' : 's'} available
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <FilterPanel
            developers={developers}
            tags={tags}
            categoryCounts={categoryCounts}
            basePath={`/category/${slug}`}
            showCollection={false}
          />

          <div className="min-w-0">
            <GameGrid
              games={result.items}
              emptyTitle={`No ${label.toLowerCase()} games yet`}
              emptyDescription="Check back soon — our agent adds new titles daily."
            />
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              basePath={`/category/${slug}`}
              searchParams={{
                developer: query.developer,
                androidVersion: query.androidVersion,
                tag: query.tag,
                sort: query.sort !== 'popular' ? query.sort : undefined,
              }}
              className="mt-10"
            />
          </div>
        </div>
      </div>
    </>
  );
}
