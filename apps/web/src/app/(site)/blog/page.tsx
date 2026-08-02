import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Newspaper } from 'lucide-react';
import { BLOG_CATEGORIES, breadcrumbJsonLd, formatDate, itemListJsonLd, type Crumb } from '@modverse/shared';
import { getPostCategories, listPosts } from '@/lib/repositories/content';
import { Pagination } from '@/components/ui/Pagination';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Chip, EmptyState } from '@/components/ui';
import { buildMetadata, jsonLdScript } from '@/lib/metadata';
import { env, siteUrl } from '@/lib/env';

export const revalidate = 1800;

export const metadata: Metadata = buildMetadata({
  title: 'Gaming News, Guides & MOD APK Tips',
  description:
    'Android gaming news, sideloading guides, MOD APK safety explainers and release roundups from the MODVerse editorial team.',
  path: '/blog',
  keywords: ['gaming news', 'mod apk guides', 'android gaming blog', 'apk install tips'],
});

const firstOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const page = Number(firstOf(sp.page) ?? 1) || 1;

  const [result, categories] = await Promise.all([listPosts({ page, pageSize: 12 }), getPostCategories()]);

  const ctx = { siteUrl: siteUrl(), siteName: env.NEXT_PUBLIC_SITE_NAME || 'MODVerse' };
  const crumbs: Crumb[] = [{ name: 'Blog', path: '/blog' }];
  const schemas = [
    breadcrumbJsonLd(ctx, crumbs),
    itemListJsonLd(
      ctx,
      result.items.map((p) => ({ name: p.title, path: `/blog/${p.slug}`, image: p.cover?.url })),
      'MODVerse Blog',
    ),
  ];

  const [featured, ...rest] = result.items;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(schemas) }} />

      <div className="container py-6">
        <Breadcrumbs crumbs={crumbs} className="mb-5" />

        <header className="mb-6">
          <h1 className="flex items-center gap-2.5 text-display-sm font-extrabold">
            <Newspaper className="h-7 w-7 text-brand" />
            Gaming News &amp; Guides
          </h1>
          <p className="mt-2.5 max-w-2xl text-sm text-muted">
            Install guides, Android platform changes, mod safety explainers and what the community is playing.
          </p>
        </header>

        {/* category chips */}
        <div className="mb-7 flex flex-wrap gap-2">
          <Chip href="/blog" active>
            All
          </Chip>
          {BLOG_CATEGORIES.map((c) => {
            const count = categories.find((x) => x.category === c)?.count;
            return (
              <Chip key={c} href={`/blog/category/${c}`}>
                <span className="capitalize">{c}</span>
                {count ? <span className="text-faint">{count}</span> : null}
              </Chip>
            );
          })}
        </div>

        {result.items.length ? (
          <>
            {/* featured post */}
            {featured && page === 1 ? (
              <Link href={`/blog/${featured.slug}`} className="card card-hover group mb-7 grid overflow-hidden md:grid-cols-2">
                <div className="relative aspect-banner overflow-hidden md:aspect-auto md:min-h-[280px]">
                  {featured.cover?.url ? (
                    <Image
                      src={featured.cover.url}
                      alt=""
                      fill
                      priority
                      sizes="(max-width:768px) 100vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : null}
                </div>
                <div className="flex flex-col justify-center p-6">
                  <span className="chip chip-active w-fit text-2xs capitalize">{featured.category}</span>
                  <h2 className="mt-3 font-display text-2xl font-bold leading-tight text-ink group-hover:text-brand">
                    {featured.title}
                  </h2>
                  <p className="mt-2.5 line-clamp-3 text-sm text-muted">{featured.excerpt}</p>
                  <p className="mt-4 text-2xs text-faint">
                    {featured.author} · {formatDate(featured.publishedAt)} · {featured.readingMinutes} min read
                  </p>
                </div>
              </Link>
            ) : null}

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {(page === 1 ? rest : result.items).map((post) => (
                <article key={post.slug} className="card card-hover group overflow-hidden">
                  <Link href={`/blog/${post.slug}`}>
                    <div className="relative aspect-banner overflow-hidden">
                      {post.cover?.url ? (
                        <Image
                          src={post.cover.url}
                          alt=""
                          fill
                          sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : null}
                    </div>
                    <div className="p-4">
                      <span className="chip text-2xs capitalize">{post.category}</span>
                      <h2 className="mt-2 line-clamp-2 font-display text-base font-bold text-ink group-hover:text-brand">
                        {post.title}
                      </h2>
                      <p className="mt-2 line-clamp-2 text-sm text-muted">{post.excerpt}</p>
                      <p className="mt-3 border-t border-line/60 pt-2.5 text-2xs text-faint">
                        {formatDate(post.publishedAt)} · {post.readingMinutes} min read
                      </p>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </>
        ) : (
          <EmptyState title="No posts yet" description="Articles are on the way." icon={<Newspaper className="h-10 w-10" />} />
        )}

        <Pagination page={result.page} totalPages={result.totalPages} basePath="/blog" className="mt-10" />
      </div>
    </>
  );
}
