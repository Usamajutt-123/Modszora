import 'server-only';
import { env } from '@/lib/env';

/**
 * Server-side proxy to the agent API.
 *
 * The agent key never reaches the browser: admin pages call our own
 * /api/admin/agent/* routes, which attach the key here.
 */

export interface AgentCallResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status: number;
}

function agentBase(): string | null {
  const url = env.NEXT_PUBLIC_AGENT_URL;
  return url ? url.replace(/\/+$/, '') : null;
}

export function agentConfigured(): boolean {
  return Boolean(agentBase() && env.AGENT_API_KEY);
}

export async function callAgent<T = unknown>(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number } = {},
): Promise<AgentCallResult<T>> {
  const base = agentBase();
  if (!base) return { ok: false, error: 'NEXT_PUBLIC_AGENT_URL is not configured.', status: 503 };
  if (!env.AGENT_API_KEY) return { ok: false, error: 'AGENT_API_KEY is not configured.', status: 503 };

  const { method = 'GET', body, timeoutMs = 20_000 } = init;

  try {
    const res = await fetch(`${base}/api/${path.replace(/^\/+/, '')}`, {
      method,
      headers: {
        Authorization: `Bearer ${env.AGENT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });

    const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string } } | null;

    if (!res.ok || json?.ok === false) {
      return { ok: false, error: json?.error?.message ?? `Agent returned HTTP ${res.status}`, status: res.status };
    }
    return { ok: true, data: json?.data as T, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Agent request failed';
    const offline = /fetch failed|ECONNREFUSED|timed? ?out|aborted/i.test(message);
    return { ok: false, error: offline ? 'Agent is offline or unreachable.' : message, status: 503 };
  }
}
