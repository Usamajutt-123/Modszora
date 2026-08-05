import Link from 'next/link';
import { Github, MessageCircle, Send, Twitter, Youtube } from 'lucide-react';
import { CATEGORY_LABELS, COLLECTION_LABELS, GAME_CATEGORIES, GAME_COLLECTIONS } from '@modverse/shared';
import { NewsletterForm } from '@/components/marketing/NewsletterForm';

const SOCIALS = [
  { href: 'https://twitter.com', label: 'Twitter', icon: Twitter },
  { href: 'https://t.me', label: 'Telegram', icon: Send },
  { href: 'https://discord.com', label: 'Discord', icon: MessageCircle },
  { href: 'https://youtube.com', label: 'YouTube', icon: Youtube },
  { href: 'https://github.com', label: 'GitHub', icon: Github },
];

const LEGAL = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/dmca', label: 'DMCA' },
  { href: '/faq', label: 'FAQ' },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-20 border-t border-line/70 bg-surface/40">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent" />

      {/* newsletter */}
      <div className="container py-12">
        <div className="card-gradient">
          <div className="flex flex-col items-center gap-6 p-8 text-center md:flex-row md:justify-between md:p-10 md:text-left">
            <div className="max-w-lg">
              <h2 className="font-display text-2xl font-bold text-ink">Never miss a MOD drop</h2>
              <p className="mt-2 text-sm text-muted">
                Weekly digest of new mod menus, version bumps and the games worth your storage. No spam, unsubscribe anytime.
              </p>
            </div>
            <NewsletterForm className="w-full max-w-md shrink-0" />
          </div>
        </div>
      </div>

      {/* link columns */}
      <div className="container grid gap-10 pb-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-1">
          <Link href="/" className="flex items-center gap-2" aria-label="MODSzora home">
            <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-grad-brand shadow-glow">
              <img src="/favicon.svg" alt="" className="h-full w-full object-cover" />
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight">
              MOD<span className="text-gradient">Szora</span>
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            Premium MOD APK games, scanned and version-tracked automatically. Built for players who want the full game without the grind.
          </p>
          <div className="mt-5 flex gap-2">
            {SOCIALS.map(({ href, label, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                aria-label={label}
                className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface-2 text-muted transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/50 hover:text-brand"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <nav aria-labelledby="footer-categories">
          <h3 id="footer-categories" className="mb-3 text-xs font-bold uppercase tracking-wider text-ink">
            Categories
          </h3>
          <ul className="space-y-2">
            {GAME_CATEGORIES.slice(0, 8).map((c) => (
              <li key={c}>
                <Link href={`/category/${c}`} className="text-sm text-muted transition-colors hover:text-brand">
                  {CATEGORY_LABELS[c]} MODs
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-collections">
          <h3 id="footer-collections" className="mb-3 text-xs font-bold uppercase tracking-wider text-ink">
            Collections
          </h3>
          <ul className="space-y-2">
            {GAME_COLLECTIONS.map((c) => (
              <li key={c}>
                <Link href={`/collection/${c}`} className="text-sm text-muted transition-colors hover:text-brand">
                  {COLLECTION_LABELS[c]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-explore">
          <h3 id="footer-explore" className="mb-3 text-xs font-bold uppercase tracking-wider text-ink">
            Explore
          </h3>
          <ul className="space-y-2">
            {[
              { href: '/browse', label: 'All Games' },
              { href: '/search', label: 'Advanced Search' },
              { href: '/reviews', label: 'Game Reviews' },
              { href: '/wallpapers', label: 'Wallpapers' },
              { href: '/blog', label: 'Gaming News' },
              { href: '/blog/category/guides', label: 'Install Guides' },
            ].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-muted transition-colors hover:text-brand">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-legal">
          <h3 id="footer-legal" className="mb-3 text-xs font-bold uppercase tracking-wider text-ink">
            Company
          </h3>
          <ul className="space-y-2">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-muted transition-colors hover:text-brand">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* bottom bar */}
      <div className="border-t border-line/70">
        <div className="container flex flex-col items-center justify-between gap-3 py-5 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-faint">
            © {year} MODSzora. All game names and trademarks belong to their respective owners.
          </p>
          <p className="text-xs text-faint">
            MODSzora hosts no copyrighted content. Files are provided for testing and educational purposes.
          </p>
        </div>
      </div>
    </footer>
  );
}
