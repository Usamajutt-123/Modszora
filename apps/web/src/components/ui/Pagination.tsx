import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * SEO-friendly pagination: real <a href> links (crawlable) with a compact
 * windowed page list and ellipses.
 */
export function Pagination({
  page,
  totalPages,
  basePath,
  searchParams = {},
  className,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== 'page') sp.set(k, v);
    }
    if (p > 1) sp.set('page', String(p));
    const qs = sp.toString();
    return `${basePath}${qs ? `?${qs}` : ''}`;
  };

  // Window of pages around the current one.
  const pages: Array<number | 'gap'> = [];
  const window = 1;
  for (let p = 1; p <= totalPages; p += 1) {
    if (p === 1 || p === totalPages || (p >= page - window && p <= page + window)) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== 'gap') {
      pages.push('gap');
    }
  }

  const linkClass = 'grid h-9 min-w-9 place-items-center rounded-lg border px-3 text-sm font-medium transition-colors';

  return (
    <nav aria-label="Pagination" className={cn('flex flex-wrap items-center justify-center gap-1.5', className)}>
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" aria-label="Previous page" className={cn(linkClass, 'border-line bg-surface-2 text-muted hover:border-brand/50 hover:text-brand')}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(linkClass, 'cursor-not-allowed border-line/50 bg-surface-2/50 text-faint')}>
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}

      {pages.map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-faint" aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              linkClass,
              p === page
                ? 'border-transparent bg-grad-brand text-white shadow-glow'
                : 'border-line bg-surface-2 text-muted hover:border-brand/50 hover:text-brand',
            )}
          >
            {p}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link href={href(page + 1)} rel="next" aria-label="Next page" className={cn(linkClass, 'border-line bg-surface-2 text-muted hover:border-brand/50 hover:text-brand')}>
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(linkClass, 'cursor-not-allowed border-line/50 bg-surface-2/50 text-faint')}>
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
