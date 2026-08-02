'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, MessageSquare, Send, Star } from 'lucide-react';
import { timeAgo } from '@modverse/shared';
import type { CommentRecord } from '@/lib/repositories/content';
import { cn } from '@/lib/utils';

export function CommentSection({
  gameSlug,
  initialComments,
}: {
  gameSlug: string;
  initialComments: CommentRecord[];
}) {
  const [comments] = useState<CommentRecord[]>(initialComments);
  const [author, setAuthor] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState<number>(0);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameSlug, author, body, rating: rating || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Could not post comment');
      setState('done');
      setMessage('Thanks! Your comment is awaiting moderation.');
      setAuthor('');
      setBody('');
      setRating(0);
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <div className="space-y-6">
      {/* form */}
      {state === 'done' ? (
        <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
          <p className="text-sm font-medium text-success">{message}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="card p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="comment-author" className="label">
                Your name
              </label>
              <input
                id="comment-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                required
                minLength={2}
                maxLength={60}
                placeholder="Gamer123"
                className="input"
              />
            </div>
            <div>
              <span className="label">Rating</span>
              <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    onClick={() => setRating(n === rating ? 0 : n)}
                    className="p-0.5 transition-transform hover:scale-110"
                  >
                    <Star
                      className={cn('h-5 w-5 transition-colors', n <= rating ? 'fill-warning text-warning' : 'text-line')}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <label htmlFor="comment-body" className="label">
              Comment
            </label>
            <textarea
              id="comment-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              minLength={3}
              maxLength={2000}
              rows={4}
              placeholder="Share your experience with this MOD…"
              className="input resize-y"
            />
            <p className="mt-1 text-2xs text-faint">{body.length} / 2000 · Comments are moderated before publishing.</p>
          </div>

          {state === 'error' ? (
            <p role="alert" className="mt-2 text-xs text-danger">
              {message}
            </p>
          ) : null}

          <button type="submit" disabled={state === 'sending'} className="btn-primary btn mt-4">
            {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Post comment
          </button>
        </form>
      )}

      {/* list */}
      {comments.length ? (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="card p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-grad-brand text-sm font-bold text-white">
                  {c.author.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{c.author}</p>
                  <p className="text-2xs text-faint">{timeAgo(c.createdAt)}</p>
                </div>
                {c.rating ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-warning">
                    <Star className="h-3 w-3 fill-current" />
                    {c.rating}
                  </span>
                ) : null}
              </div>
              <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-muted">{c.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line py-10 text-center">
          <MessageSquare className="mb-2 h-8 w-8 text-faint" />
          <p className="text-sm font-medium text-ink">No comments yet</p>
          <p className="mt-1 text-xs text-muted">Be the first to share your experience.</p>
        </div>
      )}
    </div>
  );
}
