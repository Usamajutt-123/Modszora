'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Cloud, Download, ExternalLink, HardDriveDownload, Loader2 } from 'lucide-react';
import { formatBytes, type DownloadLink } from '@modverse/shared';
import { cn } from '@/lib/utils';

interface Props {
  slug: string;
  gameName: string;
  links: DownloadLink[];
  seconds?: number;
  preferMirror?: boolean;
}

const ICONS: Record<string, typeof Download> = {
  mega: Cloud,
  mirror: HardDriveDownload,
  direct: Download,
  playstore: ExternalLink,
  original: ExternalLink,
  multcloud: Cloud,
};

/**
 * Countdown gate before revealing download links.
 * Also fires a single analytics beacon per download click.
 */
export function DownloadCountdown({ slug, gameName, links, seconds = 10, preferMirror = false }: Props) {
  const [remaining, setRemaining] = useState(seconds);
  const [ready, setReady] = useState(seconds <= 0);
  const counted = useRef(false);

  useEffect(() => {
    if (ready) return;
    const timer = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(timer);
          setReady(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [ready]);

  function trackDownload(kind: string) {
    if (counted.current) return;
    counted.current = true;
    const payload = JSON.stringify({ kind: 'download', slug, meta: { link: kind } });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics', new Blob([payload], { type: 'application/json' }));
      } else {
        void fetch('/api/analytics', { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' }, keepalive: true });
      }
    } catch {
      /* analytics is best-effort */
    }
  }

  const ordered = [...links].sort((a, b) => {
    if (preferMirror) {
      if (a.kind === 'mirror' && b.kind !== 'mirror') return -1;
      if (b.kind === 'mirror' && a.kind !== 'mirror') return 1;
    }
    return Number(b.isPrimary) - Number(a.isPrimary);
  });

  const progress = seconds > 0 ? ((seconds - remaining) / seconds) * 100 : 100;

  return (
    <div className="card-gradient">
      <div className="p-6 md:p-8">
        {!ready ? (
          <div className="flex flex-col items-center text-center">
            {/* circular progress */}
            <div className="relative grid h-28 w-28 place-items-center">
              <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgb(var(--mv-line))" strokeWidth="6" />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="rgb(var(--mv-brand))"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 44}
                  animate={{ strokeDashoffset: 2 * Math.PI * 44 * (1 - progress / 100) }}
                  transition={{ duration: 1, ease: 'linear' }}
                />
              </svg>
              <span className="font-display text-4xl font-extrabold text-ink" aria-live="polite" aria-atomic="true">
                {remaining}
              </span>
            </div>

            <h2 className="mt-5 font-display text-xl font-bold">Preparing your download…</h2>
            <p className="mt-1.5 max-w-md text-sm text-muted">
              We&apos;re verifying the {gameName} package integrity. Your links unlock in {remaining} second
              {remaining === 1 ? '' : 's'}.
            </p>
            <Loader2 className="mt-4 h-4 w-4 animate-spin text-brand" />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="mb-5 flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              <div>
                <h2 className="font-display text-lg font-bold">Your download is ready</h2>
                <p className="text-xs text-muted">Choose a server below. Mega is fastest for most regions.</p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {ordered.map((link) => {
                const Icon = ICONS[link.kind] ?? Download;
                const isPrimary = link.isPrimary || (preferMirror && link.kind === 'mirror');
                return (
                  <a
                    key={`${link.kind}-${link.url}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    onClick={() => trackDownload(link.kind)}
                    className={cn(
                      'group flex items-center gap-3.5 rounded-xl border px-4 py-3.5 transition-all duration-200',
                      isPrimary
                        ? 'border-brand/50 bg-grad-brand text-white shadow-glow hover:brightness-110'
                        : 'border-line bg-surface-2 text-ink hover:border-brand/50 hover:bg-elevated',
                    )}
                  >
                    <Icon className={cn('h-5 w-5 shrink-0', isPrimary ? 'text-white' : 'text-brand')} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{link.label}</span>
                      <span className={cn('block text-2xs', isPrimary ? 'text-white/75' : 'text-faint')}>
                        {link.sizeBytes ? formatBytes(link.sizeBytes) : 'External link'}
                        {link.kind === 'mega' ? ' · Mega.nz' : ''}
                      </span>
                    </span>
                    <Download
                      className={cn(
                        'h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-y-0.5',
                        isPrimary ? 'text-white' : 'text-faint',
                      )}
                    />
                  </a>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
