'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface PollingState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Minimal polling fetcher (a tiny SWR substitute).
 *
 * - Aborts in-flight requests on unmount and between polls.
 * - Pauses while the tab is hidden so background tabs cost nothing.
 * - Keeps the last good value visible while refetching.
 */
export default function usePolling<T>(url: string | null, intervalMs = 10_000): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const fetchOnce = useCallback(async () => {
    if (!url) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!mounted.current) return;

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
      }
      setData((json?.data ?? json) as T);
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err : new Error('Request failed'));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    mounted.current = true;
    if (!url) {
      setLoading(false);
      return;
    }

    const tick = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        await fetchOnce();
      }
      if (mounted.current && intervalMs > 0) {
        timerRef.current = setTimeout(tick, intervalMs);
      }
    };

    void tick();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchOnce();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      mounted.current = false;
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [url, intervalMs, fetchOnce]);

  return { data, error, loading, refresh: fetchOnce };
}
