import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Eye, Pencil, Plus, Star } from 'lucide-react';
import { timeAgo, type PublishStatus } from '@modverse/shared';
import { EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * Shared table used by the wallpaper, review, blog and news managers.
 *
 * Rows are described declaratively so each manager stays a thin page that
 * only supplies data and column definitions.
 */

export const STATUS_STYLES: Record<PublishStatus, string> = {
  published: 'bg-success/15 text-success',
  draft: 'bg-surface-2 text-faint',
  scheduled: 'bg-warning/15 text-warning',
  archived: 'bg-danger/15 text-danger',
};

export function StatusPill({ status }: { status: PublishStatus }) {
  return (
    <span className={cn('rounded-md px-2 py-0.5 text-2xs font-bold uppercase', STATUS_STYLES[status])}>{status}</span>
  );
}

export interface ContentRow {
  id: string;
  title: string;
  slug: string;
  status: PublishStatus;
  thumbnail?: string | null;
  meta?: string;
  badges?: ReactNode;
  stat?: string;
  updatedAt?: string | null;
  editHref: string;
  viewHref?: string;
}

export function ContentTable({
  rows,
  emptyTitle,
  emptyDescription,
  createHref,
  createLabel = 'Create',
  columns = { meta: 'Details', stat: 'Stats' },
}: {
  rows: ContentRow[];
  emptyTitle: string;
  emptyDescription: string;
  createHref: string;
  createLabel?: string;
  columns?: { meta?: string; stat?: string };
}) {
  if (!rows.length) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={<Star className="h-10 w-10" />}
        action={
          <Link href={createHref} className="btn-primary btn">
            <Plus className="h-4 w-4" />
            {createLabel}
          </Link>
        }
      />
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-left">
              {['Item', columns.meta ?? 'Details', columns.stat ?? 'Stats', 'Status', 'Updated', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-2xs font-bold uppercase tracking-wider text-faint">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-surface-2/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {row.thumbnail !== undefined ? (
                      <span className="relative h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line/70">
                        {row.thumbnail ? (
                          <Image src={row.thumbnail} alt="" fill sizes="56px" className="object-cover" />
                        ) : null}
                      </span>
                    ) : null}
                    <span className="min-w-0">
                      <Link
                        href={row.editHref}
                        className="block max-w-[260px] truncate font-medium text-ink transition-colors hover:text-brand"
                      >
                        {row.title}
                      </Link>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <span className="block max-w-[200px] truncate font-mono text-2xs text-faint">{row.slug}</span>
                        {row.badges}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted">{row.meta ?? '—'}</td>
                <td className="px-4 py-3 text-2xs text-muted">{row.stat ?? '—'}</td>
                <td className="px-4 py-3">
                  <StatusPill status={row.status} />
                </td>
                <td className="px-4 py-3 text-2xs text-faint">{row.updatedAt ? timeAgo(row.updatedAt) : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    {row.viewHref ? (
                      <Link
                        href={row.viewHref}
                        target="_blank"
                        aria-label={`View ${row.title}`}
                        className="rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-brand"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                    <Link
                      href={row.editHref}
                      aria-label={`Edit ${row.title}`}
                      className="rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-brand"
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
  );
}

/** Search + status filter bar shared by the managers. */
export function ContentFilters({
  action,
  q,
  status,
  extra,
}: {
  action: string;
  q?: string;
  status?: string;
  extra?: ReactNode;
}) {
  return (
    <form method="get" action={action} className="card flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-[200px] flex-1">
        <label htmlFor="q" className="label">
          Search
        </label>
        <input id="q" name="q" defaultValue={q} placeholder="Title or slug" className="input" />
      </div>
      <div>
        <label htmlFor="status" className="label">
          Status
        </label>
        <select id="status" name="status" defaultValue={status ?? ''} className="input w-auto">
          <option value="">All</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      {extra}
      <button type="submit" className="btn-secondary btn">
        Apply
      </button>
    </form>
  );
}
