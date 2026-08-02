import type { FaqItem, Game, Review, BlogPost } from './schemas.js';
import { formatBytes } from './utils.js';

export interface SiteContext {
  siteUrl: string;
  siteName: string;
  twitterHandle?: string;
  logoUrl?: string;
}

const iso = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

export function absolute(siteUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/* ───────────────────────── JSON-LD builders ───────────────────────── */

export function organizationJsonLd(ctx: SiteContext): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${ctx.siteUrl}/#organization`,
    name: ctx.siteName,
    url: ctx.siteUrl,
    logo: ctx.logoUrl ? { '@type': 'ImageObject', url: ctx.logoUrl } : undefined,
  };
}

export function websiteJsonLd(ctx: SiteContext): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${ctx.siteUrl}/#website`,
    name: ctx.siteName,
    url: ctx.siteUrl,
    publisher: { '@id': `${ctx.siteUrl}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${ctx.siteUrl}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(ctx: SiteContext, crumbs: Crumb[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absolute(ctx.siteUrl, c.path),
    })),
  };
}

export function faqJsonLd(faqs: FaqItem[]): Record<string, unknown> | null {
  if (!faqs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

/** SoftwareApplication schema — the canonical schema for an APK listing. */
export function gameJsonLd(ctx: SiteContext, game: Game): Record<string, unknown> {
  const url = absolute(ctx.siteUrl, `/game/${game.slug}`);
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${url}#app`,
    name: game.name,
    alternateName: game.originalName ?? undefined,
    url,
    description: game.seo.description || game.shortDescription,
    applicationCategory: 'GameApplication',
    applicationSubCategory: game.category,
    operatingSystem: `Android ${game.androidVersion}`,
    softwareVersion: game.version,
    fileSize: formatBytes(game.sizeBytes),
    datePublished: iso(game.releaseDate) ?? iso(game.publishedAt),
    dateModified: iso(game.updatedDate) ?? iso(game.publishedAt),
    image: game.icon?.url ?? game.banner?.url,
    screenshot: game.screenshots.slice(0, 8).map((s) => s.url),
    downloadUrl: absolute(ctx.siteUrl, `/download/${game.slug}`),
    installUrl: game.playStoreUrl ?? undefined,
    author: { '@type': 'Organization', name: game.developer },
    publisher: { '@type': 'Organization', name: game.publisher ?? game.developer },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url,
    },
  };
  if (game.rating > 0 && game.ratingCount > 0) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(game.rating.toFixed(1)),
      ratingCount: game.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }
  return node;
}

export function reviewJsonLd(ctx: SiteContext, review: Review, gameName?: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    '@id': `${absolute(ctx.siteUrl, `/reviews/${review.slug}`)}#review`,
    name: review.title,
    headline: review.title,
    reviewBody: review.summary,
    datePublished: iso(review.publishedAt),
    author: { '@type': 'Person', name: review.author },
    publisher: { '@type': 'Organization', name: ctx.siteName },
    itemReviewed: {
      '@type': 'SoftwareApplication',
      name: gameName ?? review.title,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Android',
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: Number(review.score.toFixed(1)),
      bestRating: 10,
      worstRating: 0,
    },
    positiveNotes: { '@type': 'ItemList', itemListElement: review.pros.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p })) },
    negativeNotes: { '@type': 'ItemList', itemListElement: review.cons.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c })) },
  };
}

export function articleJsonLd(ctx: SiteContext, post: BlogPost): Record<string, unknown> {
  const url = absolute(ctx.siteUrl, `/blog/${post.slug}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: post.title,
    description: post.excerpt,
    url,
    mainEntityOfPage: url,
    image: post.cover?.url,
    datePublished: iso(post.publishedAt),
    dateModified: iso(post.publishedAt),
    articleSection: post.category,
    keywords: post.tags.join(', '),
    wordCount: post.content.trim().split(/\s+/).length,
    author: { '@type': 'Person', name: post.author },
    publisher: { '@id': `${ctx.siteUrl}/#organization` },
  };
}

export function itemListJsonLd(
  ctx: SiteContext,
  items: Array<{ name: string; path: string; image?: string | null }>,
  listName: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: absolute(ctx.siteUrl, item.path),
      image: item.image ?? undefined,
    })),
  };
}

/* ───────────────────── heuristic SEO fallbacks ───────────────────── */

/** Deterministic SEO used when OpenAI is unavailable — never leaves fields empty. */
export function fallbackGameSeo(game: {
  name: string;
  version: string;
  developer: string;
  category: string;
  shortDescription?: string;
  modFeatures?: string[];
}): { title: string; description: string; keywords: string[] } {
  const year = new Date().getFullYear();
  const title = `${game.name} MOD APK ${game.version} (${(game.modFeatures?.[0] ?? 'Unlimited Money').replace(/[.,]$/, '')})`;
  const description =
    game.shortDescription?.slice(0, 175) ??
    `Download ${game.name} MOD APK v${game.version} for Android — ${game.modFeatures?.slice(0, 2).join(', ') ?? 'premium unlocked'}. Free, safe and updated ${year}.`;
  const keywords = [
    `${game.name.toLowerCase()} mod apk`,
    `${game.name.toLowerCase()} hack`,
    `download ${game.name.toLowerCase()}`,
    `${game.name.toLowerCase()} ${game.version}`,
    `${game.category} mod apk`,
    `${game.developer.toLowerCase()} games`,
    `mod apk ${year}`,
    'android mod games',
    'unlimited money apk',
  ];
  return { title: title.slice(0, 70), description: description.slice(0, 180), keywords };
}

/**
 * Auto internal linking: converts known anchors inside HTML/markdown-ish text
 * into internal links, at most once per anchor, skipping existing anchors.
 */
export function autoInternalLink(
  content: string,
  links: Array<{ anchor: string; href: string }>,
  maxPerAnchor = 1,
): string {
  let output = content;
  const used = new Map<string, number>();
  const sorted = [...links].sort((a, b) => b.anchor.length - a.anchor.length);

  for (const { anchor, href } of sorted) {
    if (!anchor || anchor.length < 3) continue;
    const count = used.get(anchor) ?? 0;
    if (count >= maxPerAnchor) continue;
    const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Skip anchors already inside a link or heading.
    const re = new RegExp(`(?<!\\[)(?<!href="[^"]{0,200})\\b(${escaped})\\b(?![^<]*<\\/a>)`, 'i');
    if (!re.test(output)) continue;
    output = output.replace(re, `<a href="${href}" class="modverse-inline-link">$1</a>`);
    used.set(anchor, count + 1);
  }
  return output;
}
