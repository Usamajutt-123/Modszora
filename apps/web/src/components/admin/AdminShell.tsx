'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Bot,
  FileText,
  FolderOpen,
  Gamepad2,
  Image as ImageIcon,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  MessageSquare,
  Newspaper,
  Search,
  Settings,
  Star,
  X,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { getBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

/** Sidebar navigation, grouped so the CMS stays scannable as it grows. */
const NAV_GROUPS: Array<{
  label: string | null;
  items: Array<{ href: string; label: string; icon: typeof Gamepad2; exact?: boolean }>;
}> = [
  {
    label: null,
    items: [{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true }],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/games', label: 'Games', icon: Gamepad2 },
      { href: '/admin/wallpapers', label: 'Wallpapers', icon: ImageIcon },
      { href: '/admin/reviews', label: 'Reviews', icon: Star },
      { href: '/admin/blog', label: 'Blog', icon: FileText },
      { href: '/admin/news', label: 'News', icon: Newspaper },
      { href: '/admin/comments', label: 'Comments', icon: MessageSquare },
    ],
  },
  {
    label: 'Automation',
    items: [
      { href: '/admin/agent', label: 'AI Agent', icon: Bot },
      { href: '/admin/suggestions', label: 'Suggestions', icon: Lightbulb },
    ],
  },
  {
    label: 'Assets & SEO',
    items: [
      { href: '/admin/media', label: 'Media Library', icon: FolderOpen },
      { href: '/admin/seo', label: 'SEO', icon: Search },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function AdminShell({ children, email }: { children: ReactNode; email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  async function signOut() {
    await getBrowserClient()?.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/admin" className="flex items-center gap-2 px-2 py-1">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-grad-brand shadow-glow">
          <Gamepad2 className="h-4 w-4 text-white" strokeWidth={2.4} />
        </span>
        <span className="font-display text-base font-extrabold">
          MOD<span className="text-gradient">Verse</span>
        </span>
        <span className="ml-auto rounded-md bg-surface-2 px-1.5 py-0.5 text-2xs font-bold uppercase text-faint">Admin</span>
      </Link>

      <nav className="mt-5 flex flex-1 flex-col gap-4 overflow-y-auto" aria-label="Admin navigation">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label ?? `group-${gi}`}>
            {group.label ? (
              <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-faint">{group.label}</p>
            ) : null}
            <div className="flex flex-col gap-0.5">
              {group.items.map(({ href, label, icon: Icon, exact }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                    isActive(href, exact) ? 'bg-brand/12 text-brand' : 'text-muted hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 border-t border-line pt-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="truncate text-2xs text-faint" title={email}>
            {email}
          </span>
          <ThemeToggle />
        </div>
        <div className="flex gap-2">
          <Link href="/" target="_blank" className="btn-secondary btn-sm btn flex-1">
            View site
          </Link>
          <button type="button" onClick={signOut} className="btn-ghost btn-sm btn" aria-label="Sign out" title="Sign out">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-bg">
      {/* mobile top bar */}
      <div className="glass-strong sticky top-0 z-40 flex items-center gap-3 border-b border-line px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open admin menu"
          className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface-2"
        >
          <Menu className="h-4 w-4" />
        </button>
        <span className="font-display text-base font-bold">
          MOD<span className="text-gradient">Verse</span> Admin
        </span>
      </div>

      <div className="flex">
        {/* desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-line bg-surface/60 p-4 lg:block">
          {sidebar}
        </aside>

        {/* mobile drawer */}
        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <div className="glass-strong absolute left-0 top-0 h-dvh w-72 p-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface-2"
              >
                <X className="h-4 w-4" />
              </button>
              {sidebar}
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
