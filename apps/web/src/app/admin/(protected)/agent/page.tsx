import type { Metadata } from 'next';
import { AgentConsole } from '@/components/admin/AgentConsole';

export const metadata: Metadata = { title: 'AI Agent' };
export const dynamic = 'force-dynamic';

export default function AgentPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold">AI Agent</h1>
        <p className="mt-1 text-sm text-muted">
          Monitor autonomous ingestion, trigger tasks on demand, and publish any game URL in one click.
        </p>
      </header>
      <AgentConsole />
    </div>
  );
}
