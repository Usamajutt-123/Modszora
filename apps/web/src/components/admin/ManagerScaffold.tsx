import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight, Info } from 'lucide-react';

/**
 * Shared shell for content managers.
 * Renders the live counts plus the actions available for that content type.
 */
export function ManagerScaffold({
  title,
  description,
  count,
  countLabel,
  publicHref,
  publicLabel,
  actions,
  children,
  note,
}: {
  title: string;
  description: string;
  count: number;
  countLabel: string;
  publicHref: string;
  publicLabel: string;
  actions?: ReactNode;
  children?: ReactNode;
  note?: string;
}) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <div className="flex gap-2">
          <Link href={publicHref} target="_blank" className="btn-secondary btn-sm btn">
            {publicLabel}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          {actions}
        </div>
      </header>

      <div className="card p-5">
        <p className="text-2xs font-bold uppercase tracking-wider text-faint">{countLabel}</p>
        <p className="mt-1 font-display text-3xl font-extrabold text-ink">{count}</p>
      </div>

      {children}

      {note ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-brand/25 bg-brand/[0.06] p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <p className="text-xs leading-relaxed text-muted">{note}</p>
        </div>
      ) : null}
    </div>
  );
}
