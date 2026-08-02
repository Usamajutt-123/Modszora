import { NextResponse, type NextRequest } from 'next/server';
import { publishRequestSchema, RATE_LIMITS, type PublishResponse } from '@modverse/shared';
import { guardAgentRoute } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabase/server';
import { gameToRow } from '@/lib/mappers';
import { rateLimit } from '@/lib/rate-limit';
import { isDemoMode } from '@/lib/env';
import { revalidatePath, revalidateTag } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * The agent's publish endpoint.
 *
 * This is the ONLY way the agent writes content, and it performs the same
 * validation an admin form would: schema validation, duplicate detection,
 * and an update-vs-create decision based on the Android package name.
 */
export async function POST(req: NextRequest): Promise<NextResponse<PublishResponse | { ok: false; error: unknown }>> {
  const limited = rateLimit(req, 'agent-publish', RATE_LIMITS.agentApi);
  if (limited) return limited as NextResponse<never>;

  const unauthorized = guardAgentRoute(req);
  if (unauthorized) return unauthorized as NextResponse<never>;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, action: 'skipped', changes: [], message: 'Invalid JSON body.' } satisfies PublishResponse,
      { status: 400 },
    );
  }

  const parsed = publishRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join('.')}: ${i.message}`);
    return NextResponse.json(
      {
        ok: false,
        action: 'skipped',
        changes: [],
        message: `Validation failed → ${issues.join(' | ')}`,
      } satisfies PublishResponse,
      { status: 422 },
    );
  }

  const { game, review, mode, dryRun, changeSummary } = parsed.data;

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      action: 'dry-run',
      slug: game.slug,
      changes: changeSummary,
      message: 'Dry run — nothing was written.',
    } satisfies PublishResponse);
  }

  if (isDemoMode()) {
    return NextResponse.json(
      {
        ok: false,
        action: 'skipped',
        changes: [],
        message: 'Demo mode: Supabase is not configured, so publishing is disabled.',
      } satisfies PublishResponse,
      { status: 503 },
    );
  }

  const db = getAdminClient();
  if (!db) {
    return NextResponse.json(
      { ok: false, action: 'skipped', changes: [], message: 'Service role key not configured.' } satisfies PublishResponse,
      { status: 503 },
    );
  }

  // ── duplicate detection: package name is the app's true identity ──
  const { data: existing } = await db
    .from('games')
    .select('id, slug, version, content_hash, status')
    .eq('package_name', game.packageName)
    .maybeSingle();

  const row = gameToRow(game);

  try {
    if (existing) {
      if (mode === 'create') {
        return NextResponse.json({
          ok: true,
          action: 'skipped',
          gameId: existing.id,
          slug: existing.slug,
          changes: [],
          message: 'A listing with this package name already exists.',
        } satisfies PublishResponse);
      }

      // Unchanged content → no write, no cache churn.
      if (existing.content_hash && existing.content_hash === game.contentHash) {
        return NextResponse.json({
          ok: true,
          action: 'skipped',
          gameId: existing.id,
          slug: existing.slug,
          changes: [],
          message: 'Content fingerprint unchanged.',
        } satisfies PublishResponse);
      }

      // Never rewrite the slug of a live page, and never reset counters.
      delete row.slug;
      delete row.downloads;
      delete row.views;
      delete row.rating_count;

      const { error } = await db.from('games').update(row).eq('id', existing.id);
      if (error) throw new Error(error.message);

      revalidatePath(`/game/${existing.slug}`);
      revalidatePath(`/download/${existing.slug}`);
      revalidatePath('/');
      revalidatePath('/browse');
      revalidateTag('games');

      return NextResponse.json({
        ok: true,
        action: 'updated',
        gameId: existing.id,
        slug: existing.slug,
        changes: changeSummary,
        message: `Updated ${game.name}.`,
      } satisfies PublishResponse);
    }

    // ── create ──
    const { data: created, error } = await db.from('games').insert(row).select('id, slug').single();
    if (error) {
      // Unique violation: another worker inserted the same package concurrently.
      if (error.code === '23505') {
        return NextResponse.json({
          ok: true,
          action: 'skipped',
          changes: [],
          message: 'Duplicate detected during insert (race) — skipped.',
        } satisfies PublishResponse);
      }
      throw new Error(error.message);
    }

    if (review) {
      await db.from('reviews').upsert(
        {
          slug: review.slug,
          title: review.title,
          game_id: created.id,
          game_slug: created.slug,
          summary: review.summary,
          body: review.body,
          score: review.score,
          score_breakdown: review.scoreBreakdown,
          pros: review.pros,
          cons: review.cons,
          verdict: review.verdict,
          cover: review.cover,
          author: review.author,
          status: review.status,
          published_at: review.publishedAt,
          seo: review.seo,
        },
        { onConflict: 'slug' },
      );
    }

    revalidatePath('/');
    revalidatePath('/browse');
    revalidatePath(`/game/${created.slug}`);
    revalidateTag('games');

    return NextResponse.json(
      {
        ok: true,
        action: 'created',
        gameId: created.id,
        slug: created.slug,
        changes: changeSummary.length ? changeSummary : ['New listing'],
        message: `Created ${game.name}.`,
      } satisfies PublishResponse,
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown database error';
    console.error('[agent.publish]', message);
    return NextResponse.json(
      { ok: false, action: 'skipped', changes: [], message } satisfies PublishResponse,
      { status: 500 },
    );
  }
}
