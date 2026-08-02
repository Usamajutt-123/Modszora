import { getCmsTotals, getTrafficSeries } from '@/lib/repositories/cms';
import { ok, requireAdminJson } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdminJson();
  if (denied) return denied;
  const [totals, series] = await Promise.all([getCmsTotals(), getTrafficSeries(14)]);
  return ok({ totals, series });
}
