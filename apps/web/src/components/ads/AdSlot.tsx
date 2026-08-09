'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

type AdFormat =
  | 'leaderboard'
  | 'rectangle'
  | 'sidebar'
  | 'in-article'
  | 'mobile';

const SIZES: Record<AdFormat, { className: string; label: string }> = {
  leaderboard: {
    className: 'min-h-[90px]',
    label: '728 × 90',
  },
  rectangle: {
    className: 'min-h-[250px]',
    label: '300 × 250',
  },
  sidebar: {
    className: 'min-h-[600px]',
    label: '300 × 600',
  },
  'in-article': {
    className: 'min-h-[180px]',
    label: 'Responsive',
  },
  mobile: {
    className: 'min-h-[50px]',
    label: '320 × 50',
  },
};

const AD_CONFIG = {
  rectangle: {
    key: 'f08044fc17571bc2bed6a2dd84ddbf11',
    width: 300,
    height: 250,
  },
  mobile: {
    key: '8cff3f0cffd3c0071b4d093e6a55e462',
    width: 320,
    height: 50,
  },
} as const;

function AdsterraAd({
  format,
}: {
  format: 'rectangle' | 'mobile';
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || container.dataset.loaded === 'true') {
      return;
    }

    const config = AD_CONFIG[format];

    container.dataset.loaded = 'true';

    const optionsScript = document.createElement('script');

    optionsScript.text = `
      atOptions = {
        'key': '${config.key}',
        'format': 'iframe',
        'height': ${config.height},
        'width': ${config.width},
        'params': {}
      };
    `;

    const adScript = document.createElement('script');

    adScript.src = `https://www.highperformanceformat.com/${config.key}/invoke.js`;
    adScript.async = true;

    container.appendChild(optionsScript);
    container.appendChild(adScript);

    return () => {
      container.innerHTML = '';
      delete container.dataset.loaded;
    };
  }, [format]);

  const config = AD_CONFIG[format];

  return (
    <div
      ref={containerRef}
      className="flex w-full items-center justify-center overflow-hidden"
      style={{
        minHeight: `${config.height}px`,
      }}
      aria-label="Advertisement"
    />
  );
}

export function AdSlot({
  format = 'leaderboard',
  className,
  label = 'Advertisement',
}: {
  format?: AdFormat;
  slot?: string;
  className?: string;
  label?: string;
}) {
  const size = SIZES[format];

  /*
   * 300 × 250 Adsterra rectangle
   */
  if (format === 'rectangle') {
    return (
      <div
        className={cn(
          'flex w-full items-center justify-center overflow-hidden',
          size.className,
          className,
        )}
        aria-label={label}
      >
        <AdsterraAd format="rectangle" />
      </div>
    );
  }

  /*
   * 320 × 50 Adsterra mobile banner
   */
  if (format === 'mobile') {
    return (
      <div
        className={cn(
          'flex w-full items-center justify-center overflow-hidden',
          size.className,
          className,
        )}
        aria-label={label}
      >
        <div className="block md:hidden">
          <AdsterraAd format="mobile" />
        </div>
      </div>
    );
  }

  /*
   * Other formats stay as placeholders
   * until their Adsterra codes are added.
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
        <p className="text-2xs font-semibold uppercase tracking-widest text-faint">
          {label}
        </p>

        <p className="mt-0.5 text-2xs text-faint/70">
          {size.label}
        </p>
      </div>
    </div>
  );
}