'use client';

import { useId, useMemo, useState } from 'react';
import { formatBytes, formatCompactNumber } from '@modverse/shared';
import { cn } from '@/lib/utils';

/**
 * Lightweight SVG charts.
 *
 * Deliberately dependency-free: a charting library would add 40–100 kB to the
 * admin bundle for three chart types. These use CSS custom properties, so
 * they follow the light/dark theme automatically, and they animate in with
 * pure CSS rather than JavaScript.
 */

/* ═══════════════════════ area chart ═══════════════════════ */

export interface SeriesPoint {
  date: string;
  views: number;
  downloads: number;
}

export function TrafficChart({ data, className }: { data: SeriesPoint[]; className?: string }) {
  const gradId = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);

  const { paths, max, points } = useMemo(() => {
    if (!data.length) return { paths: { views: '', downloads: '' }, max: 0, points: [] as Array<{ x: number; yV: number; yD: number }> };

    const maxValue = Math.max(...data.flatMap((d) => [d.views, d.downloads]), 1);
    const w = 100;
    const h = 100;

    const pts = data.map((d, i) => ({
      x: data.length === 1 ? w / 2 : (i / (data.length - 1)) * w,
      yV: h - (d.views / maxValue) * h,
      yD: h - (d.downloads / maxValue) * h,
    }));

    // Catmull-Rom style smoothing keeps the line readable without overshoot.
    const line = (key: 'yV' | 'yD') =>
      pts
        .map((p, i) => {
          if (i === 0) return `M ${p.x} ${p[key]}`;
          const prev = pts[i - 1]!;
          const cx = (prev.x + p.x) / 2;
          return `C ${cx} ${prev[key]}, ${cx} ${p[key]}, ${p.x} ${p[key]}`;
        })
        .join(' ');

    return {
      paths: { views: line('yV'), downloads: line('yD') },
      max: maxValue,
      points: pts,
    };
  }, [data]);

  if (!data.length) {
    return (
      <div className={cn('grid h-48 place-items-center rounded-xl border border-dashed border-line', className)}>
        <p className="text-sm text-muted">No traffic data yet.</p>
      </div>
    );
  }

  const active = hover !== null ? data[hover] : null;

  return (
    <div className={cn('relative', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-2xs font-medium text-muted">
            <span className="h-2 w-2 rounded-full bg-brand" />
            Views
          </span>
          <span className="flex items-center gap-1.5 text-2xs font-medium text-muted">
            <span className="h-2 w-2 rounded-full bg-accent" />
            Downloads
          </span>
        </div>
        {active ? (
          <div className="text-2xs tabular-nums text-ink">
            <span className="text-faint">{active.date}</span>
            <span className="ml-2 font-semibold text-brand">{formatCompactNumber(active.views)}</span>
            <span className="ml-2 font-semibold text-accent">{formatCompactNumber(active.downloads)}</span>
          </div>
        ) : (
          <span className="text-2xs text-faint">peak {formatCompactNumber(max)}</span>
        )}
      </div>

      <div className="relative h-44">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          role="img"
          aria-label={`Traffic over ${data.length} days. Peak ${max} events.`}
        >
          <defs>
            <linearGradient id={`fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--mv-brand))" stopOpacity="0.35" />
              <stop offset="100%" stopColor="rgb(var(--mv-brand))" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* horizontal guides */}
          {[0, 25, 50, 75, 100].map((y) => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgb(var(--mv-line))" strokeWidth="0.3" opacity="0.5" />
          ))}

          <path d={`${paths.views} L 100 100 L 0 100 Z`} fill={`url(#fill-${gradId})`} />
          <path
            d={paths.views}
            fill="none"
            stroke="rgb(var(--mv-brand))"
            strokeWidth="1.4"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
          <path
            d={paths.downloads}
            fill="none"
            stroke="rgb(var(--mv-accent))"
            strokeWidth="1.4"
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />

          {hover !== null && points[hover] ? (
            <>
              <line
                x1={points[hover]!.x}
                y1="0"
                x2={points[hover]!.x}
                y2="100"
                stroke="rgb(var(--mv-brand))"
                strokeWidth="0.4"
                opacity="0.6"
              />
              <circle cx={points[hover]!.x} cy={points[hover]!.yV} r="1.6" fill="rgb(var(--mv-brand))" vectorEffect="non-scaling-stroke" />
              <circle cx={points[hover]!.x} cy={points[hover]!.yD} r="1.6" fill="rgb(var(--mv-accent))" vectorEffect="non-scaling-stroke" />
            </>
          ) : null}
        </svg>

        {/* invisible hover targets */}
        <div className="absolute inset-0 flex" onMouseLeave={() => setHover(null)}>
          {data.map((d, i) => (
            <button
              key={d.date}
              type="button"
              aria-label={`${d.date}: ${d.views} views, ${d.downloads} downloads`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              className="h-full flex-1 cursor-default"
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex justify-between text-2xs text-faint">
        <span>{data[0]?.date.slice(5)}</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════ donut ═══════════════════════ */

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  slices,
  size = 148,
  thickness = 16,
  centerLabel,
  centerValue,
  className,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((slice) => {
      const fraction = total > 0 ? slice.value / total : 0;
      const arc = { ...slice, fraction, dash: fraction * circumference, offset };
      offset += fraction * circumference;
      return arc;
    });

  return (
    <div className={cn('flex flex-wrap items-center gap-5', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`Breakdown of ${total} items`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgb(var(--mv-surface-2))"
            strokeWidth={thickness}
          />
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={thickness}
              strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
              strokeDashoffset={-arc.offset}
              strokeLinecap="butt"
              className="transition-all duration-700 ease-premium"
            />
          ))}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-2xl font-extrabold text-ink">{centerValue ?? total}</p>
            {centerLabel ? <p className="text-2xs text-faint">{centerLabel}</p> : null}
          </div>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="truncate text-muted">{s.label}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">
              {s.value}
              {total > 0 ? <span className="ml-1 text-faint">{Math.round((s.value / total) * 100)}%</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ═══════════════════════ bars ═══════════════════════ */

export function BarList({
  items,
  format = 'compact',
  className,
}: {
  items: Array<{ label: string; value: number; href?: string; meta?: string }>;
  /** Declarative for the same server/client boundary reason as UsageMeter. */
  format?: 'compact' | 'bytes' | 'integer';
  className?: string;
}) {
  const valueFormatter = (n: number) =>
    format === 'bytes' ? formatBytes(n) : format === 'integer' ? String(Math.round(n)) : formatCompactNumber(n);

  const max = Math.max(...items.map((i) => i.value), 1);

  if (!items.length) {
    return <p className={cn('py-8 text-center text-sm text-muted', className)}>Nothing to show yet.</p>;
  }

  return (
    <ul className={cn('space-y-2', className)}>
      {items.map((item, i) => (
        <li key={`${item.label}-${i}`} className="group relative">
          <div className="relative overflow-hidden rounded-lg">
            <div
              className="absolute inset-y-0 left-0 rounded-lg bg-brand/12 transition-all duration-700 ease-premium group-hover:bg-brand/20"
              style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }}
            />
            <div className="relative flex items-center justify-between gap-3 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-4 shrink-0 text-center font-mono text-2xs text-faint">{i + 1}</span>
                {item.href ? (
                  <a href={item.href} target="_blank" rel="noreferrer" className="truncate text-sm text-ink hover:text-brand">
                    {item.label}
                  </a>
                ) : (
                  <span className="truncate text-sm text-ink">{item.label}</span>
                )}
              </span>
              <span className="shrink-0 text-right">
                <span className="text-xs font-semibold tabular-nums text-ink">{valueFormatter(item.value)}</span>
                {item.meta ? <span className="ml-2 text-2xs text-faint">{item.meta}</span> : null}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ═══════════════════════ sparkline ═══════════════════════ */

export function Sparkline({
  values,
  color = 'rgb(var(--mv-brand))',
  className,
}: {
  values: number[];
  color?: string;
  className?: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;

  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 100;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cn('h-8 w-full', className)} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

/* ═══════════════════════ usage meter ═══════════════════════ */

export function UsageMeter({
  label,
  used,
  limit,
  unit = '',
  format = 'compact',
  hint,
}: {
  label: string;
  used: number;
  limit: number;
  unit?: string;
  /**
   * Declarative rather than a callback: this component is rendered from
   * server components, and functions cannot cross that boundary.
   */
  format?: 'compact' | 'bytes' | 'integer';
  hint?: string;
}) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const fmt = (n: number) => {
    if (format === 'bytes') return formatBytes(n);
    if (format === 'integer') return String(Math.round(n));
    return `${formatCompactNumber(n)}${unit}`;
  };
  const tone = pct > 90 ? 'bg-danger' : pct > 70 ? 'bg-warning' : 'bg-grad-brand';

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="font-mono text-2xs tabular-nums text-ink">
          {fmt(used)} <span className="text-faint">/ {fmt(limit)}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-premium', tone)}
          style={{ width: `${Math.max(1.5, pct)}%` }}
        />
      </div>
      {hint ? <p className="mt-1 text-2xs text-faint">{hint}</p> : null}
    </div>
  );
}
