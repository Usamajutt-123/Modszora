import Link from 'next/link';
import type { Metadata } from 'next';
import { ImageIcon, Plus, Sparkles, Star } from 'lucide-react';
import { formatCompactNumber, WALLPAPER_CATEGORIES } from '@modverse/shared';
import { adminListWallpapers } from '@/lib/repositories/cms';
import { ContentFilters, ContentTable, type ContentRow } from '@/components/admin/ContentTable';
import { Pagination } from '@/components/ui/Pagination';

export const metadata: Metadata = { title: 'Wallpaper Manager' };
export const dynamic = 'force-dynamic';

const firstOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminWallpapersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = firstOf(sp.q) ?? '';
  const status = firstOf(sp.status) ?? '';
  const category = firstOf(sp.category) ?? '';
  const page = Number(firstOf(sp.page) ?? 1) || 1;

  const result = await adminListWallpapers({ q, status, category, page, pageSize: 20 });

  const rows: ContentRow[] = result.items.map((w) => ({
    id: w.id,
    title: w.title,
    slug: w.slug,
    status: w.status,
    thumbnail: w.thumbnail?.url ?? w.image?.url ?? null,
    meta: `${w.category} · ${w.resolution}`,
    stat: `${formatCompactNumber(w.downloads)} downloads`,
    updatedAt: w.createdAt,
    editHref: `/admin/wallpapers/${w.id}`,
    viewHref: w.status === 'published' ? `/wallpapers/${w.slug}` : undefined,
    badges: (
      <>
        {w.featured ? <Star className="h-3 w-3 text-warning" aria-label="Featured" /> : null}
        {w.gameSlug ? <Sparkles className="h-3 w-3 text-brand" aria-label="AI generated" /> : null}
      </>
    ),
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-2xl font-extrabold">
            <ImageIcon className="h-6 w-6 text-brand" />
            Wallpapers
          </h1>
          <p className="mt-1 text-sm text-muted">
            {result.total} wallpaper{result.total === 1 ? '' : 's'} · upload manually or generate from game screenshots.
          </p>
        </div>
        <Link href="/admin/wallpapers/new" className="btn-primary btn-sm btn">
          <Plus className="h-3.5 w-3.5" />
          New wallpaper
        </Link>
      </header>

      <ContentFilters
        action="/admin/wallpapers"
        q={q}
        status={status}
        extra={
          <div>
            <label htmlFor="category" className="label">Category</label>
            <select id="category" name="category" defaultValue={category} className="input w-auto">
              <option value="">All</option>
              {WALLPAPER_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        }
      />

      <ContentTable
        rows={rows}
        emptyTitle="No wallpapers yet"
        emptyDescription="Upload one manually, or let the agent generate a set from a game's screenshots."
        createHref="/admin/wallpapers/new"
        createLabel="Add a wallpaper"
        columns={{ meta: 'Category / Size', stat: 'Downloads' }}
      />

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        basePath="/admin/wallpapers"
        searchParams={{ q: q || undefined, status: status || undefined, category: category || undefined }}
      />
    </div>
  );
}
