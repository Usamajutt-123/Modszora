import Link from 'next/link';
import type { Metadata } from 'next';
import { FileText, Plus, Star } from 'lucide-react';
import { formatCompactNumber, BLOG_CATEGORIES } from '@modverse/shared';
import { adminListPosts } from '@/lib/repositories/cms';
import { ContentFilters, ContentTable, type ContentRow } from '@/components/admin/ContentTable';
import { Pagination } from '@/components/ui/Pagination';

export const metadata: Metadata = { title: 'Blog Manager' };
export const dynamic = 'force-dynamic';

const firstOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminBlogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = firstOf(sp.q) ?? '';
  const status = firstOf(sp.status) ?? '';
  const category = firstOf(sp.category) ?? '';
  const page = Number(firstOf(sp.page) ?? 1) || 1;

  const result = await adminListPosts({ q, status, category, isNews: false, page, pageSize: 20 });

  const rows: ContentRow[] = result.items.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    status: p.status,
    thumbnail: p.cover?.url ?? null,
    meta: `${p.category} · ${p.readingMinutes} min read`,
    stat: `${formatCompactNumber(p.views)} views · ${p.tags.length} tags`,
    updatedAt: p.publishedAt,
    editHref: `/admin/blog/${p.id}`,
    viewHref: p.status === 'published' ? `/blog/${p.slug}` : undefined,
    badges: p.featured ? <Star className="h-3 w-3 text-warning" aria-label="Featured" /> : null,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-2xl font-extrabold">
            <FileText className="h-6 w-6 text-brand" />
            Blog
          </h1>
          <p className="mt-1 text-sm text-muted">
            {result.total} item{result.total === 1 ? '' : 's'} · guides, tips and evergreen articles.
          </p>
        </div>
        <Link href="/admin/blog/new" className="btn-primary btn-sm btn">
          <Plus className="h-3.5 w-3.5" />
          New
        </Link>
      </header>

      <ContentFilters
        action="/admin/blog"
        q={q}
        status={status}
        extra={
          <div>
            <label htmlFor="category" className="label">Category</label>
            <select id="category" name="category" defaultValue={category} className="input w-auto">
              <option value="">All</option>
              {BLOG_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        }
      />

      <ContentTable
        rows={rows}
        emptyTitle="Nothing here yet"
        emptyDescription="Use the Article Generator to draft one from a template, then edit before publishing."
        createHref="/admin/blog/new"
        createLabel="Write something"
        columns={{ meta: 'Category', stat: 'Engagement' }}
      />

      <Pagination page={result.page} totalPages={result.totalPages} basePath="/admin/blog"
        searchParams={{ q: q || undefined, status: status || undefined, category: category || undefined }} />
    </div>
  );
}
