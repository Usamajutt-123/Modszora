'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

type AdFormat = 'leaderboard' | 'rectangle' | 'sidebar' | 'in-article';

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
};

function AdsterraRectangle() {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!adRef.current) return;

    const container = adRef.current;

    // Prevent loading the same ad twice in the same container
    if (container.dataset.loaded === 'true') return;

    container.dataset.loaded = 'true';

    const script = document.createElement('script');

    const optionsScript = document.createElement('script');
    optionsScript.text = `
      atOptions = {
        'key': 'f08044fc17571bc2bed6a2dd84ddbf11',
        'format': 'iframe',
        'height': 250,
        'width': 300,
        'params': {}
      };
    `;

    script.src =
      'https://www.highperformanceformat.com/f08044fc17571bc2bed6a2dd84ddbf11/invoke.js';

    script.async = true;

    container.appendChild(optionsScript);
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
      delete container.dataset.loaded;
    };
  }, []);

  return (
    <div
      ref={adRef}
      className="flex min-h-[250px] w-full items-center justify-center overflow-hidden"
      aria-label="Advertisement"
    />
  );
}

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
  const size = SIZES[format];

  // Adsterra 300x250
  if (format === 'rectangle') {
    return (
      <div
        className={cn('w-full overflow-hidden', size.className, className)}
        aria-label={label}
      >
        <AdsterraRectangle />
      </div>
    );
  }

  // Other formats remain placeholders for now
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