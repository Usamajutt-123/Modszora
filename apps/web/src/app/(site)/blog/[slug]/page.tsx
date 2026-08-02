import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Clock, Tag } from 'lucide-react';
import { articleJsonLd, breadcrumbJsonLd, formatDate, type Crumb } from '@modverse/shared';
import { getAllPostSlugs, getPostBySlug, listPosts } from '@/lib/repositories/content';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Prose, Section, SectionHeader } from '@/components/ui';
import { ShareButtons } from '@/components/game/ShareButtons';
import { AdSlot } from '@/components/ads/AdSlot';
import { NewsletterForm } from '@/components/marketing/NewsletterForm';
import { buildMetadata, jsonLdScript } from '@/lib/metadata';
import { env, siteUrl } from '@/lib/env';

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) {
    return buildMetadata({ title: 'Post not found', description: 'Unavailable.', path: `/blog/${slug}`, noindex: true });
  }
  return buildMetadata({
    title: post.seo?.title || post.title,
    description: post.seo?.description || post.excerpt,
    path: `/blog/${post.slug}`,
    keywords: post.seo?.keywords ?? post.tags,
    image: post.seo?.ogImage ?? post.cover?.url ?? null,
    type: 'article',
    publishedTime: post.publishedAt,
    authors: [post.author],
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const related = await listPosts({ category: post.category, pageSize: 4 });
  const base = siteUrl();
  const ctx = { siteUrl: base, siteName: env.NEXT_PUBLIC_SITE_NAME || 'MODVerse' };

  const crumbs: Crumb[] = [
    { name: 'Blog', path: '/blog' },
    { name: post.category, path: `/blog/category/${post.category}` },
    { name: post.title, path: `/blog/${post.slug}` },
  ];
  const schemas = [articleJsonLd(ctx, post), breadcrumbJsonLd(ctx, crumbs)];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(schemas) }} />

      <article className="container py-6">
        <Breadcrumbs crumbs={crumbs} className="mb-5" />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <header>
              <Link href={`/blog/category/${post.category}`} className="chip chip-active text-2xs capitalize">
                {post.category}
              </Link>
              <h1 className="mt-3 text-display-sm font-extrabold leading-tight">{post.title}</h1>
              <p className="mt-3 text-base leading-relaxed text-muted">{post.excerpt}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-faint">
                <span>By {post.author}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={post.publishedAt ?? undefined}>{formatDate(post.publishedAt)}</time>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {post.readingMinutes} min read
                </span>
              </div>
            </header>

            {post.cover?.url ? (
              <div className="relative mt-6 aspect-banner overflow-hidden rounded-2xl border border-line/70">
                <Image src={post.cover.url} alt="" fill priority sizes="(max-width:1024px) 100vw, 760px" className="object-cover" />
              </div>
            ) : null}

            <div className="mt-8">
              <Prose html={post.content} />
            </div>

            {post.tags.length ? (
              <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-line/60 pt-5">
                <Tag className="h-3.5 w-3.5 text-faint" />
                {post.tags.map((t) => (
                  <Link key={t} href={`/blog?tag=${encodeURIComponent(t)}`} className="chip text-2xs">
                    {t}
                  </Link>
                ))}
              </div>
            ) : null}

            <ShareButtons url={`${base}/blog/${post.slug}`} title={post.title} className="mt-6" />

            <div className="card-gradient mt-8">
              <div className="p-6">
                <h2 className="font-display text-lg font-bold">Get the weekly digest</h2>
                <p className="mt-1.5 text-sm text-muted">New mods, version bumps and guides — once a week.</p>
                <NewsletterForm className="mt-4" />
              </div>
            </div>
          </div>

          <aside className="min-w-0 space-y-5">
            <AdSlot format="rectangle" />
            <AdSlot format="sidebar" className="hidden lg:grid" />
          </aside>
        </div>
      </article>

      {related.items.filter((p) => p.slug !== post.slug).length ? (
        <Section className="pt-0">
          <div className="container">
            <SectionHeader title="Related Articles" href="/blog" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.items
                .filter((p) => p.slug !== post.slug)
                .slice(0, 4)
                .map((p) => (
                  <Link key={p.slug} href={`/blog/${p.slug}`} className="card card-hover group overflow-hidden">
                    <div className="relative aspect-banner overflow-hidden">
                      {p.cover?.url ? (
                        <Image src={p.cover.url} alt="" fill sizes="25vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : null}
                    </div>
                    <div className="p-3">
                      <h3 className="line-clamp-2 text-sm font-semibold text-ink group-hover:text-brand">{p.title}</h3>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </Section>
      ) : null}
    </>
  );
}
