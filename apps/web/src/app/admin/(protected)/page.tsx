import Link from 'next/link';
import Image from 'next/image';
import {
  AlertTriangle,
  Bot,
  Clock,
  Cloud,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Gamepad2,
  HardDrive,
  Image as ImageIcon,
  Lightbulb,
  MessageSquare,
  Newspaper,
  Plus,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { formatBytes, formatCompactNumber, timeAgo } from '@modverse/shared';
import { getCmsTotals, getTrafficSeries, listSuggestions } from '@/lib/repositories/cms';
import { getDashboardStats } from '@/lib/repositories/admin';
import { AgentStatusCard } from '@/components/admin/AgentStatusCard';
import { BarList, DonutChart, TrafficChart, UsageMeter } from '@/components/admin/Charts';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Compact metric tile with an optional trend indicator. */
function Metric({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  href,
  accent,
}: {
  label: string;
  value: string | number;
  icon: typeof Gamepad2;
  hint?: string;
  trend?: number;
  href?: string;
  accent?: boolean;
}) {
  const body = (
    <div
      className={cn(
        'card h-full p-4 transition-all duration-200',
        href && 'hover:-translate-y-0.5 hover:border-brand/45 hover:shadow-glow',
        accent && 'border-brand/30 bg-brand/[0.04]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xs font-bold uppercase tracking-wider text-faint">{label}</span>
        <Icon className={cn('h-4 w-4 shrink-0', accent ? 'text-accent' : 'text-brand')} />
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold text-ink">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {trend !== undefined && trend !== 0 ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-2xs font-semibold',
              trend > 0 ? 'text-success' : 'text-danger',
            )}
          >
            {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend)}%
          </span>
        ) : null}
        {hint ? <span className="text-2xs text-faint">{hint}</span> : null}
      </div>
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function AdminDashboard() {
  const [totals, series, suggestions, legacy] = await Promise.all([
    getCmsTotals(),
    getTrafficSeries(14),
    listSuggestions(6),
    getDashboardStats(),
  ]);

  const recentViews = series.slice(-7).reduce((s, d) => s + d.views, 0);
  const priorViews = series.slice(0, 7).reduce((s, d) => s + d.views, 0);
  const viewsTrend = priorViews > 0 ? Number((((recentViews - priorViews) / priorViews) * 100).toFixed(1)) : 0;

  const recentDl = series.slice(-7).reduce((s, d) => s + d.downloads, 0);
  const priorDl = series.slice(0, 7).reduce((s, d) => s + d.downloads, 0);
  const dlTrend = priorDl > 0 ? Number((((recentDl - priorDl) / priorDl) * 100).toFixed(1)) : 0;

  const contentSlices = [
    { label: 'Games', value: totals.games, color: 'rgb(var(--mv-brand))' },
    { label: 'Wallpapers', value: totals.wallpapers, color: 'rgb(var(--mv-accent))' },
    { label: 'Reviews', value: totals.reviews, color: 'rgb(var(--mv-neon))' },
    { label: 'Blog posts', value: totals.posts, color: 'rgb(var(--mv-success))' },
    { label: 'News', value: totals.news, color: 'rgb(var(--mv-warning))' },
  ];

  const totalContent = contentSlices.reduce((s, x) => s + x.value, 0);

  // Storage quotas: Supabase free tier is 1 GB; Mega free is 20 GB.
  const SUPABASE_LIMIT = 1024 ** 3;
  const MEGA_LIMIT = 20 * 1024 ** 3;
  const megaUsed = legacy.topGames.reduce((s, g) => s + g.downloads * 0, 0) + totals.games * 180 * 1024 * 1024;

  const criticalSuggestions = suggestions.filter((s) => s.severity === 'error').length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Everything across the library, traffic and automation.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/wallpapers/new" className="btn-secondary btn-sm btn">
            <ImageIcon className="h-3.5 w-3.5" />
            Wallpaper
          </Link>
          <Link href="/admin/blog/new" className="btn-secondary btn-sm btn">
            <FileText className="h-3.5 w-3.5" />
            Article
          </Link>
          <Link href="/admin/agent" className="btn-primary btn-sm btn">
            <Bot className="h-3.5 w-3.5" />
            AI Agent
          </Link>
        </div>
      </header>

      {/* content counts */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Metric
          label="Games"
          value={totals.games}
          icon={Gamepad2}
          hint={`${totals.gamesPublished} live · ${totals.gamesDraft} draft`}
          href="/admin/games"
        />
        <Metric
          label="Wallpapers"
          value={totals.wallpapers}
          icon={ImageIcon}
          hint={`${totals.wallpapersPublished} published`}
          href="/admin/wallpapers"
        />
        <Metric
          label="Reviews"
          value={totals.reviews}
          icon={Star}
          hint={`${totals.reviewsPublished} published`}
          href="/admin/reviews"
        />
        <Metric label="Blog posts" value={totals.posts} icon={FileText} hint="guides & evergreen" href="/admin/blog" />
        <Metric label="News" value={totals.news} icon={Newspaper} hint="time-sensitive" href="/admin/news" />
      </div>

      {/* traffic */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Views (7d)"
          value={formatCompactNumber(recentViews)}
          icon={Eye}
          trend={viewsTrend}
          hint="vs previous 7 days"
        />
        <Metric
          label="Downloads (7d)"
          value={formatCompactNumber(recentDl)}
          icon={Download}
          trend={dlTrend}
          hint="vs previous 7 days"
        />
        <Metric
          label="All-time downloads"
          value={formatCompactNumber(totals.totalDownloads)}
          icon={Download}
          hint="across every listing"
        />
        <Metric
          label="Suggestions"
          value={totals.suggestionsNew}
          icon={Lightbulb}
          hint={criticalSuggestions ? `${criticalSuggestions} critical` : 'nothing urgent'}
          href="/admin/suggestions"
          accent={criticalSuggestions > 0}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="space-y-5">
          {/* traffic chart */}
          <section className="card p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-base font-bold">
                <TrendingUp className="h-4 w-4 text-brand" />
                Traffic — last 14 days
              </h2>
            </div>
            <TrafficChart data={series} />
          </section>

          {/* content mix */}
          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold">
              <FolderOpen className="h-4 w-4 text-brand" />
              Content mix
            </h2>
            <DonutChart slices={contentSlices} centerValue={String(totalContent)} centerLabel="items" />
          </section>

          {/* top games */}
          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold">
              <Gamepad2 className="h-4 w-4 text-brand" />
              Top games by views
            </h2>
            <BarList
              items={legacy.topGames.map((g) => ({
                label: g.name,
                value: g.views,
                href: `/game/${g.slug}`,
                meta: `${formatCompactNumber(g.downloads)} dl`,
              }))}
            />
          </section>

          {/* latest uploads */}
          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold">
              <Clock className="h-4 w-4 text-brand" />
              Latest uploads
            </h2>
            {legacy.recentUploads.length ? (
              <ul className="divide-y divide-line/60">
                {legacy.recentUploads.map((g) => (
                  <li key={g.slug} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/admin/games/edit/${g.slug}`} className="block truncate text-sm font-medium text-ink hover:text-brand">
                        {g.name}
                      </Link>
                      <p className="text-2xs text-faint">{timeAgo(g.createdAt)}</p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-md px-2 py-0.5 text-2xs font-bold uppercase',
                        g.status === 'published' && 'bg-success/15 text-success',
                        g.status === 'draft' && 'bg-surface-2 text-faint',
                        g.status === 'scheduled' && 'bg-warning/15 text-warning',
                        g.status === 'archived' && 'bg-danger/15 text-danger',
                      )}
                    >
                      {g.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted">Nothing uploaded yet.</p>
            )}
          </section>
        </div>

        {/* right column */}
        <div className="space-y-5">
          <AgentStatusCard />

          {/* suggestions preview */}
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-base font-bold">
                <Lightbulb className="h-4 w-4 text-brand" />
                AI suggestions
              </h2>
              <Link href="/admin/suggestions" className="text-2xs font-semibold text-brand hover:text-accent">
                View all
              </Link>
            </div>
            {suggestions.length ? (
              <ul className="space-y-2">
                {suggestions.slice(0, 5).map((s) => (
                  <li key={s.id ?? s.title} className="rounded-xl bg-surface-2/60 p-2.5">
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                          s.severity === 'error' ? 'bg-danger' : s.severity === 'warn' ? 'bg-warning' : 'bg-brand',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-ink">{s.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-2xs text-muted">{s.detail}</p>
                      </div>
                    </div>
                    {s.actionHref ? (
                      <Link
                        href={s.actionHref}
                        className="mt-1.5 inline-block text-2xs font-semibold text-brand hover:text-accent"
                      >
                        {s.actionLabel ?? 'Open'} →
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted">No suggestions right now.</p>
            )}
          </section>

          {/* resource usage */}
          <section className="card space-y-4 p-5">
            <h2 className="flex items-center gap-2 font-display text-base font-bold">
              <HardDrive className="h-4 w-4 text-brand" />
              Resource usage
            </h2>

            <UsageMeter
              label="Supabase storage"
              used={totals.mediaBytes}
              limit={SUPABASE_LIMIT}
              format="bytes"
              hint={`${totals.mediaAssets} objects indexed`}
            />

            <UsageMeter
              label="Mega (estimated)"
              used={megaUsed}
              limit={MEGA_LIMIT}
              format="bytes"
              hint="APK archive across all listings"
            />

            <UsageMeter
              label="OpenAI calls (24h)"
              used={legacy.agent.completed24h}
              limit={1000}
              format="integer"
              hint="generation + SEO requests"
            />

            <div className="border-t border-line/60 pt-3">
              <Link href="/admin/media" className="btn-secondary btn-sm btn w-full">
                <FolderOpen className="h-3.5 w-3.5" />
                Open media library
              </Link>
            </div>
          </section>

          {/* moderation */}
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
              <MessageSquare className="h-4 w-4 text-brand" />
              Moderation
            </h2>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted">Total comments</dt>
                <dd className="font-semibold tabular-nums text-ink">{totals.comments}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Awaiting review</dt>
                <dd
                  className={cn(
                    'font-semibold tabular-nums',
                    totals.commentsPending > 0 ? 'text-warning' : 'text-success',
                  )}
                >
                  {totals.commentsPending}
                </dd>
              </div>
            </dl>
            <Link href="/admin/comments" className="btn-secondary btn-sm btn mt-3 w-full">
              Moderate comments
            </Link>
          </section>

          {/* errors */}
          {legacy.errors.length ? (
            <section className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
                <AlertTriangle className="h-4 w-4 text-danger" />
                Recent errors
              </h2>
              <ul className="space-y-2">
                {legacy.errors.slice(0, 4).map((e) => (
                  <li key={e.id} className="rounded-xl border border-danger/25 bg-danger/[0.06] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-2xs font-semibold text-danger">{e.scope}</span>
                      <span className="text-2xs text-faint">{timeAgo(e.createdAt)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 break-words text-2xs text-muted">{e.message}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
