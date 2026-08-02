import type { Metadata } from 'next';
import Link from 'next/link';
import { Bot, Link2, PencilLine } from 'lucide-react';

export const metadata: Metadata = { title: 'New Game' };

export default function NewGamePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Add a game</h1>
        <p className="mt-1 text-sm text-muted">Two ways to create a listing.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/agent" className="card card-hover p-6">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-grad-brand shadow-glow">
            <Bot className="h-5 w-5 text-white" />
          </span>
          <h2 className="mt-4 font-display text-lg font-bold">Automatic (recommended)</h2>
          <p className="mt-1.5 text-sm text-muted">
            Paste a URL from any supported source. The agent scrapes the page, writes the SEO copy and FAQs, compresses
            the media, transfers the APK to Mega and publishes the listing.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
            <Link2 className="h-4 w-4" />
            Open the agent console
          </span>
        </Link>

        <Link href="/admin/games/manual" className="card card-hover p-6">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface-2">
            <PencilLine className="h-5 w-5 text-muted" />
          </span>
          <h2 className="mt-4 font-display text-lg font-bold">Manual entry</h2>
          <p className="mt-1.5 text-sm text-muted">
            Fill in the listing yourself: details, description, MOD features, media, download links and SEO. Every
            field is validated against the same Zod schema the agent uses, so manual and automated records are
            structurally identical.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
            <PencilLine className="h-4 w-4" />
            Open the manual upload form
          </span>
        </Link>
      </div>
    </div>
  );
}