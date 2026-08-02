import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import {
  Clock,
  Flame,
  Gamepad2,
  ImageIcon,
  Newspaper,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  WifiOff,
  Zap,
} from 'lucide-react';
import { CATEGORY_LABELS, GAME_CATEGORIES, itemListJsonLd, timeAgo } from '@modverse/shared';
import { Hero } from '@/components/home/Hero';
import { GameGrid, GameRail } from '@/components/game/GameGrid';
import { GameCard } from '@/components/game/GameCard';
import { Section, SectionHeader, Badge } from '@/components/ui';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';
import { getCategoryCounts, getCollection, getFeaturedGames, listGames } from '@/lib/repositories/games';
import { listPosts, listReviews, listWallpapers } from '@/lib/repositories/content';
import { buildMetadata, jsonLdScript } from '@/lib/metadata';
import { env, siteUrl } from '@/lib/env';

export const revalidate = 600; // ISR: refresh homepage every 10 minutes

export const metadata: Metadata = buildMetadata({
  title: 'MODVerse — Premium MOD APK Games for Android',
  description:
    'Download premium MOD APK games with unlimited money, unlocked features and mod menus. Every APK is virus-scanned, signature-checked and version-tracked daily.',
  path: '/',
  keywords: [
    'mod apk',
    'mod apk download',
    'android mod games',
    'mod menu games',
    'unlimited money apk',
    'premium apk free',
    'offline mod games',
  ],
});

const HOMEPAGE_FAQS = [
  {
    question: 'What is a MOD APK?',
    answer:
      'A MOD APK is a modified version of an Android app package. Developers of the mod alter the original game to unlock premium content, remove advertising, or add a mod menu with gameplay toggles such as unlimited currency or god mode. The core game remains the same — only the restrictions change.',
  },
  {
    question: 'Are MODVerse downloads safe?',
    answer:
      'Every APK published on MODVerse passes an automated pipeline: the file hash is recorded, the package signature is inspected, and the binary is scanned by multiple antivirus engines before the listing goes live. You can see the scan status and SHA-256 hash on each game page.',
  },
  {
    question: 'Do I need to root my device?',
    answer:
      'No. Every mod listed here runs on a stock, unrooted Android device. You only need to allow installs from unknown sources for your browser or file manager, which is a standard Android setting.',
  },
  {
    question: 'Why does installation fail with "App not installed"?',
    answer:
      'This almost always means a copy of the game signed with a different key is already present. Uninstall the Play Store version first, then install the MOD APK. If the game is large, also confirm you have enough free storage for the extracted OBB data.',
  },
  {
    question: 'How often are games updated?',
    answer:
      'Our ingestion agent monitors upstream sources continuously and compares versions against our database. When a new build appears, the listing is updated in place — version, size, changelog, screenshots and download links — rather than creating a duplicate page.',
  },
  {
    question: 'Can I play modded games online?',
    answer:
      'Single-player and offline content works fully. Competitive online modes may run server-side anti-cheat that detects modified clients, so we recommend using a secondary account if you intend to play online.',
  },
];

export default async function HomePage() {
  // Parallel fetch — every section loads concurrently.
  const [
    featured,
    trending,
    latest,
    popular,
    modMenu,
    premium,
    offline,
    editorsChoice,
    recentlyUpdated,
    action,
    racing,
    puzzle,
    categoryCounts,
    reviews,
    posts,
    wallpapers,
    allGames,
  ] = await Promise.all([
    getFeaturedGames(5),
    getCollection('trending', 12),
    getCollection('latest', 12),
    getCollection('popular', 12),
    getCollection('mod-menu', 12),
    getCollection('premium', 12),
    getCollection('offline', 12),
    getCollection('editors-choice', 6),
    getCollection('recently-updated', 6),
    listGames({ category: 'action', pageSize: 6, sort: 'popular' }),
    listGames({ category: 'racing', pageSize: 6, sort: 'popular' }),
    listGames({ category: 'puzzle', pageSize: 6, sort: 'popular' }),
    getCategoryCounts(),
    listReviews({ pageSize: 3 }),
    listPosts({ pageSize: 3 }),
    listWallpapers({ pageSize: 6 }),
    listGames({ pageSize: 1 }),
  ]);

  const heroGames = featured.length ? featured : trending.slice(0, 5);
  const totalDownloads = [...trending, ...popular].reduce((sum, g) => sum + g.downloads, 0);
  const updatedToday = recentlyUpdated.length || 8;

  const ctx = { siteUrl: siteUrl(), siteName: env.NEXT_PUBLIC_SITE_NAME || 'MODVerse' };
  const listLd = itemListJsonLd(
    ctx,
    trending.slice(0, 10).map((g) => ({ name: g.name, path: `/game/${g.slug}`, image: g.icon?.url })),
    'Trending MOD APK Games',
  );
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: HOMEPAGE_FAQS.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript([listLd, faqLd]) }} />

      <Hero games={heroGames} stats={{ games: allGames.total || 28, downloads: totalDownloads, updatedToday }} />

      {/* ── category quick nav ── */}
      <div className="container">
        <div className="scrollbar-none mask-fade-r -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
          {GAME_CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/category/${c}`}
              className="chip shrink-0 hover:border-brand/50 hover:text-brand"
            >
              {CATEGORY_LABELS[c]}
              {categoryCounts[c] ? <span className="text-faint">{categoryCounts[c]}</span> : null}
            </Link>
          ))}
        </div>
      </div>

      {/* ── trending ── */}
      <Section className="pt-10">
        <div className="container">
          <SectionHeader
            title="Trending Now"
            subtitle="What the community is installing this week"
            href="/collection/trending"
            icon={<Flame className="h-5 w-5" />}
          />
          <GameRail games={trending} />
        </div>
      </Section>

      {/* ── latest ── */}
      <Section className="py-8">
        <div className="container">
          <SectionHeader
            title="Latest Games"
            subtitle="Freshly added to the library"
            href="/collection/latest"
            icon={<Sparkles className="h-5 w-5" />}
          />
          <GameGrid games={latest} priorityCount={0} />
        </div>
      </Section>

      {/* ── editor's choice (feature strip) ── */}
      {editorsChoice.length ? (
        <Section className="py-8">
          <div className="container">
            <SectionHeader
              title="Editor's Choice"
              subtitle="Hand-picked by the MODVerse team"
              href="/collection/editors-choice"
              icon={<Trophy className="h-5 w-5" />}
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {editorsChoice.slice(0, 3).map((game) => (
                <Link key={game.slug} href={`/game/${game.slug}`} className="card card-hover group overflow-hidden">
                  <div className="relative aspect-banner overflow-hidden">
                    {game.banner?.url ? (
                      <Image
                        src={game.banner.url}
                        alt={`${game.name} banner`}
                        fill
                        sizes="(max-width:768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <Badge tone="premium">
                        <Trophy className="h-2.5 w-2.5" />
                        Editor's Choice
                      </Badge>
                      <h3 className="mt-1.5 font-display text-lg font-bold text-white">{game.name}</h3>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="line-clamp-2 text-sm text-muted">{game.shortDescription}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {game.modFeatures.slice(0, 2).map((f) => (
                        <span key={f} className="chip text-2xs">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      {/* ── popular ── */}
      <Section className="py-8">
        <div className="container">
          <SectionHeader
            title="Most Popular"
            subtitle="All-time download leaders"
            href="/collection/popular"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <GameRail games={popular} />
        </div>
      </Section>

      {/* ── mod menu + premium (two-up) ── */}
      <Section className="py-8">
        <div className="container grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeader
              title="Mod Menu Games"
              subtitle="In-game toggles for every cheat"
              href="/collection/mod-menu"
              icon={<Zap className="h-5 w-5" />}
            />
            <div className="flex flex-col gap-2">
              {modMenu.slice(0, 5).map((g) => (
                <GameCard key={g.slug} game={g} variant="compact" />
              ))}
            </div>
          </div>
          <div>
            <SectionHeader
              title="Premium Unlocked"
              subtitle="Paid games, free forever"
              href="/collection/premium"
              icon={<Star className="h-5 w-5" />}
            />
            <div className="flex flex-col gap-2">
              {premium.slice(0, 5).map((g) => (
                <GameCard key={g.slug} game={g} variant="compact" />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── offline ── */}
      <Section className="py-8">
        <div className="container">
          <SectionHeader
            title="Offline Games"
            subtitle="No Wi-Fi, no problem"
            href="/collection/offline"
            icon={<WifiOff className="h-5 w-5" />}
          />
          <GameRail games={offline} />
        </div>
      </Section>

      {/* ── genre blocks ── */}
      {[
        { title: 'Action', data: action.items, href: '/category/action' },
        { title: 'Racing', data: racing.items, href: '/category/racing' },
        { title: 'Puzzle', data: puzzle.items, href: '/category/puzzle' },
      ]
        .filter((b) => b.data.length > 0)
        .map((block) => (
          <Section key={block.title} className="py-8">
            <div className="container">
              <SectionHeader
                title={`${block.title} Games`}
                href={block.href}
                icon={<Gamepad2 className="h-5 w-5" />}
              />
              <GameRail games={block.data} />
            </div>
          </Section>
        ))}

      {/* ── recently updated ── */}
      {recentlyUpdated.length ? (
        <Section className="py-8">
          <div className="container">
            <SectionHeader
              title="Recently Updated"
              subtitle="Version bumps from the last two weeks"
              href="/collection/recently-updated"
              icon={<Clock className="h-5 w-5" />}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentlyUpdated.map((g) => (
                <Link key={g.slug} href={`/game/${g.slug}`} className="card card-hover group flex items-center gap-3 p-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-line/70">
                    {g.icon?.url ? <Image src={g.icon.url} alt="" fill sizes="56px" className="object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink group-hover:text-brand">{g.name}</p>
                    <p className="mt-0.5 truncate text-2xs text-faint">
                      v{g.version} · {timeAgo(g.updatedDate)}
                    </p>
                  </div>
                  <Badge tone="new">Updated</Badge>
                </Link>
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      {/* ── reviews ── */}
      {reviews.items.length ? (
        <Section className="py-8">
          <div className="container">
            <SectionHeader
              title="Latest Reviews"
              subtitle="Hands-on verdicts from our editors"
              href="/reviews"
              icon={<Star className="h-5 w-5" />}
            />
            <div className="grid gap-4 md:grid-cols-3">
              {reviews.items.map((r) => (
                <Link key={r.slug} href={`/reviews/${r.slug}`} className="card card-hover group overflow-hidden">
                  <div className="relative aspect-banner overflow-hidden">
                    {r.cover?.url ? (
                      <Image
                        src={r.cover.url}
                        alt=""
                        fill
                        sizes="(max-width:768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : null}
                    <div className="absolute right-2 top-2 rounded-lg bg-grad-brand px-2.5 py-1 font-display text-sm font-bold text-white shadow-glow">
                      {r.score.toFixed(1)}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="line-clamp-2 font-display text-base font-bold text-ink group-hover:text-brand">
                      {r.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted">{r.summary}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      {/* ── wallpapers ── */}
      {wallpapers.items.length ? (
        <Section className="py-8">
          <div className="container">
            <SectionHeader
              title="Gaming Wallpapers"
              subtitle="4K backdrops for phone and desktop"
              href="/wallpapers"
              icon={<ImageIcon className="h-5 w-5" />}
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {wallpapers.items.map((w) => (
                <Link
                  key={w.slug}
                  href={`/wallpapers/${w.slug}`}
                  className="group relative aspect-banner overflow-hidden rounded-xl border border-line/70"
                >
                  {w.thumbnail?.url || w.image?.url ? (
                    <Image
                      src={(w.thumbnail?.url ?? w.image.url) as string}
                      alt={w.title}
                      fill
                      sizes="(max-width:640px) 50vw, 16vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="absolute bottom-2 left-2 right-2 truncate text-2xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {w.title}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      {/* ── blog ── */}
      {posts.items.length ? (
        <Section className="py-8">
          <div className="container">
            <SectionHeader
              title="Gaming News & Guides"
              subtitle="Install tips, Android changes and community picks"
              href="/blog"
              icon={<Newspaper className="h-5 w-5" />}
            />
            <div className="grid gap-4 md:grid-cols-3">
              {posts.items.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} className="card card-hover group overflow-hidden">
                  <div className="relative aspect-banner overflow-hidden">
                    {p.cover?.url ? (
                      <Image
                        src={p.cover.url}
                        alt=""
                        fill
                        sizes="(max-width:768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <span className="chip text-2xs capitalize">{p.category}</span>
                    <h3 className="mt-2 line-clamp-2 font-display text-base font-bold text-ink group-hover:text-brand">
                      {p.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted">{p.excerpt}</p>
                    <p className="mt-3 text-2xs text-faint">{p.readingMinutes} min read</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      {/* ── FAQ ── */}
      <Section className="py-10">
        <div className="container max-w-3xl">
          <SectionHeader title="Frequently Asked Questions" subtitle="Everything about installing and using MOD APKs" />
          <FaqAccordion items={HOMEPAGE_FAQS} />
        </div>
      </Section>
    </>
  );
}
