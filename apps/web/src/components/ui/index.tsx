import Link from 'next/link';
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { ChevronRight, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ═══════════════════════════ Section ═══════════════════════════ */

export function Section({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn('section', className)}>
      {children}
    </section>
  );
}

export function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel = 'View all',
  icon,
  className,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-6 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="section-title flex items-center gap-2.5">
          {icon ? <span className="text-brand shrink-0">{icon}</span> : null}
          <span className="truncate">{title}</span>
        </h2>
        {subtitle ? <p className="mt-1.5 text-sm text-muted line-clamp-2">{subtitle}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="group hidden shrink-0 items-center gap-1 text-sm font-semibold text-brand transition-colors hover:text-accent sm:inline-flex"
        >
          {linkLabel}
          <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════ Badge ═══════════════════════════ */

type BadgeTone = 'mod' | 'new' | 'hot' | 'premium' | 'neutral' | 'success';

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  const tones: Record<BadgeTone, string> = {
    mod: 'bg-accent/15 text-accent border-accent/30',
    new: 'bg-success/15 text-success border-success/30',
    hot: 'bg-danger/15 text-danger border-danger/30',
    premium: 'bg-warning/15 text-warning border-warning/30',
    success: 'bg-success/15 text-success border-success/30',
    neutral: 'bg-surface-2 text-muted border-line',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-2xs font-bold uppercase tracking-wide',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ═══════════════════════════ Rating ═══════════════════════════ */

export function RatingStars({
  rating,
  size = 'sm',
  showValue = true,
  count,
  className,
}: {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  count?: number;
  className?: string;
}) {
  const sizes = { sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-5 w-5' };
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));

  return (
    <div className={cn('flex items-center gap-1.5', className)} title={`${rating.toFixed(1)} out of 5`}>
      <div className="relative inline-flex" aria-hidden="true">
        <div className="flex gap-0.5 text-line">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className={cn(sizes[size], 'fill-current')} />
          ))}
        </div>
        <div className="absolute inset-0 flex gap-0.5 overflow-hidden text-warning" style={{ width: `${pct}%` }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className={cn(sizes[size], 'shrink-0 fill-current')} />
          ))}
        </div>
      </div>
      {showValue ? (
        <span className={cn('font-semibold text-ink', size === 'sm' ? 'text-xs' : 'text-sm')}>{rating.toFixed(1)}</span>
      ) : null}
      {count !== undefined ? <span className="text-2xs text-faint">({count.toLocaleString()})</span> : null}
      <span className="sr-only">
        Rated {rating.toFixed(1)} out of 5{count !== undefined ? ` from ${count} ratings` : ''}
      </span>
    </div>
  );
}

/* ═══════════════════════════ Chip ═══════════════════════════ */

export function Chip({
  children,
  active,
  href,
  onClick,
  className,
}: {
  children: ReactNode;
  active?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const classes = cn('chip', active && 'chip-active', (href || onClick) && 'hover:border-brand/50 hover:text-ink', className);
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      {children}
    </button>
  );
}

/* ═══════════════════════════ Empty state ═══════════════════════════ */

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/50 px-6 py-16 text-center">
      {icon ? <div className="mb-4 text-faint">{icon}</div> : null}
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1.5 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ═══════════════════════════ Stat ═══════════════════════════ */

export function Stat({
  label,
  value,
  icon,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('card p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-semibold uppercase tracking-wide text-faint">{label}</span>
        {icon ? <span className="text-brand">{icon}</span> : null}
      </div>
      <div className="mt-2 font-display text-2xl font-bold text-ink">{value}</div>
      {hint ? <p className="mt-1 text-2xs text-faint">{hint}</p> : null}
    </div>
  );
}

/* ═══════════════════════════ Spec row ═══════════════════════════ */

export function SpecRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/60 py-2.5 last:border-0">
      <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-faint">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

/* ═══════════════════════════ Skeleton ═══════════════════════════ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

export function GameCardSkeleton() {
  return (
    <div className="card overflow-hidden p-3">
      <Skeleton className="aspect-icon w-full rounded-xl" />
      <Skeleton className="mt-3 h-3.5 w-4/5" />
      <Skeleton className="mt-2 h-3 w-2/5" />
    </div>
  );
}

/* ═══════════════════════════ Prose ═══════════════════════════ */

export function Prose({ html, className }: { html: string; className?: string }) {
  return <div className={cn('prose-modverse', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ═══════════════════════════ Polymorphic surface ═══════════════════════════ */

type SurfaceProps<T extends ElementType> = {
  as?: T;
  glass?: boolean;
  gradient?: boolean;
  hover?: boolean;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>;

export function Surface<T extends ElementType = 'div'>({
  as,
  glass,
  gradient,
  hover,
  className,
  children,
  ...rest
}: SurfaceProps<T>) {
  const Tag = (as ?? 'div') as ElementType;
  if (gradient) {
    return (
      <div className={cn('card-gradient', hover && 'transition-transform duration-300 hover:-translate-y-1', className)}>
        <Tag {...rest} className="block h-full w-full rounded-[calc(1rem-1px)] bg-surface">
          {children}
        </Tag>
      </div>
    );
  }
  return (
    <Tag {...rest} className={cn(glass ? 'glass rounded-2xl' : 'card', hover && 'card-hover', className)}>
      {children}
    </Tag>
  );
}
