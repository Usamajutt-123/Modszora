import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import type { Crumb } from '@modverse/shared';
import { cn } from '@/lib/utils';

/** Visual breadcrumbs. JSON-LD is emitted separately by each page. */
export function Breadcrumbs({ crumbs, className }: { crumbs: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="scrollbar-none flex items-center gap-1 overflow-x-auto whitespace-nowrap text-xs text-faint">
        <li className="flex shrink-0 items-center">
          <Link href="/" className="flex items-center gap-1 transition-colors hover:text-brand" aria-label="Home">
            <Home className="h-3 w-3" />
          </Link>
        </li>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={crumb.path} className="flex shrink-0 items-center gap-1">
              <ChevronRight className="h-3 w-3 opacity-50" aria-hidden="true" />
              {isLast ? (
                <span aria-current="page" className="max-w-[52vw] truncate font-medium text-muted sm:max-w-xs">
                  {crumb.name}
                </span>
              ) : (
                <Link href={crumb.path} className="transition-colors hover:text-brand">
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
