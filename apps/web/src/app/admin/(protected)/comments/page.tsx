import type { Metadata } from 'next';
import { MessageSquare } from 'lucide-react';
import { timeAgo } from '@modverse/shared';
import { listPendingComments } from '@/lib/repositories/admin';
import { ManagerScaffold } from '@/components/admin/ManagerScaffold';
import { EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Comment Moderation' };
export const dynamic = 'force-dynamic';

export default async function AdminCommentsPage() {
  const comments = await listPendingComments(100);
  const pending = comments.filter((c) => c.status === 'pending');

  return (
    <ManagerScaffold
      title="Comment Moderation"
      description="Every comment is held for review before it appears publicly."
      count={pending.length}
      countLabel="Awaiting moderation"
      publicHref="/browse"
      publicLabel="View site"
      note="Row Level Security guarantees anonymous visitors can only insert comments with status='pending' — they cannot self-approve. A lightweight heuristic pre-flags link-heavy and shouty submissions as spam."
    >
      {comments.length ? (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{c.author}</span>
                <span className="text-2xs text-faint">on {c.gameSlug}</span>
                <span className="text-2xs text-faint">· {timeAgo(c.createdAt)}</span>
                <span className={cn('ml-auto rounded-md px-2 py-0.5 text-2xs font-bold uppercase',
                  c.status === 'approved' ? 'bg-success/15 text-success'
                  : c.status === 'spam' ? 'bg-danger/15 text-danger'
                  : 'bg-warning/15 text-warning')}>
                  {c.status}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{c.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No comments yet"
          description="Comments submitted on game pages will appear here for moderation."
          icon={<MessageSquare className="h-10 w-10" />}
        />
      )}
    </ManagerScaffold>
  );
}
