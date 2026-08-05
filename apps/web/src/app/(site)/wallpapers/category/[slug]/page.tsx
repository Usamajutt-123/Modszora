import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ImageIcon } from 'lucide-react';
import { breadcrumbJsonLd, formatCompactNumber, WALLPAPER_CATEGORIES, type Crumb, type WallpaperCategory } from '@modverse/shared';
import { getWallpaperCategories, listWallpapers } from '@/lib/repositories/content';
import { Pagination } from '@/components/ui/Pagination';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Chip, EmptyState } from '@/components/ui';
import { buildMetadata, jsonLdScript } from '@/lib/metadata';
import { env, siteUrl } from '@/lib/env';

export const revalidate = 3600;

export function generateStaticParams() {
  return WALLPAPER_CATEGORIES.map((slug) => ({ slug }));
}

function isCategory(v: string): v is WallpaperCategory {
  return (WALLPAPER_CATEGORIES as readonly string[]).includes(v);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!isCategory(slug)) {
    return buildMetadata({ title: 'Not found', description: 'Unknown category.', path: `/wallpapers/category/${slug}`, noindex: true });
  }
  const label = slug.replace('-', ' ');
  return buildMetadata({
    title: `${label.charAt(0).toUpperCase() + label.slice(1)} Gaming Wallpapers — 4K Free`,
    description: `Free 4K ${label} gaming wallpapers for phone and desktop. Download instantly, no signup required.`,
    path: `/wallpapers/category/${slug}`,
    keywords: [`${label} wallpaper`, `${label} gaming wallpaper`, '4k wallpaper', 'phone background'],
  });
}

const firstOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function WallpaperCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  if (!isCategory(slug)) notFound();

  const page = Number(firstOf(sp.page) ?? 1) || 1;
  const [result, categories] = await Promise.all([
    listWallpapers({ category: slug, page, pageSize: 24 }),
    getWallpaperCategories(),
  ]);

  const label = slug.replace('-', ' ');
  const ctx = { siteUrl: siteUrl(), siteName: env.NEXT_PUBLIC_SITE_NAME || 'MODSzora' };
  const crumbs: Crumb[] = [
    { name: 'Wallpapers', path: '/wallpapers' },
    { name: label, path: `/wallpapers/category/${slug}` },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(ctx, crumbs)) }} />

      <div className="container py-6">
        <Breadcrumbs crumbs={crumbs} className="mb-5" />

        <header className="mb-6">
          <h1 className="flex items-center gap-2.5 text-display-sm font-extrabold capitalize">
            <ImageIcon className="h-7 w-7 text-brand" />
            {label} Wallpapers
          </h1>
          <p className="mt-2.5 text-sm text-muted">{result.total} free 4K wallpapers in this category.</p>
        </header>

        <div className="mb-7 flex flex-wrap gap-2">
          <Chip href="/wallpapers">All</Chip>
          {WALLPAPER_CATEGORIES.map((c) => {
            const count = categories.find((x) => x.category === c)?.count;
            return (
              <Chip key={c} href={`/wallpapers/category/${c}`} active={c === slug}>
                <span className="capitalize">{c.replace('-', ' ')}</span>
                {count ? <span className="text-faint">{count}</span> : null}
              </Chip>
            );
          })}
        </div>

        {result.items.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {result.items.map((w, i) => (
              <Link
                key={w.slug}
                href={`/wallpapers/${w.slug}`}
                className="group relative aspect-banner overflow-hidden rounded-xl border border-line/70 bg-surface-2"
              >
                <Image
                  src={(w.thumbnail?.url ?? w.image.url) as string}
                  alt={w.title}
                  fill
                  priority={i < 8}
                  sizes="(max-width:640px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="absolute inset-x-2 bottom-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="truncate text-xs font-bold text-white">{w.title}</p>
                  <p className="text-2xs text-white/70">{formatCompactNumber(w.downloads)} downloads</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No wallpapers in this category" description="Try another category." icon={<ImageIcon className="h-10 w-10" />} />
        )}

        <Pagination page={result.page} totalPages={result.totalPages} basePath={`/wallpapers/category/${slug}`} className="mt-10" />
      </div>
    </>
  );
}
