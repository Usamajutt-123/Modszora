import { type NextRequest } from 'next/server';
import { listSuggestions } from '@/lib/repositories/cms';
import { ok, requireAdminJson } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 100) || 100, 300);
  const items = await listSuggestions(limit);
  return ok({ items, count: items.length });
}
