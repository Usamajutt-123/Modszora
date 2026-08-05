import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Download, Maximize2 } from 'lucide-react';
import { breadcrumbJsonLd, formatBytes, formatCompactNumber, type Crumb } from '@modverse/shared';
import { getAllWallpaperSlugs, getWallpaperBySlug, listWallpapers } from '@/lib/repositories/content';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { SpecRow, Section, SectionHeader } from '@/components/ui';
import { ShareButtons } from '@/components/game/ShareButtons';
import { buildMetadata, jsonLdScript } from '@/lib/metadata';
import { env, siteUrl } from '@/lib/env';

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllWallpaperSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const wp = await getWallpaperBySlug(slug);
  if (!wp) {
    return buildMetadata({ title: 'Wallpaper not found', description: 'Unavailable.', path: `/wallpapers/${slug}`, noindex: true });
  }
  return buildMetadata({
    title: wp.seo?.title || `${wp.title} — 4K Gaming Wallpaper`,
    description: wp.seo?.description || `Download ${wp.title} in ${wp.resolution} for free. High-quality ${wp.category} gaming wallpaper.`,
    path: `/wallpapers/${wp.slug}`,
    keywords: wp.seo?.keywords ?? wp.tags,
    image: wp.image?.url ?? null,
  });
}

export default async function WallpaperPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const wp = await getWallpaperBySlug(slug);
  if (!wp) notFound();

  const more = await listWallpapers({ category: wp.category, pageSize: 8 });
  const base = siteUrl();
  const ctx = { siteUrl: base, siteName: env.NEXT_PUBLIC_SITE_NAME || 'MODSzora' };

  const crumbs: Crumb[] = [
    { name: 'Wallpapers', path: '/wallpapers' },
    { name: wp.category, path: `/wallpapers/category/${wp.category}` },
    { name: wp.title, path: `/wallpapers/${wp.slug}` },
  ];

  const imageLd = {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    name: wp.title,
    contentUrl: wp.image.url,
    thumbnailUrl: wp.thumbnail?.url ?? wp.image.url,
    width: wp.image.width ?? undefined,
    height: wp.image.height ?? undefined,
    encodingFormat: `image/${wp.image.format}`,
    license: `${base}/terms`,
    acquireLicensePage: `${base}/wallpapers/${wp.slug}`,
    creditText: 'MODSzora',
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript([imageLd, breadcrumbJsonLd(ctx, crumbs)]) }} />

      <div className="container py-6">
        <Breadcrumbs crumbs={crumbs} className="mb-5" />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <div className="relative aspect-banner overflow-hidden rounded-2xl border border-line/70 bg-surface-2">
              <Image
                src={wp.image.url}
                alt={wp.image.alt ?? wp.title}
                fill
                priority
                sizes="(max-width:1024px) 100vw, 860px"
                className="object-cover"
              />
            </div>

            <h1 className="mt-5 text-display-sm font-extrabold">{wp.title}</h1>
            <p className="mt-2 text-sm capitalize text-muted">
              {wp.category} wallpaper · {wp.resolution}
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <a
                href={`${wp.image.url}?download=${wp.slug}.${wp.image.format}`}

                rel="noopener noreferrer"
                className="btn-primary btn-lg btn"
              >
                <Download className="h-4.5 w-4.5" />
                Download {wp.resolution}
              </a>
              <a href={wp.image.url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-lg btn">
                <Maximize2 className="h-4.5 w-4.5" />
                View full size
              </a>
            </div>

            <ShareButtons url={`${base}/wallpapers/${wp.slug}`} title={wp.title} className="mt-5" />
          </div>

          <aside className="min-w-0 space-y-5">
            <div className="card p-5">
              <h2 className="mb-2 font-display text-base font-bold">Details</h2>
              <dl>
                <SpecRow label="Resolution" value={wp.resolution} />
                <SpecRow label="Format" value={wp.image.format.toUpperCase()} />
                {wp.image.bytes ? <SpecRow label="File size" value={formatBytes(wp.image.bytes)} /> : null}
                <SpecRow label="Category" value={<span className="capitalize">{wp.category}</span>} />
                <SpecRow label="Downloads" value={formatCompactNumber(wp.downloads)} />
              </dl>
            </div>

            {wp.tags.length ? (
              <div className="card p-5">
                <h2 className="mb-3 font-display text-base font-bold">Tags</h2>
                <div className="flex flex-wrap gap-1.5">
                  {wp.tags.map((t) => (
                    <span key={t} className="chip text-2xs">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>

      {more.items.filter((w) => w.slug !== wp.slug).length ? (
        <Section className="pt-0">
          <div className="container">
            <SectionHeader title="More Like This" href={`/wallpapers/category/${wp.category}`} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {more.items
                .filter((w) => w.slug !== wp.slug)
                .slice(0, 8)
                .map((w) => (
                  <Link
                    key={w.slug}
                    href={`/wallpapers/${w.slug}`}
                    className="group relative aspect-banner overflow-hidden rounded-xl border border-line/70"
                  >
                    <Image
                      src={(w.thumbnail?.url ?? w.image.url) as string}
                      alt={w.title}
                      fill
                      sizes="(max-width:640px) 50vw, 25vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  </Link>
                ))}
            </div>
          </div>
        </Section>
      ) : null}
    </>
  );
}
