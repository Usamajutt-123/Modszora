import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/api/', '/*?*sort=', '/*?*page='],
      },
      // Give the major crawlers an explicit, unambiguous rule set.
      { userAgent: 'Googlebot', allow: '/', disallow: ['/admin/', '/api/'] },
      { userAgent: 'Bingbot', allow: '/', disallow: ['/admin/', '/api/'], crawlDelay: 1 },
      { userAgent: 'GPTBot', allow: '/', disallow: ['/admin/', '/api/'] },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
