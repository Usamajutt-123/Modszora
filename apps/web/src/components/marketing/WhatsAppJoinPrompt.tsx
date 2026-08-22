'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * WhatsAppJoinPrompt
 *
 * Small floating notification (bottom corner) inviting visitors to the
 * MODSzora WhatsApp channel. Shows once per visitor:
 *  - "Join"  → opens the channel and never nags again
 *  - "Ignore" → hides for REMIND_AFTER_DAYS, then gently re-asks
 *
 * Rendered from the (site) route-group layout only, so it never appears
 * inside /admin. Purely client-side — no layout shift, no hydration flash.
 */

const CHANNEL_URL = 'https://whatsapp.com/channel/0029Vacaj86Jf05WDiSVGo15';
const STORAGE_KEY = 'modszora:wa-join-prompt';
const SHOW_DELAY_MS = 2400;
const REMIND_AFTER_DAYS = 7;

type Stored = { status: 'joined' | 'ignored'; at: number };

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
    </svg>
  );
}

function readStored(): Stored | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function writeStored(status: Stored['status']) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ status, at: Date.now() } satisfies Stored));
  } catch {
    /* private mode etc. — popup simply won't persist */
  }
}

/** "joined" → never again. "ignored" → again after REMIND_AFTER_DAYS. */
function shouldShow(): boolean {
  const stored = readStored();
  if (!stored) return true;
  if (stored.status === 'joined') return false;
  return Date.now() - stored.at > REMIND_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

export function WhatsAppJoinPrompt() {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  // Decide + gently slide in after a short delay (client only).
  useEffect(() => {
    if (!shouldShow()) return;
    const t = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  const dismiss = useCallback((status: Stored['status']) => {
    writeStored(status);
    setOpen(false);
  }, []);

  // Escape behaves like Ignore.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss('ignored');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismiss]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="false"
          aria-labelledby="wa-prompt-title"
          aria-describedby="wa-prompt-desc"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.96 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className={cn(
            // responsive: full-width card on phones, floating card bottom-right on sm+
            'fixed z-[60] inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[22rem] sm:max-w-[calc(100vw-2rem)]',
          )}
        >
          <div className="glass-strong relative overflow-hidden rounded-2xl p-4">
            {/* WhatsApp-green top edge */}
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#25d366] via-[#25d366]/50 to-transparent" aria-hidden="true" />

            <button
              type="button"
              onClick={() => dismiss('ignored')}
              aria-label="Ignore — close notification"
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3">
              <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#25d366]/15 ring-1 ring-[#25d366]/30">
                <WhatsAppIcon className="h-5 w-5 text-[#158646] dark:text-[#25d366]" />
                <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25d366] opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#25d366] ring-2 ring-surface" />
                </span>
              </span>

              <div className="min-w-0 pr-5">
                <p id="wa-prompt-title" className="text-sm font-bold text-ink">
                  Get MODs first on WhatsApp
                </p>
                <p id="wa-prompt-desc" className="mt-1 text-xs leading-relaxed text-muted">
                  New MOD drops, version bumps &amp; premium APKs — posted on the MODSzora channel
                  before they go live. Free, no spam.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a
                    href={CHANNEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => dismiss('joined')}
                    className="btn btn-sm bg-[#25d366] text-white hover:brightness-105"
                  >
                    <WhatsAppIcon className="h-3.5 w-3.5" />
                    Join Channel
                  </a>
                  <button type="button" onClick={() => dismiss('ignored')} className="btn btn-ghost btn-sm">
                    Ignore
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
