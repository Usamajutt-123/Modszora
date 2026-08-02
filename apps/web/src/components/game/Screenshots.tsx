'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { MediaAsset } from '@modverse/shared';

/** Screenshot strip with an accessible lightbox (arrow keys + Escape). */
export function Screenshots({ items, gameName }: { items: MediaAsset[]; gameName: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const isOpen = index !== null;

  const close = useCallback(() => setIndex(null), []);
  const next = useCallback(() => setIndex((i) => (i === null ? null : (i + 1) % items.length)), [items.length]);
  const prev = useCallback(() => setIndex((i) => (i === null ? null : (i - 1 + items.length) % items.length)), [items.length]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, close, next, prev]);

  if (!items.length) return null;
  const active = index !== null ? items[index] : null;

  return (
    <>
      <div className="scrollbar-none mask-fade-r -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {items.map((shot, i) => (
          <button
            key={shot.url}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`View screenshot ${i + 1} of ${items.length}`}
            className="group relative aspect-shot w-[150px] shrink-0 snap-start overflow-hidden rounded-xl border border-line/70 bg-surface-2 transition-all duration-300 hover:border-brand/50 hover:shadow-glow sm:w-[168px]"
          >
            <Image
              src={shot.url}
              alt={shot.alt ?? `${gameName} screenshot ${i + 1}`}
              fill
              sizes="168px"
              loading={i < 3 ? 'eager' : 'lazy'}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      <AnimatePresence>
        {isOpen && active ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={`${gameName} screenshot viewer`}
            className="fixed inset-0 z-[90] grid place-items-center bg-black/92 p-4 backdrop-blur-md"
            onClick={close}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close viewer"
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>

            {items.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prev();
                  }}
                  aria-label="Previous screenshot"
                  className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 md:left-8"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    next();
                  }}
                  aria-label="Next screenshot"
                  className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 md:right-8"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            ) : null}

            <motion.div
              key={active.url}
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.22 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[85vh] w-auto"
              style={{ aspectRatio: `${active.width ?? 9} / ${active.height ?? 16}` }}
            >
              <Image
                src={active.url}
                alt={active.alt ?? `${gameName} screenshot`}
                width={active.width ?? 1080}
                height={active.height ?? 1920}
                className="max-h-[85vh] w-auto rounded-xl object-contain"
                priority
              />
            </motion.div>

            <p className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
              {(index ?? 0) + 1} / {items.length}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
