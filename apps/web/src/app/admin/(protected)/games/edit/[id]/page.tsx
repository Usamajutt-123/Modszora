import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, PencilLine } from 'lucide-react';
import { formatBytes, formatDate } from '@modverse/shared';
import { listAdminGames } from '@/lib/repositories/admin';
import { SpecRow } from '@/components/ui';

export const metadata: Metadata = { title: 'Edit Game' };
export const dynamic = 'force-dynamic';

export default async function EditGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { items } = await listAdminGames({ pageSize: 500 });
  const game = items.find((g) => g.id === id || g.slug === id);
  if (!game) notFound();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/games" className="btn-ghost btn-sm btn" aria-label="Back to games">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div>
            <h1 className="font-display text-xl font-extrabold">{game.name}</h1>
            <p className="text-2xs text-faint">{game.packageName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/game/${game.slug}`} target="_blank" className="btn-secondary btn-sm btn">
            View live <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <Link href={`/admin/games/manage/${game.id ?? game.slug}`} className="btn-primary btn-sm btn">
            <PencilLine className="h-3.5 w-3.5" />
            Edit manually
          </Link>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-2 font-display text-base font-bold">Listing</h2>
          <dl>
            <SpecRow label="Slug" value={<code className="font-mono text-2xs">{game.slug}</code>} />
            <SpecRow label="Version" value={game.version} />
            <SpecRow label="Mod version" value={game.modVersion ?? 'â€”'} />
            <SpecRow label="Developer" value={game.developer} />
            <SpecRow label="Category" value={game.category} />
            <SpecRow label="Android" value={game.androidVersion} />
            <SpecRow label="Size" value={formatBytes(game.sizeBytes)} />
            <SpecRow label="Status" value={game.status} />
            <SpecRow label="Published" value={formatDate(game.publishedAt)} />
            <SpecRow label="Source" value={game.sourceSite ?? 'manual'} />
          </dl>
        </section>

        <section className="card p-5">
          <h2 className="mb-2 font-display text-base font-bold">SEO</h2>
          <dl>
            <SpecRow label="Title" value={<span className="text-xs">{game.seo?.title}</span>} />
            <SpecRow label="Title length" value={`${game.seo?.title?.length ?? 0} chars`} />
            <SpecRow label="Description length" value={`${game.seo?.description?.length ?? 0} chars`} />
            <SpecRow label="Keywords" value={game.seo?.keywords?.length ?? 0} />
            <SpecRow label="OG image" value={game.seo?.ogImage ? 'set' : 'missing'} />
            <SpecRow label="FAQs" value={game.faqs?.length ?? 0} />
            <SpecRow label="Screenshots" value={game.screenshots?.length ?? 0} />
            <SpecRow label="Mod features" value={game.modFeatures?.length ?? 0} />
          </dl>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="mb-2 font-display text-base font-bold">Update this listing</h2>
        <p className="text-sm text-muted">
          Re-run the agent against the source URL to refresh version, size, changelog and links in place. Because the
          content fingerprint is compared first, an unchanged page costs a single fetch and writes nothing.
        </p>
        {game.sourceUrl ? (
          <code className="mt-3 block break-all rounded-xl bg-surface-2 p-3 font-mono text-2xs text-muted">
            {game.sourceUrl}
          </code>
        ) : (
          <p className="mt-3 text-2xs text-faint">No source URL recorded â€” this listing was created manually.</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/admin/agent" className="btn-primary btn-sm btn">
            Open agent console
          </Link>
          <Link href={`/admin/games/manage/${game.id ?? game.slug}`} className="btn-secondary btn-sm btn">
            <PencilLine className="h-3.5 w-3.5" />
            Edit fields manually
          </Link>
        </div>
      </section>
    </div>
  );
}