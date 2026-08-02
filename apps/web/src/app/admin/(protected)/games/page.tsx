import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Filter, Gamepad2, Info, Pencil, Plus, Search } from 'lucide-react';
import { formatBytes, formatCompactNumber, PUBLISH_STATUSES, timeAgo } from '@modverse/shared';
import { listAdminGames } from '@/lib/repositories/admin';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Game Manager' };
export const dynamic = 'force-dynamic';

const firstOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const STATUS_STYLES: Record<string, string> = {
  published: 'bg-success/15 text-success',
  draft: 'bg-surface-2 text-faint',
  scheduled: 'bg-warning/15 text-warning',
  archived: 'bg-danger/15 text-danger',
};

export default async function AdminGamesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = firstOf(sp.q) ?? '';
  const status = firstOf(sp.status) ?? '';
  const page = Number(firstOf(sp.page) ?? 1) || 1;

  const result = await listAdminGames({ q, status, page, pageSize: 20 });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Game Manager</h1>
          <p className="mt-1 text-sm text-muted">
            {result.total} listing{result.total === 1 ? '' : 's'} Â· create, edit, schedule and bulk manage.
          </p>
        </div>
        <Link href="/admin/games/new" className="btn-primary btn-sm btn">
          <Plus className="h-3.5 w-3.5" />
          New game
        </Link>
      </header>

      {/* filters */}
      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="q" className="label">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input id="q" name="q" defaultValue={q} placeholder="Name, package or developer" className="input pl-9" />
          </div>
        </div>
        <div>
          <label htmlFor="status" className="label">
            Status
          </label>
          <select id="status" name="status" defaultValue={status} className="input w-auto">
            <option value="">All</option>
            {PUBLISH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary btn">
          <Filter className="h-3.5 w-3.5" />
          Apply
        </button>
      </form>

      {/* table */}
      {result.items.length ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-left">
                  {['Game', 'Version', 'Category', 'Size', 'Traffic', 'Status', 'Updated', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-2xs font-bold uppercase tracking-wider text-faint">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {result.items.map((game) => (
                  <tr key={game.id ?? game.slug} className="transition-colors hover:bg-surface-2/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line/70">
                          {game.icon?.url ? <Image src={game.icon.url} alt="" fill sizes="36px" className="object-cover" /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block max-w-[220px] truncate font-medium text-ink">{game.name}</span>
                          <span className="block max-w-[220px] truncate font-mono text-2xs text-faint">{game.packageName}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{game.version}</td>
                    <td className="px-4 py-3 text-xs capitalize text-muted">{game.category}</td>
                    <td className="px-4 py-3 text-xs text-muted">{formatBytes(game.sizeBytes)}</td>
                    <td className="px-4 py-3 text-2xs text-muted">
                      {formatCompactNumber(game.views)} views
                      <br />
                      {formatCompactNumber(game.downloads)} dl
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-md px-2 py-0.5 text-2xs font-bold uppercase', STATUS_STYLES[game.status])}>
                        {game.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-2xs text-faint">{timeAgo(game.updatedAt ?? game.updatedDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Link
                          href={`/game/${game.slug}`}
                          target="_blank"
                          className="rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-brand"
                          aria-label={`View ${game.name}`}
                        >
                          <Gamepad2 className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          href={`/admin/games/edit/${game.id ?? game.slug}`}
                          className="rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-brand"
                          aria-label={`Details for ${game.name}`}
                          title="Details"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          href={`/admin/games/manage/${game.id ?? game.slug}`}
                          className="rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-brand"
                          aria-label={`Edit ${game.name}`}
                          title="Edit manually"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No games found"
          description={q || status ? 'Try clearing the filters.' : 'Add your first game, or let the agent discover some.'}
          icon={<Gamepad2 className="h-10 w-10" />}
          action={
            <Link href="/admin/games/new" className="btn-primary btn">
              <Plus className="h-4 w-4" />
              Add a game
            </Link>
          }
        />
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        basePath="/admin/games"
        searchParams={{ q: q || undefined, status: status || undefined }}
      />
    </div>
  );
}