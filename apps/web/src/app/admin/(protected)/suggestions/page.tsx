import type { Metadata } from 'next';
import { Lightbulb } from 'lucide-react';
import { SuggestionsPanel } from '@/components/admin/SuggestionsPanel';
import { listSuggestions } from '@/lib/repositories/cms';
import { isDemoMode } from '@/lib/env';

export const metadata: Metadata = { title: 'AI Suggestions' };
export const dynamic = 'force-dynamic';

export default async function AdminSuggestionsPage() {
  const suggestions = await listSuggestions(150);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2.5 font-display text-2xl font-extrabold">
          <Lightbulb className="h-6 w-6 text-brand" />
          AI Suggestions
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Automated content-health analysis: trending games, stale listings, missing screenshots, broken links,
          duplicate entries and keyword opportunities — each with a one-click action.
        </p>
      </header>
      <SuggestionsPanel initial={suggestions} demoMode={isDemoMode()} />
    </div>
  );
}
