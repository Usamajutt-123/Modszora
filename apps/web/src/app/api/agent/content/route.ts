import { NextResponse, type NextRequest } from 'next/server';
import { contentPublishSchema, RATE_LIMITS, type ContentPublishResponse } from '@modverse/shared';
import { guardAgentRoute } from '@/lib/auth';
import { adminUpsertPost, adminUpsertReview, adminUpsertWallpaper } from '@/lib/repositories/cms';
import { rateLimit } from '@/lib/rate-limit';
import { isDemoMode } from '@/lib/env';
import { revalidateContent } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Content publish endpoint for the agent (wallpapers, reviews, blog posts).
 *
 * The game equivalent lives at /api/agent/publish. Both share the same
 * contract: bearer-token auth, strict schema validation, and ISR
 * revalidation of every affected public path.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'agent-content', RATE_LIMITS.agentApi);
  if (limited) return limited;

  const unauthorized = guardAgentRoute(req);
  if (unauthorized) return unauthorized;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, action: 'skipped', message: 'Invalid JSON body.' } satisfies ContentPublishResponse,
      { status: 400 },
    );
  }

  const parsed = contentPublishSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join('.')}: ${i.message}`);
    return NextResponse.json(
      {
        ok: false,
        action: 'skipped',
        message: `Validation failed → ${issues.join(' | ')}`,
      } satisfies ContentPublishResponse,
      { status: 422 },
    );
  }

  const payload = parsed.data;

  if (payload.dryRun) {
    return NextResponse.json({
      ok: true,
      action: 'dry-run',
      slug: (payload.data as { slug: string }).slug,
      message: 'Dry run — nothing was written.',
    } satisfies ContentPublishResponse);
  }

  if (isDemoMode()) {
    return NextResponse.json(
      {
        ok: false,
        action: 'skipped',
        message: 'Demo mode: Supabase is not configured, so publishing is disabled.',
      } satisfies ContentPublishResponse,
      { status: 503 },
    );
  }

  try {
    switch (payload.kind) {
      case 'wallpaper': {
        const result = await adminUpsertWallpaper(payload.data);
        if (!result.ok) throw new Error(result.error ?? 'Wallpaper upsert failed');
        revalidateContent('wallpaper', result.slug);
        return NextResponse.json(
          { ok: true, action: 'created', id: result.id, slug: result.slug } satisfies ContentPublishResponse,
          { status: 201 },
        );
      }
      case 'review': {
        const result = await adminUpsertReview(payload.data);
        if (!result.ok) throw new Error(result.error ?? 'Review upsert failed');
        revalidateContent('review', result.slug);
        if (payload.data.gameSlug) revalidateContent('game', payload.data.gameSlug);
        return NextResponse.json(
          { ok: true, action: 'created', id: result.id, slug: result.slug } satisfies ContentPublishResponse,
          { status: 201 },
        );
      }
      case 'post': {
        const result = await adminUpsertPost(payload.data);
        if (!result.ok) throw new Error(result.error ?? 'Post upsert failed');
        revalidateContent('post', result.slug);
        return NextResponse.json(
          { ok: true, action: 'created', id: result.id, slug: result.slug } satisfies ContentPublishResponse,
          { status: 201 },
        );
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown database error';
    console.error('[agent.content]', message);
    return NextResponse.json({ ok: false, action: 'skipped', message } satisfies ContentPublishResponse, {
      status: 500,
    });
  }
}
