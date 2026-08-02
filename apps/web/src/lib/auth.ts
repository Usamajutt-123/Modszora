import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { safeCompare } from '@modverse/shared/crypto';
import { adminEmails, env, hasSupabase } from '@/lib/env';
import { getServerClient } from '@/lib/supabase/server';

export interface AdminSession {
  id: string;
  email: string;
  role: 'admin';
}

/**
 * Resolves the current admin session.
 *
 * Admin access requires BOTH:
 *   1. a valid Supabase auth session, and
 *   2. the email present in ADMIN_EMAILS (or a row in admin_users).
 *
 * There is no public registration anywhere in the app, so this is the
 * single entry point for privileged access.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  if (!hasSupabase()) return null;

  const db = await getServerClient();
  if (!db) return null;

  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user?.email) return null;

  const email = user.email.toLowerCase();
  const allowlist = adminEmails();

  if (allowlist.length > 0 && allowlist.includes(email)) {
    return { id: user.id, email, role: 'admin' };
  }

  // Fall back to the admin_users table when no allowlist is configured.
  const { data: row } = await db.from('admin_users').select('id, email, role').eq('id', user.id).maybeSingle();
  if (row) return { id: user.id, email, role: 'admin' };

  return null;
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new AuthError('Admin authentication required', 401);
  return session;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number = 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Guard for admin API routes. Returns a 401 response, or null when allowed. */
export async function guardAdminRoute(): Promise<NextResponse | null> {
  const session = await getAdminSession();
  if (session) return null;
  return NextResponse.json(
    { ok: false, error: { code: 'unauthorized', message: 'Admin authentication required.' } },
    { status: 401 },
  );
}

/**
 * Verifies the shared secret used by the AI agent when calling
 * /api/agent/*. Uses constant-time comparison to avoid timing leaks.
 */
export function verifyAgentKey(req: NextRequest | Request): boolean {
  const expected = env.AGENT_API_KEY;
  if (!expected) return false;

  const header = req.headers.get('authorization') ?? '';
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const apiKey = req.headers.get('x-api-key')?.trim() ?? '';
  const provided = bearer || apiKey;
  if (!provided) return false;

  return safeCompare(provided, expected);
}

export function guardAgentRoute(req: NextRequest | Request): NextResponse | null {
  if (verifyAgentKey(req)) return null;
  return NextResponse.json(
    { ok: false, error: { code: 'unauthorized', message: 'Invalid or missing agent API key.' } },
    { status: 401 },
  );
}
