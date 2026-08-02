'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

type State = 'idle' | 'loading' | 'done' | 'error';

export function NewsletterForm({ className }: { className?: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === 'loading') return;
    setState('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Subscription failed');
      setState('done');
      setMessage("You're on the list. Check your inbox to confirm.");
      setEmail('');
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  if (state === 'done') {
    return (
      <div className={cn('flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 p-4', className)}>
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
        <p className="text-sm font-medium text-success">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={cn('w-full', className)} noValidate>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state === 'error') setState('idle');
            }}
            placeholder="you@example.com"
            aria-label="Email address"
            aria-invalid={state === 'error'}
            className="input pl-10"
          />
        </div>
        <button type="submit" disabled={state === 'loading'} className="btn-primary btn shrink-0 sm:px-6">
          {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Subscribe
        </button>
      </div>
      {state === 'error' ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {message}
        </p>
      ) : (
        <p className="mt-2 text-2xs text-faint">We respect your inbox. Unsubscribe in one click.</p>
      )}
    </form>
  );
}
