'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { FaqItem } from '@modverse/shared';
import { cn } from '@/lib/utils';

/**
 * Accessible FAQ accordion.
 * Renders real <button aria-expanded> + region semantics so screen readers
 * and Google's FAQ rich result parser both see the content.
 */
export function FaqAccordion({ items, className }: { items: FaqItem[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(0);

  if (!items.length) return null;

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.question}
            className={cn(
              'overflow-hidden rounded-2xl border bg-surface transition-colors duration-200',
              isOpen ? 'border-brand/40' : 'border-line/70 hover:border-line',
            )}
          >
            <h3>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${i}`}
                id={`faq-button-${i}`}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className={cn('text-sm font-semibold transition-colors md:text-base', isOpen ? 'text-brand' : 'text-ink')}>
                  {item.question}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-faint transition-transform duration-300',
                    isOpen && 'rotate-180 text-brand',
                  )}
                />
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  key="panel"
                  id={`faq-panel-${i}`}
                  role="region"
                  aria-labelledby={`faq-button-${i}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-4 text-sm leading-relaxed text-muted">{item.answer}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
