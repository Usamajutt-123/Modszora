'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ADSTERRA_NATIVE_DOMAIN,
  ADSTERRA_NATIVE_KEY,
  hasAdsterraNative,
} from '@/lib/ads';

interface NativeAdProps {
  className?: string;
  label?: string;
}

/**
 * Adsterra Native Banner.
 *
 * Native Banner is a different product with a different contract: its loader
 * finds a container in the parent document by id and injects into it, so it
 * CANNOT be iframed. That is safe here because Native Banner does not use
 * `atOptions` and therefore cannot collide with the banner units.
 *
 * Only one native unit per page (two identical container ids would be
 * ambiguous).
 */
export function NativeAd({ className, label = 'Sponsored' }: NativeAdProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const injectedRef = useRef(false);
  const [visible, setVisible] = useState(false);

  // Lazy mount: only inject the loader once the unit is near the viewport.
  // `disconnect()` after the first intersection so the ad is never unmounted
  // and re-counted while scrolling. If IntersectionObserver is undefined,
  // render immediately.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

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
  }, []);

  // Inject the loader into the parent document once. reactStrictMode
  // double-invokes effects in development; the ref guard (plus the check
  // that the container has no children yet) prevents a double injection.
  useEffect(() => {
    if (!visible || !hasAdsterraNative()) return;
    if (injectedRef.current) return;

    const container = containerRef.current;
    if (!container || container.childElementCount > 0) return;

    injectedRef.current = true;

    const s = document.createElement('script');
    s.async = true;
    s.setAttribute('data-cfasync', 'false');
    s.src = `//${ADSTERRA_NATIVE_DOMAIN}/${ADSTERRA_NATIVE_KEY}/invoke.js`;
    document.body.appendChild(s);
  }, [visible]);

  if (!hasAdsterraNative()) {
    return (
      <div
        role="complementary"
        aria-label={label}
        className={cn(
          'grid w-full place-items-center rounded-xl border border-dashed border-line/80 bg-surface-2/40 min-h-[200px]',
          className,
        )}
      >
        <div className="text-center">
          <p className="text-2xs font-semibold uppercase tracking-widest text-faint">{label}</p>

          <p className="mt-0.5 text-2xs text-faint/70">Sponsored / Native</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-full', !visible && 'min-h-[200px]', className)}>
      <div ref={containerRef} id={`container-${ADSTERRA_NATIVE_KEY}`} className="min-h-[200px] w-full" />
    </div>
  );
}
