import Image from 'next/image';
import ViewTracker from '@/components/game/ViewTracker';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  BadgeCheck,
  CalendarDays,
  Download,
  ExternalLink,
  FileArchive,
  HardDrive,
  Info,
  ListChecks,
  Package,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Tag,
  User,
} from 'lucide-react';
import {
  breadcrumbJsonLd,
  CATEGORY_LABELS,
  faqJsonLd,
  formatBytes,
  formatCompactNumber,
  formatDate,
  formatVersion,
  gameJsonLd,
  timeAgo,
  type Crumb,
} from '@modverse/shared';
import { getAllGameSlugs, getGameBySlug, getRecommendedGames, getRelatedGames } from '@/lib/repositories/games';
import { getComments, getReviewForGame } from '@/lib/repositories/content';
import { Badge, Prose, RatingStars, Section, SectionHeader, SpecRow } from '@/components/ui';
import { GameCard } from '@/components/game/GameCard';
import { Screenshots } from '@/components/game/Screenshots';
import { ShareButtons } from '@/components/game/ShareButtons';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';
import { CommentSection } from '@/components/game/CommentSection';
import { AdSlot } from '@/components/ads/AdSlot';
import { NativeAd } from '@/components/ads/NativeAd';
import { buildMetadata, jsonLdScript } from '@/lib/metadata';
import { env, siteUrl } from '@/lib/env';

export const revalidate = 1800; // ISR: 30 min
export const dynamicParams = true;

/** Pre-render the most valuable pages at build time; the rest stream in on demand. */
export async function generateStaticParams() {
  const slugs = await getAllGameSlugs();
  return slugs.slice(0, 100).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return buildMetadata({ title: 'Game not found', description: 'This game is unavailable.', path: `/game/${slug}`, noindex: true });

  return buildMetadata({
    title: game.seo?.title || `${game.name} MOD APK ${game.version}`,
    description: game.seo?.description || game.shortDescription,
    path: `/game/${game.slug}`,
    keywords: game.seo?.keywords ?? [],
    image: game.seo?.ogImage ?? game.banner?.url ?? game.icon?.url ?? null,
    type: 'article',
    publishedTime: game.publishedAt,
    modifiedTime: game.updatedDate ?? game.updatedAt,
    noindex: game.seo?.noindex ?? false,
    canonical: game.seo?.canonical ?? null,
  });
}

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game || (game.status !== 'published' && process.env.NODE_ENV === 'production')) notFound();

  const [related, recommended, review, comments] = await Promise.all([
    getRelatedGames(slug, 8),
    getRecommendedGames(slug, 6),
    getReviewForGame(slug),
    getComments(slug),
  ]);

  const base = siteUrl();
  const ctx = { siteUrl: base, siteName: env.NEXT_PUBLIC_SITE_NAME || 'MODSzora' };
  const pageUrl = `${base}/game/${game.slug}`;

  const crumbs: Crumb[] = [
    { name: 'Games', path: '/browse' },
    { name: CATEGORY_LABELS[game.category] ?? game.category, path: `/category/${game.category}` },
    { name: game.name, path: `/game/${game.slug}` },
  ];

  const schemas = [gameJsonLd(ctx, game), breadcrumbJsonLd(ctx, crumbs)];
  const faqSchema = faqJsonLd(game.faqs ?? []);
  if (faqSchema) schemas.push(faqSchema);

  const scan = game.virusScan;

  return (
    <>
      <ViewTracker slug={game.slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(schemas) }} />

      {/* ── hero banner ── */}
      <div className="relative">
        <div className="absolute inset-0 -z-10 h-[320px] overflow-hidden md:h-[380px]">
          {game.banner?.url ? (
            <Image src={game.banner.url} alt="" fill priority sizes="100vw" className="object-cover opacity-30" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-bg/50 via-bg/85 to-bg" />
        </div>

        <div className="container pt-5">
          <Breadcrumbs crumbs={crumbs} className="mb-5" />

          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {/* icon */}
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-3xl border border-line/70 bg-surface shadow-glass-lg sm:h-32 sm:w-32">
              {game.icon?.url ? (
                <Image
                  src={game.icon.url}
                  alt={`${game.name} MOD APK icon`}
                  fill
                  priority
                  sizes="128px"
                  className="object-cover"
                />
              ) : null}
            </div>

            {/* title block */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {game.collections.includes('mod-menu') ? <Badge tone="mod">Mod Menu</Badge> : null}
                {game.collections.includes('premium') ? <Badge tone="premium">Premium</Badge> : null}
                {game.collections.includes('offline') ? <Badge tone="neutral">Offline</Badge> : null}
                {scan?.status === 'clean' ? (
                  <Badge tone="success">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    Virus-free
                  </Badge>
                ) : null}
              </div>

              <h1 className="mt-2 text-display-sm font-extrabold leading-tight">
                {game.name} <span className="text-gradient">MOD APK</span>
              </h1>

              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                <Link href={`/browse?developer=${encodeURIComponent(game.developer)}`} className="link-underline">
                  {game.developer}
                </Link>
                <span aria-hidden="true">·</span>
                <Link href={`/category/${game.category}`} className="link-underline">
                  {CATEGORY_LABELS[game.category] ?? game.category}
                </Link>
                <span aria-hidden="true">·</span>
                <span>{formatVersion(game.version)}</span>
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                <RatingStars rating={game.rating} count={game.ratingCount} size="md" />
                <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                  <Download className="h-3.5 w-3.5 text-brand" />
                  <strong className="text-ink">{formatCompactNumber(game.downloads)}</strong> downloads
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                  <HardDrive className="h-3.5 w-3.5 text-brand" />
                  {formatBytes(game.sizeBytes)}
                </span>
              </div>

              {/* CTAs */}
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link href={`/download/${game.slug}`} className="btn-primary btn-lg btn">
                  <Download className="h-4.5 w-4.5" />
                  Download MOD APK
                </Link>
                {game.downloadLinks?.some((l) => l.kind === 'mirror') ? (
                  <Link href={`/download/${game.slug}?mirror=1`} className="btn-secondary btn-lg btn">
                    <FileArchive className="h-4.5 w-4.5" />
                    Mirror
                  </Link>
                ) : null}
                {game.playStoreUrl ? (
                  <a
                    href={game.playStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="btn-ghost btn-lg btn"
                  >
                    <ExternalLink className="h-4.5 w-4.5" />
                    Play Store
                  </a>
                ) : null}
              </div>

              <ShareButtons url={pageUrl} title={`${game.name} MOD APK ${formatVersion(game.version)}`} className="mt-5" />
            </div>
          </div>
        </div>
      </div>

      {/* ── body ── */}
      <div className="container mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {/* mod features */}
          <section aria-labelledby="mod-features">
            <h2 id="mod-features" className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
              <Sparkles className="h-5 w-5 text-brand" />
              MOD Features
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {game.modFeatures.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.5 rounded-xl border border-brand/20 bg-brand/[0.06] px-3.5 py-2.5"
                >
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <span className="text-sm font-medium text-ink">{feature}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* screenshots */}
          {game.screenshots?.length ? (
            <section aria-labelledby="screenshots" className="mt-9">
              <h2 id="screenshots" className="mb-3 font-display text-xl font-bold">
                Screenshots
              </h2>
              <Screenshots items={game.screenshots} gameName={game.name} />
            </section>
          ) : null}

          <AdSlot format="in-article" className="mt-9" />

          <NativeAd className="mt-9" />

          {/* description */}
          <section aria-labelledby="description" className="mt-9">
            <h2 id="description" className="mb-3 font-display text-xl font-bold">
              About {game.name}
            </h2>
            <Prose html={game.description} />
          </section>

          {/* what's new */}
          {game.whatsNew ? (
            <section aria-labelledby="whats-new" className="mt-9">
              <h2 id="whats-new" className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
                <ListChecks className="h-5 w-5 text-brand" />
                What&apos;s New in {formatVersion(game.version)}
              </h2>
              <div className="card p-5">
                <ul className="space-y-2">
                  {game.whatsNew
                    .split('\n')
                    .map((l) => l.replace(/^[•\-*]\s*/, '').trim())
                    .filter(Boolean)
                    .map((line, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                        {line}
                      </li>
                    ))}
                </ul>
                <p className="mt-4 border-t border-line/60 pt-3 text-2xs text-faint">
                  Updated {timeAgo(game.updatedDate ?? game.updatedAt)}
                </p>
              </div>
            </section>
          ) : null}

          {/* installation */}
          {game.installationGuide?.length ? (
            <section aria-labelledby="install" className="mt-9">
              <h2 id="install" className="mb-3 font-display text-xl font-bold">
                How to Install {game.name} MOD APK
              </h2>
              <ol className="space-y-3">
                {game.installationGuide.map((step, i) => (
                  <li key={i} className="flex gap-3.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-grad-brand text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <p className="pt-1 text-sm leading-relaxed text-muted">{step}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {/* review teaser */}
          {review ? (
            <section aria-labelledby="review-teaser" className="mt-9">
              <h2 id="review-teaser" className="mb-3 font-display text-xl font-bold">
                Our Review
              </h2>
              <Link href={`/reviews/${review.slug}`} className="card card-hover group flex flex-col gap-4 p-5 sm:flex-row">
                <div className="flex shrink-0 flex-col items-center justify-center rounded-2xl bg-grad-brand px-5 py-4 text-white">
                  <span className="font-display text-3xl font-extrabold leading-none">{review.score.toFixed(1)}</span>
                  <span className="mt-1 text-2xs font-semibold uppercase tracking-wide opacity-90">out of 10</span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold text-ink group-hover:text-brand">{review.title}</h3>
                  <p className="mt-1.5 line-clamp-3 text-sm text-muted">{review.summary}</p>
                  <span className="mt-2 inline-block text-xs font-semibold text-brand">Read the full review →</span>
                </div>
              </Link>
            </section>
          ) : null}

          {/* FAQ */}
          {game.faqs?.length ? (
            <section aria-labelledby="faqs" className="mt-9">
              <h2 id="faqs" className="mb-3 font-display text-xl font-bold">
                Frequently Asked Questions
              </h2>
              <FaqAccordion items={game.faqs} />
            </section>
          ) : null}

          {/* comments */}
          <section aria-labelledby="comments" className="mt-9">
            <h2 id="comments" className="mb-3 font-display text-xl font-bold">
              Comments
            </h2>
            <CommentSection gameSlug={game.slug} initialComments={comments} />
          </section>
        </div>

        {/* ── sidebar ── */}
        <aside className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:self-start">
          {/* download card */}
          <div className="card-gradient">
            <div className="p-5">
              <p className="text-2xs font-bold uppercase tracking-widest text-faint">Download</p>
              <p className="mt-1 font-display text-2xl font-extrabold text-ink">{formatBytes(game.sizeBytes)}</p>
              <p className="mt-0.5 text-xs text-muted">
                {formatVersion(game.version)}
                {game.modVersion ? ` · ${game.modVersion}` : ''}
              </p>
              <Link href={`/download/${game.slug}`} className="btn-primary btn mt-4 w-full">
                <Download className="h-4 w-4" />
                Get MOD APK
              </Link>
              {scan?.status === 'clean' ? (
                <p className="mt-3 flex items-center justify-center gap-1.5 text-2xs text-success">
                  <ShieldCheck className="h-3 w-3" />
                  Scanned clean by {scan.engines} engines
                </p>
              ) : null}
            </div>
          </div>

          {/* APK information */}
          <div className="card p-5">
            <h2 className="mb-2 flex items-center gap-2 font-display text-base font-bold">
              <Info className="h-4 w-4 text-brand" />
              APK Information
            </h2>
            <dl>
              <SpecRow label="Name" value={game.name} />
              {game.originalName && game.originalName !== game.name ? (
                <SpecRow label="Original" value={game.originalName} />
              ) : null}
              <SpecRow label="Version" value={game.version} />
              {game.modVersion ? <SpecRow label="MOD Version" value={game.modVersion} /> : null}
              <SpecRow
                label="Package"
                value={<code className="break-all font-mono text-2xs text-muted">{game.packageName}</code>}
              />
              <SpecRow label="Developer" value={game.developer} />
              {game.publisher ? <SpecRow label="Publisher" value={game.publisher} /> : null}
              <SpecRow label="Category" value={CATEGORY_LABELS[game.category] ?? game.category} />
              <SpecRow label="Android" value={game.androidVersion} />
              <SpecRow label="Size" value={formatBytes(game.sizeBytes)} />
              <SpecRow label="Downloads" value={formatCompactNumber(game.downloads)} />
              <SpecRow label="Rating" value={`${game.rating.toFixed(1)} / 5`} />
              {game.releaseDate ? <SpecRow label="Released" value={formatDate(game.releaseDate)} /> : null}
              <SpecRow label="Updated" value={formatDate(game.updatedDate ?? game.updatedAt)} />
            </dl>
          </div>

          {/* requirements */}
          {game.requirements ? (
            <div className="card p-5">
              <h2 className="mb-2 flex items-center gap-2 font-display text-base font-bold">
                <Smartphone className="h-4 w-4 text-brand" />
                Requirements
              </h2>
              <p className="text-sm leading-relaxed text-muted">{game.requirements}</p>
            </div>
          ) : null}

          {/* virus scan */}
          {scan ? (
            <div className="card p-5">
              <h2 className="mb-2 flex items-center gap-2 font-display text-base font-bold">
                <ShieldCheck className="h-4 w-4 text-success" />
                Virus Scan
              </h2>
              <dl>
                <SpecRow
                  label="Status"
                  value={
                    <span className={scan.status === 'clean' ? 'font-semibold text-success' : 'font-semibold text-warning'}>
                      {scan.status === 'clean' ? 'Clean' : scan.status}
                    </span>
                  }
                />
                <SpecRow label="Engines" value={`${scan.detections} / ${scan.engines} flagged`} />
                <SpecRow label="Provider" value={scan.provider} />
                {scan.scannedAt ? <SpecRow label="Scanned" value={formatDate(scan.scannedAt)} /> : null}
              </dl>
              {scan.sha256 ? (
                <div className="mt-3 border-t border-line/60 pt-3">
                  <p className="text-2xs font-medium uppercase tracking-wide text-faint">SHA-256</p>
                  <code className="mt-1 block break-all font-mono text-[10px] leading-relaxed text-muted">{scan.sha256}</code>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* tags */}
          {game.tags?.length ? (
            <div className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
                <Tag className="h-4 w-4 text-brand" />
                Tags
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {game.tags.map((t) => (
                  <Link key={t} href={`/browse?tag=${encodeURIComponent(t)}`} className="chip text-2xs hover:border-brand/50 hover:text-brand">
                    {t}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <AdSlot format="sidebar" className="hidden lg:grid" />
        </aside>
      </div>

      {/* ── related ── */}
      {related.length ? (
        <Section className="pt-6">
          <div className="container">
            <SectionHeader title="Related Games" subtitle={`More ${CATEGORY_LABELS[game.category]} titles you may like`} />
            <div className="grid grid-auto-fill gap-3 sm:gap-4">
              {related.map((g) => (
                <GameCard key={g.slug} game={g} />
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      {/* ── recommended ── */}
      {recommended.length ? (
        <Section className="pt-0">
          <div className="container">
            <SectionHeader title="Recommended For You" subtitle="Popular picks from other categories" />
            <div className="grid grid-auto-fill gap-3 sm:gap-4">
              {recommended.map((g) => (
                <GameCard key={g.slug} game={g} />
              ))}
            </div>
          </div>
        </Section>
      ) : null}
    </>
  );
}
