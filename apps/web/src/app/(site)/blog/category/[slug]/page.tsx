import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Newspaper } from 'lucide-react';
import { BLOG_CATEGORIES, breadcrumbJsonLd, formatDate, type BlogCategory, type Crumb } from '@modverse/shared';
import { listPosts, getPostCategories } from '@/lib/repositories/content';
import { Pagination } from '@/components/ui/Pagination';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Chip, EmptyState } from '@/components/ui';
import { buildMetadata, jsonLdScript } from '@/lib/metadata';
import { env, siteUrl } from '@/lib/env';

export const revalidate = 1800;

export function generateStaticParams() {
  return BLOG_CATEGORIES.map((slug) => ({ slug }));
}

const DESCRIPTIONS: Record<BlogCategory, string> = {
  news: 'Breaking Android gaming news, release announcements and platform changes that affect modded games.',
  guides: 'Step-by-step tutorials for installing, troubleshooting and getting the most from MOD APK files.',
  updates: 'Platform and app update coverage — what changed, what broke, and what it means for sideloading.',
  esports: 'Mobile esports coverage: tournaments, prize pools, rosters and the competitive scene.',
  reviews: 'Editorial reviews and comparison pieces on the games worth your storage space.',
  tips: 'Short, practical tips for Android gamers — performance tuning, storage, battery and more.',
};

function isCategory(v: string): v is BlogCategory {
  return (BLOG_CATEGORIES as readonly string[]).includes(v);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!isCategory(slug)) {
    return buildMetadata({ title: 'Category not found', description: 'Unknown.', path: `/blog/category/${slug}`, noindex: true });
  }
  const label = slug.charAt(0).toUpperCase() + slug.slice(1);
  return buildMetadata({
    title: `${label} — MODSzora Blog`,
    description: DESCRIPTIONS[slug],
    path: `/blog/category/${slug}`,
    keywords: [`android ${slug}`, `mod apk ${slug}`, `gaming ${slug}`],
  });
}

const firstOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BlogCategoryPage({
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
    listPosts({ category: slug, page, pageSize: 12 }),
    getPostCategories(),
  ]);

  const label = slug.charAt(0).toUpperCase() + slug.slice(1);
  const ctx = { siteUrl: siteUrl(), siteName: env.NEXT_PUBLIC_SITE_NAME || 'MODSzora' };
  const crumbs: Crumb[] = [
    { name: 'Blog', path: '/blog' },
    { name: label, path: `/blog/category/${slug}` },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(ctx, crumbs)) }} />

      <div className="container py-6">
        <Breadcrumbs crumbs={crumbs} className="mb-5" />

        <header className="mb-6">
          <h1 className="flex items-center gap-2.5 text-display-sm font-extrabold">
            <Newspaper className="h-7 w-7 text-brand" />
            {label}
          </h1>
          <p className="mt-2.5 max-w-2xl text-sm text-muted">{DESCRIPTIONS[slug]}</p>
        </header>

        <div className="mb-7 flex flex-wrap gap-2">
          <Chip href="/blog">All</Chip>
          {BLOG_CATEGORIES.map((c) => {
            const count = categories.find((x) => x.category === c)?.count;
            return (
              <Chip key={c} href={`/blog/category/${c}`} active={c === slug}>
                <span className="capitalize">{c}</span>
                {count ? <span className="text-faint">{count}</span> : null}
              </Chip>
            );
          })}
        </div>

        {result.items.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((post) => (
              <article key={post.slug} className="card card-hover group overflow-hidden">
                <Link href={`/blog/${post.slug}`}>
                  <div className="relative aspect-banner overflow-hidden">
                    {post.cover?.url ? (
                      <Image src={post.cover.url} alt="" fill sizes="(max-width:640px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <h2 className="line-clamp-2 font-display text-base font-bold text-ink group-hover:text-brand">{post.title}</h2>
                    <p className="mt-2 line-clamp-2 text-sm text-muted">{post.excerpt}</p>
                    <p className="mt-3 border-t border-line/60 pt-2.5 text-2xs text-faint">
                      {formatDate(post.publishedAt)} · {post.readingMinutes} min read
                    </p>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title={`No ${label.toLowerCase()} posts yet`} description="Check back soon." icon={<Newspaper className="h-10 w-10" />} />
        )}

        <Pagination page={result.page} totalPages={result.totalPages} basePath={`/blog/category/${slug}`} className="mt-10" />
      </div>
    </>
  );
}
