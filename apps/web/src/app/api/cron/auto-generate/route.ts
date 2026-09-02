import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminClient } from '@/lib/supabase/server';
import { adminUpsertPost, adminUpsertReview } from '@/lib/repositories/cms';
import { generateAutoBlog, generateAutoReview } from '@/lib/ai-generator';
import { safeCompare } from '@modverse/shared/crypto';
import { isDemoMode } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorised(req: NextRequest): boolean {
  const header = req.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const querySecret = req.nextUrl.searchParams.get('secret') ?? '';
  const cronSecret = process.env.CRON_SECRET;
  const agentKey = process.env.AGENT_API_KEY;

  if (cronSecret && (token === cronSecret || querySecret === cronSecret)) return true;
  if (agentKey && (token === agentKey || querySecret === agentKey)) return true;
  if (cronSecret && token && safeCompare(token, cronSecret)) return true;
  if (agentKey && token && safeCompare(token, agentKey)) return true;
  return req.headers.get('x-vercel-cron') === '1';
}

/**
 * Vercel Cron auto-generation endpoint:
 * Runs scheduled AI content generation with Gemini / OpenAI directly on Vercel.
 *
 * Query params:
 *  - type=blog    (default) -> generates 1 SEO guide / tutorial
 *  - type=news              -> generates 1 news roundup
 *  - type=review            -> generates 1 game review for an unreviewed game
 *  - type=all               -> generates 1 blog + 1 review
 */
export async function GET(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json({ ok: false, error: { code: 'unauthorized', message: 'Invalid cron secret.' } }, { status: 401 });
  }

  if (isDemoMode()) {
    return NextResponse.json({ ok: true, message: 'Demo mode active: skipping DB write.' });
  }

  const type = req.nextUrl.searchParams.get('type') || 'blog';
  const db = getAdminClient();
  const results: Record<string, unknown> = {};

  try {
    // 1. Fetch published games context
    let topGames: Array<{ slug: string; name: string; developer: string; category: string; version: string; mod_features: string[] }> = [];
    if (db) {
      const { data } = await db
        .from('games')
        .select('slug, name, developer, category, version, mod_features')
        .eq('status', 'published')
        .order('downloads', { ascending: false })
        .limit(20);
      topGames = (data ?? []) as typeof topGames;
    }

    // 2. Generate Blog or News
    if (type === 'blog' || type === 'news' || type === 'all') {
      const isNews = type === 'news';
      const blogPost = await generateAutoBlog({
        isNews,
        games: topGames.map((g) => g.name),
      });

      const saved = await adminUpsertPost(blogPost);
      results.blog = { ok: saved.ok, slug: saved.slug, title: blogPost.title };
      revalidatePath('/blog');
      revalidatePath(`/blog/${blogPost.slug}`);
    }

    // 3. Generate Game Review
    if (type === 'review' || type === 'all') {
      let candidateGame = topGames[0] || {
        slug: 'stumble-guys-mod-apk',
        name: 'Stumble Guys',
        developer: 'Scopely',
        category: 'arcade',
        version: '0.101',
        mod_features: ['All Skins Unlocked', 'Mod Menu'],
      };

      if (db && topGames.length > 0) {
        const { data: existingReviews } = await db.from('reviews').select('game_slug');
        const reviewedSlugs = new Set((existingReviews ?? []).map((r: { game_slug: string }) => r.game_slug).filter(Boolean));
        const unreviewed = topGames.find((g) => !reviewedSlugs.has(g.slug));
        if (unreviewed) candidateGame = unreviewed;
      }

      const review = await generateAutoReview({
        slug: candidateGame.slug,
        name: candidateGame.name,
        developer: candidateGame.developer,
        category: candidateGame.category,
        version: candidateGame.version,
        modFeatures: candidateGame.mod_features,
      });

      const savedReview = await adminUpsertReview(review);
      results.review = { ok: savedReview.ok, slug: savedReview.slug, title: review.title };
      revalidatePath('/reviews');
      revalidatePath(`/reviews/${review.slug}`);
      revalidatePath(`/game/${candidateGame.slug}`);
    }

    revalidatePath('/');
    revalidatePath('/sitemap.xml');

    return NextResponse.json({ ok: true, generated: results, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[cron.auto-generate]', err);
    return NextResponse.json(
      { ok: false, error: { code: 'generation_failed', message: err instanceof Error ? err.message : String(err) } },
      { status: 500 },
    );
  }
}
