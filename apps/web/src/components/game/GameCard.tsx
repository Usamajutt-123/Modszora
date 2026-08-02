import Image from 'next/image';
import Link from 'next/link';
import { Download, Shield, Sparkles } from 'lucide-react';
import type { GameRecord } from '@modverse/shared';
import { formatBytes, formatCompactNumber } from '@modverse/shared';
import { Badge, RatingStars } from '@/components/ui';
import { cn } from '@/lib/utils';

interface GameCardProps {
  game: GameRecord;
  priority?: boolean;
  variant?: 'grid' | 'row' | 'compact';
  index?: number;
  className?: string;
}

/**
 * The canonical game card. Server component (zero JS) — hover/focus
 * effects are pure CSS so lists of 60 cards cost nothing at runtime.
 */
export function GameCard({ game, priority = false, variant = 'grid', index = 0, className }: GameCardProps) {
  const href = `/game/${game.slug}`;
  const iconUrl = game.icon?.url;
  const isNew = game.collections.includes('latest') || game.collections.includes('recently-updated');
  const isPremium = game.collections.includes('premium');
  const isModMenu = game.collections.includes('mod-menu');

  /* ── compact: used in sidebars / related rails ── */
  if (variant === 'compact') {
    return (
      <Link
        href={href}
        className={cn(
          'group flex items-center gap-3 rounded-xl p-2 transition-colors duration-200 hover:bg-surface-2',
          className,
        )}
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line/70">
          {iconUrl ? (
            <Image
              src={iconUrl}
              alt=""
              fill
              sizes="48px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink transition-colors group-hover:text-brand">{game.name}</p>
          <p className="truncate text-2xs text-faint">
            v{game.version} · {formatBytes(game.sizeBytes)}
          </p>
        </div>
        <RatingStars rating={game.rating} size="sm" showValue={false} className="shrink-0" />
      </Link>
    );
  }

  /* ── row: used in search results / list views ── */
  if (variant === 'row') {
    return (
      <Link
        href={href}
        className={cn('card card-hover group flex items-center gap-4 p-3 sm:p-4', className)}
      >
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line/70 sm:h-20 sm:w-20">
          {iconUrl ? (
            <Image
              src={iconUrl}
              alt={`${game.name} icon`}
              fill
              sizes="80px"
              loading={priority ? 'eager' : 'lazy'}
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate font-display text-base font-bold text-ink transition-colors group-hover:text-brand">
              {game.name}
            </h3>
            {isModMenu ? <Badge tone="mod">Mod Menu</Badge> : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-faint">{game.developer}</p>
          <p className="mt-1.5 line-clamp-2 text-xs text-muted sm:text-sm">{game.shortDescription}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-faint">
            <RatingStars rating={game.rating} size="sm" />
            <span className="inline-flex items-center gap-1">
              <Download className="h-3 w-3" />
              {formatCompactNumber(game.downloads)}
            </span>
            <span>{formatBytes(game.sizeBytes)}</span>
            <span className="hidden xs:inline">v{game.version}</span>
          </div>
        </div>
        <span className="hidden shrink-0 self-center rounded-xl bg-grad-brand px-4 py-2 text-xs font-bold text-white shadow-glow transition-transform duration-200 group-hover:scale-105 sm:inline-block">
          Get
        </span>
      </Link>
    );
  }

  /* ── grid: the default card ── */
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-line/70 bg-surface',
        'shadow-card transition-all duration-300 ease-premium',
        'hover:-translate-y-1.5 hover:border-brand/45 hover:shadow-glow',
        'focus-visible:-translate-y-1.5 focus-visible:border-brand/45',
        className,
      )}
    >
      {/* icon */}
      <div className="relative aspect-icon w-full overflow-hidden bg-surface-2">
        {iconUrl ? (
          <Image
            src={iconUrl}
            alt={`${game.name} MOD APK icon`}
            fill
            sizes="(max-width:420px) 45vw, (max-width:768px) 30vw, (max-width:1280px) 22vw, 180px"
            priority={priority}
            loading={priority ? 'eager' : 'lazy'}
            className="object-cover transition-transform duration-500 ease-premium group-hover:scale-110"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-grad-surface text-2xl font-bold text-faint">
            {game.name.charAt(0)}
          </div>
        )}

        {/* gradient scrim for legibility */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* corner badges */}
        <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1">
          {isNew ? <Badge tone="new">New</Badge> : null}
          {isPremium ? (
            <Badge tone="premium">
              <Sparkles className="h-2.5 w-2.5" />
              Premium
            </Badge>
          ) : null}
        </div>

        {game.virusScan?.status === 'clean' ? (
          <div
            className="pointer-events-none absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-success/90 text-white shadow-sm"
            title="Virus scan: clean"
          >
            <Shield className="h-3 w-3" strokeWidth={2.5} />
          </div>
        ) : null}

        {/* hover CTA */}
        <div className="pointer-events-none absolute inset-x-2 bottom-2 translate-y-2 opacity-0 transition-all duration-300 ease-premium group-hover:translate-y-0 group-hover:opacity-100">
          <span className="flex items-center justify-center gap-1.5 rounded-lg bg-grad-brand py-1.5 text-2xs font-bold uppercase tracking-wide text-white shadow-glow">
            <Download className="h-3 w-3" />
            Download
          </span>
        </div>
      </div>

      {/* meta */}
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 min-h-[2.5rem] font-display text-sm font-bold leading-tight text-ink transition-colors duration-200 group-hover:text-brand">
          {game.name}
        </h3>
        <p className="mt-1 truncate text-2xs text-faint">{game.developer}</p>

        <div className="mt-2 flex items-center justify-between gap-2">
          <RatingStars rating={game.rating} size="sm" />
          <span className="shrink-0 text-2xs font-medium text-faint">{formatBytes(game.sizeBytes)}</span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-line/60 pt-2">
          <span className="truncate text-2xs text-faint">v{game.version}</span>
          <span className="inline-flex shrink-0 items-center gap-1 text-2xs font-semibold text-brand">
            <Download className="h-2.5 w-2.5" />
            {formatCompactNumber(game.downloads)}
          </span>
        </div>
      </div>
    </Link>
  );
}
