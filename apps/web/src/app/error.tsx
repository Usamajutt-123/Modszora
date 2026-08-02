'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RotateCw } from 'lucide-react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app-error]', error);
  }, [error]);

  return (
    <div className="container flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-danger/30 bg-danger/10">
        <AlertTriangle className="h-8 w-8 text-danger" />
      </div>
      <h1 className="text-2xl font-bold md:text-3xl">Something went wrong</h1>
      <p className="mt-3 max-w-md text-sm text-muted">
        An unexpected error occurred while rendering this page. The issue has been logged.
      </p>
      {error.digest ? <code className="mt-3 rounded-md bg-surface-2 px-2 py-1 font-mono text-2xs text-faint">ref: {error.digest}</code> : null}
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary btn"><RotateCw className="h-4 w-4" />Try again</button>
        <Link href="/" className="btn-secondary btn"><Home className="h-4 w-4" />Go home</Link>
      </div>
    </div>
  );
}
