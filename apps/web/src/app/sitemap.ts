import type { MetadataRoute } from 'next';
import { GAME_CATEGORIES, GAME_COLLECTIONS, BLOG_CATEGORIES, WALLPAPER_CATEGORIES } from '@modverse/shared';
import { getAllGameSlugs } from '@/lib/repositories/games';
import { getAllPostSlugs, getAllReviewSlugs, getAllWallpaperSlugs } from '@/lib/repositories/content';
import { siteUrl } from '@/lib/env';

export const revalidate = 3600;

/**
 * Full sitemap. Priorities are tuned so game pages (the money pages)
 * outrank taxonomy pages, which outrank static/legal pages.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const [games, wallpapers, reviews, posts] = await Promise.all([
    getAllGameSlugs(),
    getAllWallpaperSlugs(),
    getAllReviewSlugs(),
    getAllPostSlugs(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/browse`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/search`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${base}/reviews`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/wallpapers`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/dmca`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const taxonomyRoutes: MetadataRoute.Sitemap = [
    ...GAME_CATEGORIES.map((c) => ({
      url: `${base}/category/${c}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.75,
    })),
    ...GAME_COLLECTIONS.map((c) => ({
      url: `${base}/collection/${c}`,
      lastModified: now,
      changeFrequency: 'hourly' as const,
      priority: 0.8,
    })),
    ...BLOG_CATEGORIES.map((c) => ({
      url: `${base}/blog/category/${c}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
    ...WALLPAPER_CATEGORIES.map((c) => ({
      url: `${base}/wallpapers/category/${c}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  ];

  const gameRoutes: MetadataRoute.Sitemap = games.flatMap(({ slug, updatedAt }) => [
    {
      url: `${base}/game/${slug}`,
      lastModified: new Date(updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${base}/download/${slug}`,
      lastModified: new Date(updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
  ]);

  const contentRoutes: MetadataRoute.Sitemap = [
    ...reviews.map((slug) => ({
      url: `${base}/reviews/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...posts.map((slug) => ({
      url: `${base}/blog/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...wallpapers.map((slug) => ({
      url: `${base}/wallpapers/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];

  return [...staticRoutes, ...taxonomyRoutes, ...gameRoutes, ...contentRoutes];
}
