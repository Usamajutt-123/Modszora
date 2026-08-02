import { NextResponse, type NextRequest } from 'next/server';
import { searchSuggestions } from '@/lib/repositories/games';
import { rateLimit } from '@/lib/rate-limit';
import { RATE_LIMITS } from '@modverse/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Typeahead endpoint used by the header search bar. */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 'search', RATE_LIMITS.search);
  if (limited) return limited;

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80);
  if (q.length < 2) {
    return NextResponse.json({ ok: true, data: { items: [] } });
  }

  const games = await searchSuggestions(q, 8);
  const items = games.map((g) => ({
    slug: g.slug,
    name: g.name,
    developer: g.developer,
    icon: g.icon?.url ?? null,
    version: g.version,
    sizeBytes: g.sizeBytes,
    rating: g.rating,
  }));

  return NextResponse.json(
    { ok: true, data: { items } },
    { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=120' } },
  );
}
