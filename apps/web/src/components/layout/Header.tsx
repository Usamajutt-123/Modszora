'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame, Gamepad2, ImageIcon, Menu, Newspaper, Star, X } from 'lucide-react';
import { CATEGORY_LABELS, GAME_CATEGORIES } from '@modverse/shared';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { SearchBar } from '@/components/search/SearchBar';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/browse', label: 'Games', icon: Gamepad2 },
  { href: '/collection/trending', label: 'Trending', icon: Flame },
  { href: '/reviews', label: 'Reviews', icon: Star },
  { href: '/wallpapers', label: 'Wallpapers', icon: ImageIcon },
  { href: '/blog', label: 'Blog', icon: Newspaper },
];

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the drawer on navigation and lock body scroll while open.
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      <header
        className={cn(
          'sticky top-0 z-50 w-full min-w-0 transition-all duration-300',
          scrolled ? 'glass-strong border-b border-line/70' : 'border-b border-transparent bg-bg/60 backdrop-blur-sm',
        )}
      >
        <div className="container flex h-16 min-w-0 items-center gap-3 lg:h-[68px]">
          {/* logo */}
          <Link href="/" className="group flex shrink-0 items-center gap-2" aria-label="MODSzora home">
            <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-grad-brand shadow-glow">
              <img src="/favicon.svg" alt="" className="h-full w-full object-cover" />
              <span className="absolute inset-0 animate-pulse-glow bg-grad-neon opacity-0 transition-opacity duration-500 group-hover:opacity-40" />
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight">
              MOD<span className="text-gradient">Szora</span>
            </span>
          </Link>

          {/* desktop nav */}
          <nav className="ml-2 hidden items-center gap-0.5 lg:flex" aria-label="Main">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
                  isActive(href) ? 'text-brand' : 'text-muted hover:text-ink',
                )}
              >
                {label}
                {isActive(href) ? (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-grad-brand"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                ) : null}
              </Link>
            ))}

            {/* categories mega menu */}
            <div className="group relative">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
                aria-haspopup="true"
              >
                Categories
              </button>
              <div className="invisible absolute left-0 top-full w-[520px] pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="glass-strong grid grid-cols-3 gap-1 rounded-2xl p-3">
                  {GAME_CATEGORIES.map((c) => (
                    <Link
                      key={c}
                      href={`/category/${c}`}
                      className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-brand"
                    >
                      {CATEGORY_LABELS[c]}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </nav>

          {/* search */}
          <div className="ml-auto hidden min-w-0 max-w-sm flex-1 md:block">
            <SearchBar />
          </div>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <ThemeToggle className="hidden sm:inline-flex" />
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface-2 text-ink transition-colors hover:border-brand/50 lg:hidden"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>

        {/* mobile search bar */}
        <div className="container pb-3 md:hidden">
          <SearchBar />
        </div>
      </header>

      {/* mobile drawer */}
      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              aria-hidden="true"
            />
            <motion.nav
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              className="glass-strong fixed right-0 top-0 z-50 flex h-dvh w-[85vw] max-w-sm flex-col overflow-y-auto p-5 lg:hidden"
              aria-label="Mobile navigation"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="font-display text-lg font-extrabold">
                  MOD<span className="text-gradient">Szora</span>
                </span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface-2"
                  aria-label="Close menu"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                {NAV.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                      isActive(href) ? 'bg-brand/12 text-brand' : 'text-muted hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                    {label}
                  </Link>
                ))}
              </div>

              <p className="mb-2 mt-6 px-3 text-2xs font-bold uppercase tracking-wider text-faint">Categories</p>
              <div className="grid grid-cols-2 gap-1">
                {GAME_CATEGORIES.map((c) => (
                  <Link
                    key={c}
                    href={`/category/${c}`}
                    className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-brand"
                  >
                    {CATEGORY_LABELS[c]}
                  </Link>
                ))}
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-line pt-5">
                <span className="text-xs text-faint">Theme</span>
                <ThemeToggle />
              </div>
            </motion.nav>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
