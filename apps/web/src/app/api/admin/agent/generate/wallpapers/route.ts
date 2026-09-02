import { type NextRequest } from 'next/server';
import { wallpaperGenerateRequestSchema, slugify } from '@modverse/shared';
import { callAgent } from '@/lib/agent-client';
import { fail, ok, parseBody, requireAdminJson } from '@/lib/api-helpers';
import { getGameBySlug } from '@/lib/repositories/games';
import { adminUpsertWallpaper } from '@/lib/repositories/cms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { data, error } = await parseBody(req, wallpaperGenerateRequestSchema);
  if (error) return error;

  // 1. If external agent is configured, try calling it
  if (process.env.NEXT_PUBLIC_AGENT_URL) {
    const result = await callAgent('generate/wallpapers', { method: 'POST', body: data, timeoutMs: 30_000 });
    if (result.ok) return ok(result.data, 202);
  }

  // 2. Standalone fallback: generate wallpaper from game assets
  try {
    if (!data.gameSlug) {
      return fail('validation_error', 'gameSlug is required for wallpaper generation', 400);
    }

    const game = await getGameBySlug(data.gameSlug);
    if (!game) {
      return fail('not_found', `Game with slug "${data.gameSlug}" was not found.`, 404);
    }

    const imagesToProcess: string[] = [
      game.banner?.url,
      ...(game.screenshots || []).map((s) => s.url),
      game.icon?.url,
    ].filter((u): u is string => Boolean(u));

    const maxCount = Math.min(data.maxCount ?? 4, imagesToProcess.length);
    let createdCount = 0;

    for (let i = 0; i < maxCount; i++) {
      const imgUrl = imagesToProcess[i];
      if (!imgUrl) continue;
      const wpSlug = slugify(`${game.slug}-wallpaper-${i + 1}`);
      const title = `${game.name} - HD Wallpaper ${i + 1}`;

      await adminUpsertWallpaper({
        title,
        slug: wpSlug,
        category: (data.category as any) || 'games',
        tags: [game.category, 'hd-wallpaper', 'gaming', '4k'],
        image: {
          url: imgUrl,
          width: 1920,
          height: 1080,
          format: 'jpeg',
          bytes: 0,
        },
        thumbnail: {
          url: imgUrl,
          width: 480,
          height: 270,
          format: 'jpeg',
          bytes: 0,
        },
        resolution: '1920x1080',
        width: 1920,
        height: 1080,
        downloads: 0,
        views: 0,
        featured: i === 0,
        trending: false,
        gameSlug: game.slug,
        sourceUrl: null,
        status: data.autoPublish ? 'published' : 'draft',
        publishedAt: data.autoPublish ? new Date().toISOString() : null,
        scheduledFor: null,
        seo: {
          title: `${title} | Modszora Free Download`,
          description: `Download high quality 4K/HD wallpaper for ${game.name}. Perfect for mobile and desktop screens.`,
          canonical: `https://modszora.site/wallpapers/${wpSlug}`,
          keywords: [game.name, 'wallpaper', '4k wallpaper', 'hd gaming wallpaper'],
          twitterCard: 'summary_large_image',
          noindex: false,
        },
      });
      createdCount++;
    }

    return ok({ action: 'generated', count: createdCount, gameSlug: game.slug }, 200);
  } catch (err) {
    return fail('generation_error', err instanceof Error ? err.message : 'Wallpaper generation failed', 500);
  }
}
