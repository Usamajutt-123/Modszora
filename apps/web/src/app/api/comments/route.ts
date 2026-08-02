import { NextResponse, type NextRequest } from 'next/server';
import { commentSchema, RATE_LIMITS } from '@modverse/shared';
import { sha256 } from '@modverse/shared/hash';
import { getAdminClient } from '@/lib/supabase/server';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { isDemoMode } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Very small spam heuristic — link-heavy or shouty bodies get flagged. */
function looksLikeSpam(body: string): boolean {
  const links = (body.match(/https?:\/\//gi) ?? []).length;
  if (links >= 2) return true;
  const letters = body.replace(/[^a-z]/gi, '');
  const upper = body.replace(/[^A-Z]/g, '');
  if (letters.length > 20 && upper.length / letters.length > 0.6) return true;
  if (/\b(casino|viagra|crypto giveaway|free robux|telegram bot)\b/i.test(body)) return true;
  return false;
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'comments', { windowMs: 60_000, max: 5 });
  if (limited) return limited;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'bad_json', message: 'Invalid JSON body.' } }, { status: 400 });
  }

  const parsed = commentSchema.omit({ status: true }).safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: 'validation_error', message: 'Invalid comment.', details: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  const comment = parsed.data;
  const status = looksLikeSpam(comment.body) ? 'spam' : 'approved';

  if (isDemoMode()) {
    return NextResponse.json({
      ok: true,
      data: { status, message: 'Demo mode: comment accepted but not persisted.' },
    });
  }

  const db = getAdminClient();
  if (!db) {
    return NextResponse.json(
      { ok: false, error: { code: 'not_configured', message: 'Comments are not available right now.' } },
      { status: 503 },
    );
  }

  const { error } = await db.from('comments').insert({
    game_slug: comment.gameSlug,
    author: comment.author,
    email: comment.email ?? null,
    body: comment.body,
    rating: comment.rating ?? null,
    status,
    ip_hash: sha256(`${clientIp(req)}:${comment.gameSlug}`).slice(0, 32),
  });
  if (status === "approved" && comment.rating) {
    const { data: ratings } = await db
      .from("comments")
      .select("rating")
      .eq("game_slug", comment.gameSlug)
      .eq("status", "approved");

    const ratingCount = ratings?.length ?? 0;

    const average =
      ratingCount > 0
        ? (ratings ?? []).reduce((sum, row) => sum + (row.rating ?? 0), 0) / ratingCount
        : 0;
    await db
      .from("games")
      .update({
        rating: Number(average.toFixed(1)),
        rating_count: ratingCount,
      })
      .eq("slug", comment.gameSlug);
  }

  if (error) {
    console.error('[comments.POST]', error.message);
    return NextResponse.json({ ok: false, error: { code: 'db_error', message: 'Could not save comment.' } }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { status, message: 'Comment submitted for moderation.' } });
}
