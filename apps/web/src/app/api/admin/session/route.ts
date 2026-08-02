import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Confirms the current Supabase session belongs to an allow-listed admin.
 * Called immediately after sign-in so a valid-but-unauthorised account is
 * rejected instead of landing on the dashboard.
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: 'unauthorized', message: 'Not an authorised admin account.' } },
      { status: 401 },
    );
  }
  return NextResponse.json({ ok: true, data: { email: session.email, role: session.role } });
}
