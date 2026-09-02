import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AlertTriangle, ArrowLeft, Info, ShieldCheck } from 'lucide-react';
import {
  breadcrumbJsonLd,
  CATEGORY_LABELS,
  formatBytes,
  formatDate,
  formatVersion,
  type Crumb,
  type DownloadLink,
} from '@modverse/shared';
import { getAllGameSlugs, getGameBySlug, getRelatedGames } from '@/lib/repositories/games';
import { DownloadCountdown } from '@/components/download/DownloadCountdown';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { GameCard } from '@/components/game/GameCard';
import { AdSlot } from '@/components/ads/AdSlot';
import { NativeAd } from '@/components/ads/NativeAd';
import { SpecRow, Section, SectionHeader } from '@/components/ui';
import { buildMetadata, jsonLdScript } from '@/lib/metadata';
import { env, siteUrl } from '@/lib/env';

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllGameSlugs();
  return slugs.slice(0, 60).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) {
    return buildMetadata({ title: 'Download not found', description: 'Unavailable.', path: `/download/${slug}`, noindex: true });
  }
  return buildMetadata({
    title: `Download ${game.name} MOD APK v${game.version}`,
    description: `Free download for ${game.name} MOD APK v${game.version} (${formatBytes(game.sizeBytes)}). Mega and mirror servers, virus-scanned and ready for Android ${game.androidVersion}.`,
    path: `/download/${game.slug}`,
    keywords: [`download ${game.name.toLowerCase()} mod apk`, `${game.name.toLowerCase()} apk download`, 'mega download', 'mod apk mirror'],
    image: game.banner?.url ?? game.icon?.url ?? null,
  });
}

export default async function DownloadPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mirror?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const related = await getRelatedGames(slug, 6);
  const base = siteUrl();
  const ctx = { siteUrl: base, siteName: env.NEXT_PUBLIC_SITE_NAME || 'MODSzora' };

  const crumbs: Crumb[] = [
    { name: 'Games', path: '/browse' },
    { name: game.name, path: `/game/${game.slug}` },
    { name: 'Download', path: `/download/${game.slug}` },
  ];

  // Always guarantee at least one working link.
  const links: DownloadLink[] =
    game.downloadLinks?.length > 0
      ? game.downloadLinks
      : ([
          game.megaUrl
            ? { label: 'Mega (Fast)', url: game.megaUrl, kind: 'mega', sizeBytes: game.sizeBytes, isPrimary: true }
            : null,
          game.modApkUrl ? { label: 'Direct Server', url: game.modApkUrl, kind: 'direct', sizeBytes: game.sizeBytes, isPrimary: !game.megaUrl } : null,
          game.playStoreUrl ? { label: 'Google Play (Original)', url: game.playStoreUrl, kind: 'playstore', isPrimary: false } : null,
        ].filter(Boolean) as DownloadLink[]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(ctx, crumbs)) }} />

      <div className="container py-6">
        <Breadcrumbs crumbs={crumbs} className="mb-5" />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {/* game header */}
            <div className="card mb-6 flex items-center gap-4 p-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl ring-1 ring-line/70 sm:h-20 sm:w-20">
                {game.icon?.url ? <Image src={game.icon.url} alt="" fill priority sizes="80px" className="object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-display text-lg font-bold sm:text-xl">
                  Download {game.name} MOD APK
                </h1>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {formatVersion(game.version)} · {formatBytes(game.sizeBytes)} · {game.developer}
                </p>
              </div>
              <Link href={`/game/${game.slug}`} className="btn-ghost btn-sm btn hidden shrink-0 sm:inline-flex">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Link>
            </div>

            <AdSlot format="leaderboard" className="mb-6" />

            {/* the countdown gate */}
            <DownloadCountdown
              slug={game.slug}
              gameName={game.name}
              links={links}
              seconds={10}
              preferMirror={sp.mirror === '1'}
            />

            {/* warnings */}
            <div className="mt-6 rounded-2xl border border-warning/30 bg-warning/[0.07] p-5">
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-warning">
                <AlertTriangle className="h-4 w-4" />
                Before you install
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                  Uninstall any Play Store copy of {game.name} first — Android blocks installs when signatures differ.
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                  Enable &ldquo;Install unknown apps&rdquo; for your browser or file manager in Android settings.
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                  Online competitive modes may detect modified clients. Use a secondary account if you play ranked.
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                  Only download from this page. Files mirrored elsewhere are not verified by MODSzora.
                </li>
              </ul>
            </div>

            {/* installation guide */}
            {game.installationGuide?.length ? (
              <div className="mt-6">
                <h2 className="mb-3 font-display text-lg font-bold">Installation Guide</h2>
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
              </div>
            ) : null}

            <AdSlot format="in-article" className="mt-6" />

            <NativeAd className="mt-6" />
          </div>

          {/* sidebar */}
          <aside className="min-w-0 space-y-5">
            <div className="card p-5">
              <h2 className="mb-2 flex items-center gap-2 font-display text-base font-bold">
                <Info className="h-4 w-4 text-brand" />
                APK Information
              </h2>
              <dl>
                <SpecRow label="Version" value={game.version} />
                {game.modVersion ? <SpecRow label="MOD" value={game.modVersion} /> : null}
                <SpecRow label="Size" value={formatBytes(game.sizeBytes)} />
                <SpecRow label="Android" value={game.androidVersion} />
                <SpecRow label="Category" value={CATEGORY_LABELS[game.category] ?? game.category} />
                <SpecRow
                  label="Package"
                  value={<code className="break-all font-mono text-2xs text-muted">{game.packageName}</code>}
                />
                <SpecRow label="Updated" value={formatDate(game.updatedDate ?? game.updatedAt)} />
              </dl>
            </div>

            {game.virusScan?.status === 'clean' ? (
              <div className="card border-success/30 bg-success/[0.06] p-5">
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-success">
                  <ShieldCheck className="h-4 w-4" />
                  Verified Safe
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Scanned by {game.virusScan.engines} antivirus engines with {game.virusScan.detections} detections.
                </p>
                {game.virusScan.sha256 ? (
                  <code className="mt-2 block break-all font-mono text-[10px] text-faint">{game.virusScan.sha256}</code>
                ) : null}
              </div>
            ) : null}

            <AdSlot format="rectangle" />
          </aside>
        </div>
      </div>

      {related.length ? (
        <Section className="pt-0">
          <div className="container">
            <SectionHeader title="More Games Like This" />
            <div className="grid grid-auto-fill gap-3 sm:gap-4">
              {related.map((g) => (
                <GameCard key={g.slug} game={g} />
              ))}
            </div>
          </div>
        </Section>
      ) : null}
    </>
  );
}
