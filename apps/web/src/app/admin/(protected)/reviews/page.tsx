import Link from 'next/link';
import type { Metadata } from 'next';
import { Plus, Star } from 'lucide-react';
import { adminListReviews } from '@/lib/repositories/cms';
import { ContentFilters, ContentTable, type ContentRow } from '@/components/admin/ContentTable';
import { Pagination } from '@/components/ui/Pagination';

export const metadata: Metadata = { title: 'Review Manager' };
export const dynamic = 'force-dynamic';

const firstOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = firstOf(sp.q) ?? '';
  const status = firstOf(sp.status) ?? '';
  const page = Number(firstOf(sp.page) ?? 1) || 1;

  const result = await adminListReviews({ q, status, page, pageSize: 20 });

  const rows: ContentRow[] = result.items.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    status: r.status,
    thumbnail: r.cover?.url ?? null,
    meta: r.gameSlug ? `Game: ${r.gameSlug}` : 'Standalone',
    stat: `${r.score.toFixed(1)}/10 · ${r.pros.length} pros / ${r.cons.length} cons`,
    updatedAt: r.publishedAt,
    editHref: `/admin/reviews/${r.id}`,
    viewHref: r.status === 'published' ? `/reviews/${r.slug}` : undefined,
    badges: r.featured ? <Star className="h-3 w-3 text-warning" aria-label="Featured" /> : null,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-2xl font-extrabold">
            <Star className="h-6 w-6 text-brand" />
            Reviews
          </h1>
          <p className="mt-1 text-sm text-muted">
            {result.total} review{result.total === 1 ? '' : 's'} · write manually or use the AI generator.
          </p>
        </div>
        <Link href="/admin/reviews/new" className="btn-primary btn-sm btn">
          <Plus className="h-3.5 w-3.5" />
          New review
        </Link>
      </header>

      <ContentFilters action="/admin/reviews" q={q} status={status} />

      <ContentTable
        rows={rows}
        emptyTitle="No reviews yet"
        emptyDescription="Pick a game and let the Review Generator draft one, then edit before publishing."
        createHref="/admin/reviews/new"
        createLabel="Write a review"
        columns={{ meta: 'Linked game', stat: 'Score' }}
      />

      <Pagination page={result.page} totalPages={result.totalPages} basePath="/admin/reviews"
        searchParams={{ q: q || undefined, status: status || undefined }} />
    </div>
  );
}
