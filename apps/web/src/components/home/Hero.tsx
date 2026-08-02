'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Play, Shield, Sparkles, TrendingUp, Zap } from 'lucide-react';
import type { GameRecord } from '@modverse/shared';
import { formatBytes, formatCompactNumber } from '@modverse/shared';
import { RatingStars } from '@/components/ui';

interface HeroProps {
  games: GameRecord[];
  stats: { games: number; downloads: number; updatedToday: number };
}

const ROTATE_MS = 6500;

export function Hero({ games, stats }: HeroProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = games[index];

  useEffect(() => {
    if (paused || games.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % games.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, games.length]);

  // Respect reduced motion for the auto-rotation.
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mql.matches) setPaused(true);
  }, []);

  if (!active) return null;

  return (
    <section
      className="relative overflow-hidden pb-10 pt-8 md:pb-16 md:pt-12"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Featured games"
    >
      {/* backdrop image of the active game */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active.slug}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden="true"
        >
          {active.banner?.url ? (
            <Image
              src={active.banner.url}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-25 dark:opacity-20"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-transparent to-bg" />
        </motion.div>
      </AnimatePresence>

      <div className="container">
        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          {/* copy */}
          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-brand"
            >
              <Sparkles className="h-3 w-3" />
              {stats.updatedToday} {stats.updatedToday === 1 ? 'game' : 'games'} updated today
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.06 }}
              className="mt-4 text-display-md font-extrabold leading-[1.05] tracking-tight"
            >
              Premium <span className="text-gradient">MOD APK</span>
              <br />
              games, unlocked.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12 }}
              className="mt-4 max-w-xl text-base leading-relaxed text-muted md:text-lg"
            >
              Unlimited money, mod menus and premium content — every APK signature-checked, virus-scanned and version-tracked
              automatically.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18 }}
              className="mt-7 flex flex-wrap gap-3"
            >
              <Link href="/browse" className="btn-primary btn-lg btn">
                <Play className="h-4 w-4" />
                Browse Games
              </Link>
              <Link href="/collection/trending" className="btn-secondary btn-lg btn">
                <TrendingUp className="h-4 w-4" />
                See Trending
              </Link>
            </motion.div>

            {/* stat strip */}
            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.26 }}
              className="mt-9 grid max-w-lg grid-cols-3 gap-4 border-t border-line/70 pt-6"
            >
              {[
                { label: 'Games', value: `${formatCompactNumber(stats.games)}+`, icon: Zap },
                { label: 'Downloads', value: `${formatCompactNumber(stats.downloads)}+`, icon: Download },
                { label: 'Virus-scanned', value: '100%', icon: Shield },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label}>
                  <dt className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-faint">
                    <Icon className="h-3 w-3" />
                    {label}
                  </dt>
                  <dd className="mt-1 font-display text-xl font-bold text-ink md:text-2xl">{value}</dd>
                </div>
              ))}
            </motion.dl>
          </div>

          {/* featured card */}
          <div className="relative z-10">
            <AnimatePresence mode="wait">
              <motion.article
                key={active.slug}
                initial={{ opacity: 0, y: 24, rotateX: 6 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="glass-strong overflow-hidden rounded-3xl"
                style={{ perspective: 1000 }}
              >
                <Link href={`/game/${active.slug}`} className="block">
                  <div className="relative aspect-banner w-full overflow-hidden">
                    {active.banner?.url ? (
                      <Image
                        src={active.banner.url}
                        alt={`${active.name} banner`}
                        fill
                        priority
                        sizes="(max-width:1024px) 100vw, 560px"
                        className="object-cover"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                    <div className="absolute bottom-0 left-0 right-0 flex items-end gap-3 p-4">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl ring-2 ring-white/20 md:h-20 md:w-20">
                        {active.icon?.url ? (
                          <Image src={active.icon.url} alt="" fill sizes="80px" className="object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 pb-1">
                        <h2 className="truncate font-display text-lg font-bold text-white md:text-xl">{active.name}</h2>
                        <p className="truncate text-xs text-white/70">{active.developer}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <RatingStars rating={active.rating} count={active.ratingCount} size="md" />
                      <span className="text-xs text-faint">v{active.version}</span>
                      <span className="text-xs text-faint">{formatBytes(active.sizeBytes)}</span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand">
                        <Download className="h-3 w-3" />
                        {formatCompactNumber(active.downloads)}
                      </span>
                    </div>

                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {active.modFeatures.slice(0, 3).map((f) => (
                        <li key={f} className="chip chip-active text-2xs">
                          {f}
                        </li>
                      ))}
                    </ul>

                    <span className="btn-primary btn mt-4 w-full">
                      <Download className="h-4 w-4" />
                      Download MOD APK
                    </span>
                  </div>
                </Link>
              </motion.article>
            </AnimatePresence>

            {/* pagination dots */}
            {games.length > 1 ? (
              <div className="mt-4 flex justify-center gap-1.5" role="tablist" aria-label="Featured game selector">
                {games.map((g, i) => (
                  <button
                    key={g.slug}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`Show ${g.name}`}
                    onClick={() => setIndex(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === index ? 'w-7 bg-grad-brand' : 'w-1.5 bg-line hover:bg-brand/50'
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
