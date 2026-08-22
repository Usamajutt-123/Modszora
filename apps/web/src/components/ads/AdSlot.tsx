'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AD_SIZES,
  ADSTERRA_DOMAIN,
  ADSTERRA_KEY_MOBILE,
  ADSENSE_CLIENT,
  MOBILE_BANNER,
  adsterraKey,
  bannerDocument,
  hasAdsterraBanner,
  type AdFormat,
  type AdSize,
} from '@/lib/ads';

interface AdSlotProps {
  format?: AdFormat;
  slot?: string;
  className?: string;
  label?: string;
}

/**
 * One Adsterra banner rendered inside its own `<iframe srcDoc=…>`.
 *
 * Every Adsterra banner snippet assigns to the same global `atOptions`
 * variable, so two banners in the same document would overwrite each other
 * and only the last one would render. Each iframe has its own window, so
 * every placement gets an isolated `atOptions` and all of them load at once.
 */
function AdsterraBanner({
  format,
  size,
  label,
}: {
  format: AdFormat | 'mobile';
  size: AdSize;
  label: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Lazy mount: only load the ad once it is near the viewport. Adsterra pays
  // per impression, so ads far below the fold must not load on page open.
  // `disconnect()` after the first intersection so the ad is never unmounted
  // and re-counted while scrolling.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || visible) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' },
    );

    io.observe(root);
    return () => io.disconnect();
  }, [visible]);

  const key = adsterraKey(format);
  const domain = ADSTERRA_DOMAIN;

  return (
    <div
      ref={rootRef}
      className={cn('flex w-full items-center justify-center', !visible && size.className)}
    >
      {visible && key && domain ? (
        <iframe
          title={label}
          srcDoc={bannerDocument(key, domain, size)}
          width={size.width}
          height={size.height}
          scrolling="no"
          loading="lazy"
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin"
          referrerPolicy="no-referrer-when-downgrade"
          className="max-w-full"
          style={{ border: 0, display: 'block', maxWidth: '100%' }}
        />
      ) : null}
    </div>
  );
}

export function AdSlot({
  format = 'leaderboard',
  slot,
  className,
  label = 'Advertisement',
}: AdSlotProps) {
  const size = AD_SIZES[format];

  /*
   * 1. Adsterra — primary network.
   */
  if (hasAdsterraBanner(format)) {
    return (
      <div
        className={cn(
          'flex w-full max-w-full items-center justify-center overflow-hidden',
          size.className,
          className,
        )}
        aria-label={label}
      >
        {format === 'leaderboard' && ADSTERRA_KEY_MOBILE ? (
          <>
            <div className="hidden md:flex">
              <AdsterraBanner format="leaderboard" size={size} label={label} />
            </div>
            <div className="md:hidden">
              <AdsterraBanner format="mobile" size={MOBILE_BANNER} label={label} />
            </div>
          </>
        ) : (
          <AdsterraBanner format={format} size={size} label={label} />
        )}
      </div>
    );
  }

  /*
   * 2. AdSense — legacy fallback, only when the client id AND a slot are
   *    both present.
   */
  if (ADSENSE_CLIENT && slot) {
    return (
      <div
        className={cn('flex w-full items-center justify-center overflow-hidden', className)}
        aria-label={label}
      >
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  /*
   * 3. Placeholder — the dashed box shown whenever no ad network is
   *    configured (the default state).
   */
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
