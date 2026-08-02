import { cn } from '@/lib/utils';

type AdFormat = 'leaderboard' | 'rectangle' | 'sidebar' | 'in-article';

const SIZES: Record<AdFormat, { className: string; label: string }> = {
  leaderboard: { className: 'min-h-[90px] md:min-h-[90px]', label: '728 × 90' },
  rectangle: { className: 'min-h-[250px]', label: '300 × 250' },
  sidebar: { className: 'min-h-[600px]', label: '300 × 600' },
  'in-article': { className: 'min-h-[180px]', label: 'Responsive' },
};

/**
 * Ad placeholder with a reserved box so ads never cause layout shift (CLS).
 * When NEXT_PUBLIC_ADSENSE_CLIENT is set, swap the inner content for the
 * real <ins class="adsbygoogle"> element — the wrapper keeps the same size.
 */
export function AdSlot({
  format = 'leaderboard',
  slot,
  className,
  label = 'Advertisement',
}: {
  format?: AdFormat;
  slot?: string;
  className?: string;
  label?: string;
}) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const size = SIZES[format];

  if (client && slot) {
    return (
      <div className={cn('w-full overflow-hidden', size.className, className)} aria-label={label}>
        <ins
          className="adsbygoogle block"
          style={{ display: 'block' }}
          data-ad-client={client}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  return (
    <div
      role="complementary"
      aria-label={label}
      className={cn(
        'grid w-full place-items-center rounded-xl border border-dashed border-line/80 bg-surface-2/40',
        size.className,
        className,
      )}
    >
      <div className="text-center">
        <p className="text-2xs font-semibold uppercase tracking-widest text-faint">{label}</p>
        <p className="mt-0.5 text-2xs text-faint/70">{size.label}</p>
      </div>
    </div>
  );
}
