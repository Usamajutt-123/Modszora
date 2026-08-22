import type { Metadata } from 'next';
import { Bot, Cloud, Database, Key, Palette, Search, Server, Sparkles } from 'lucide-react';
import { env, hasServiceRole, hasSupabase } from '@/lib/env';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

interface Row { key: string; label: string; set: boolean; hint: string; secret?: boolean }

function Group({ title, icon: Icon, rows }: { title: string; icon: typeof Key; rows: Row[] }) {
  return (
    <section className="card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
        <Icon className="h-4 w-4 text-brand" />
        {title}
      </h2>
      <ul className="divide-y divide-line/60">
        {rows.map((r) => (
          <li key={r.key} className="flex items-start justify-between gap-4 py-2.5">
            <div className="min-w-0">
              <p className="font-mono text-xs text-ink">{r.key}</p>
              <p className="mt-0.5 text-2xs text-muted">{r.hint}</p>
            </div>
            <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-2xs font-bold uppercase',
              r.set ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning')}>
              {r.set ? 'set' : 'missing'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AdminSettingsPage() {
  const has = (v: unknown) => Boolean(v);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Configuration is environment-driven so secrets never live in the database unencrypted.
          Values below are read from the running process — nothing sensitive is displayed.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Group title="Database & storage" icon={Database} rows={[
          { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'Supabase URL', set: hasSupabase(), hint: 'Project REST endpoint' },
          { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', label: 'Anon key', set: hasSupabase(), hint: 'Public read access, constrained by RLS' },
          { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Service role', set: hasServiceRole(), hint: 'Server-only, bypasses RLS' },
          { key: 'SUPABASE_STORAGE_BUCKET', label: 'Bucket', set: has(env.SUPABASE_STORAGE_BUCKET), hint: 'Bucket for icons, banners and screenshots' },
        ]} />

        <Group title="Admin access" icon={Key} rows={[
          { key: 'ADMIN_EMAILS', label: 'Allowlist', set: has(env.ADMIN_EMAILS), hint: 'Comma-separated emails permitted to sign in' },
          { key: 'AGENT_API_KEY', label: 'Agent key', set: has(env.AGENT_API_KEY), hint: 'Shared secret between the site and the agent' },
          { key: 'SECRETS_ENCRYPTION_KEY', label: 'Encryption key', set: has(env.SECRETS_ENCRYPTION_KEY), hint: 'AES-256-GCM key for secrets stored in Postgres' },
        ]} />

        <Group title="AI agent" icon={Bot} rows={[
          { key: 'NEXT_PUBLIC_AGENT_URL', label: 'Agent URL', set: has(env.NEXT_PUBLIC_AGENT_URL), hint: 'Base URL of the Express agent service' },
          { key: 'OPENAI_API_KEY', label: 'OpenAI', set: has(env.OPENAI_API_KEY), hint: 'SEO and review generation (heuristic fallback if unset)' },
        ]} />

        <Group title="Remote upload" icon={Cloud} rows={[
          { key: 'MULTCLOUD_API_KEY', label: 'MultCloud', set: has(process.env.MULTCLOUD_API_KEY), hint: 'Server-to-server APK transfer to Mega' },
          { key: 'MULTCLOUD_MEGA_CLOUD_ID', label: 'Mega cloud id', set: has(process.env.MULTCLOUD_MEGA_CLOUD_ID), hint: 'Destination cloud connected in MultCloud' },
        ]} />

        <Group title="Analytics & ads" icon={Search} rows={[
          { key: 'NEXT_PUBLIC_GA_ID', label: 'Google Analytics', set: has(env.NEXT_PUBLIC_GA_ID), hint: 'Loaded lazily, IP anonymised' },
          { key: 'NEXT_PUBLIC_ADSENSE_CLIENT', label: 'AdSense', set: has(env.NEXT_PUBLIC_ADSENSE_CLIENT), hint: 'Ad slots reserve space to avoid layout shift' },
          { key: 'NEXT_PUBLIC_ADSTERRA_DOMAIN', label: 'Adsterra domain', set: has(env.NEXT_PUBLIC_ADSTERRA_DOMAIN), hint: 'Banner host, shared by all five banner units' },
          { key: 'NEXT_PUBLIC_ADSTERRA_KEY_LEADERBOARD', label: 'Adsterra leaderboard', set: has(env.NEXT_PUBLIC_ADSTERRA_KEY_LEADERBOARD), hint: '728 × 90 — download page, above content' },
          { key: 'NEXT_PUBLIC_ADSTERRA_KEY_RECTANGLE', label: 'Adsterra rectangle', set: has(env.NEXT_PUBLIC_ADSTERRA_KEY_RECTANGLE), hint: '300 × 250 — sidebars on download, blog, reviews' },
          { key: 'NEXT_PUBLIC_ADSTERRA_KEY_SIDEBAR', label: 'Adsterra sidebar', set: has(env.NEXT_PUBLIC_ADSTERRA_KEY_SIDEBAR), hint: '160 × 600 skyscraper — game and blog sidebars' },
          { key: 'NEXT_PUBLIC_ADSTERRA_KEY_IN_ARTICLE', label: 'Adsterra in-article', set: has(env.NEXT_PUBLIC_ADSTERRA_KEY_IN_ARTICLE), hint: '468 × 60 — inside game, download, review content' },
          { key: 'NEXT_PUBLIC_ADSTERRA_KEY_MOBILE', label: 'Adsterra mobile', set: has(env.NEXT_PUBLIC_ADSTERRA_KEY_MOBILE), hint: '320 × 50 — replaces the leaderboard below md' },
          { key: 'NEXT_PUBLIC_ADSTERRA_NATIVE_DOMAIN', label: 'Adsterra native domain', set: has(env.NEXT_PUBLIC_ADSTERRA_NATIVE_DOMAIN), hint: 'Native Banner host — different from the banner host' },
          { key: 'NEXT_PUBLIC_ADSTERRA_NATIVE_KEY', label: 'Adsterra native', set: has(env.NEXT_PUBLIC_ADSTERRA_NATIVE_KEY), hint: 'Native Banner — game and download pages' },
          { key: 'NEXT_PUBLIC_ADSTERRA_SOCIALBAR_SRC', label: 'Adsterra social bar', set: has(env.NEXT_PUBLIC_ADSTERRA_SOCIALBAR_SRC), hint: 'Sticky bottom bar — every public page, not admin' },
          { key: 'monetag-popunder', label: 'Monetag popunder', set: true, hint: 'Fires on every download click (built-in, zone 272339)' },
        ]} />

        <Group title="Site" icon={Palette} rows={[
          { key: 'NEXT_PUBLIC_SITE_URL', label: 'Site URL', set: has(env.NEXT_PUBLIC_SITE_URL), hint: 'Canonical origin used in metadata and sitemaps' },
          { key: 'NEXT_PUBLIC_SITE_NAME', label: 'Site name', set: has(env.NEXT_PUBLIC_SITE_NAME), hint: 'Brand name in titles and schema' },
        ]} />
      </div>

      <section className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
          <Server className="h-4 w-4 text-brand" />
          Runtime mode
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Database', value: hasSupabase() ? 'Supabase connected' : 'Demo fixtures', ok: hasSupabase() },
            { label: 'Writes', value: hasServiceRole() ? 'Enabled' : 'Read-only', ok: hasServiceRole() },
            { label: 'Agent', value: env.NEXT_PUBLIC_AGENT_URL ? 'Configured' : 'Not configured', ok: Boolean(env.NEXT_PUBLIC_AGENT_URL) },
          ].map((m) => (
            <div key={m.label} className="rounded-xl bg-surface-2/60 p-3">
              <p className="text-2xs font-bold uppercase tracking-wider text-faint">{m.label}</p>
              <p className={cn('mt-1 text-sm font-semibold', m.ok ? 'text-success' : 'text-warning')}>{m.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-start gap-2.5 rounded-2xl border border-brand/25 bg-brand/[0.06] p-4">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <p className="text-xs leading-relaxed text-muted">
          To change any value, edit <code className="font-mono text-brand">.env.local</code> (or your Vercel project
          settings) and restart. Secrets entered through the API are encrypted with AES-256-GCM before being written to
          the <code className="font-mono text-brand">settings</code> table, which is admin-only under RLS.
        </p>
      </div>
    </div>
  );
}
