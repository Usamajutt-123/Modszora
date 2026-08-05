import type { Metadata } from 'next';
import { env, siteUrl } from '@/lib/env';
import type { Seo } from '@modverse/shared';

const DEFAULT_OG = '/og-default.png';

export interface BuildMetaInput {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  image?: string | null;
  type?: 'website' | 'article';
  publishedTime?: string | null;
  modifiedTime?: string | null;
  authors?: string[];
  noindex?: boolean;
  canonical?: string | null;
}

/** Single source of truth for page metadata — keeps OG/Twitter consistent. */
export function buildMetadata(input: BuildMetaInput): Metadata {
  const base = siteUrl();
  const siteName = env.NEXT_PUBLIC_SITE_NAME || 'MODSzora';
  const url = input.canonical ?? `${base}${input.path.startsWith('/') ? input.path : `/${input.path}`}`;
  const image = input.image || `${base}${DEFAULT_OG}`;
  const title = input.title.length > 65 ? `${input.title.slice(0, 62)}…` : input.title;

  return {
    title,
    description: input.description,
    keywords: input.keywords?.length ? input.keywords : undefined,
    metadataBase: new URL(base),
    alternates: { canonical: url },
    robots: input.noindex
      ? { index: false, follow: false, nocache: true }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
        },
    openGraph: {
      type: input.type ?? 'website',
      title,
      description: input.description,
      url,
      siteName,
      locale: 'en_US',
      images: [{ url: image, width: 1200, height: 630, alt: title }],
      ...(input.type === 'article'
        ? {
            publishedTime: input.publishedTime ?? undefined,
            modifiedTime: input.modifiedTime ?? undefined,
            authors: input.authors,
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: input.description,
      images: [image],
      creator: '@modszora',
    },
  };
}

/** Converts a stored SEO object into Next metadata. */
export function seoToMetadata(seo: Partial<Seo>, path: string, fallback: { title: string; description: string }): Metadata {
  return buildMetadata({
    title: seo.title || fallback.title,
    description: seo.description || fallback.description,
    path,
    keywords: seo.keywords ?? [],
    image: seo.ogImage ?? null,
    canonical: seo.canonical ?? null,
    noindex: seo.noindex ?? false,
  });
}

/** Renders a JSON-LD script tag. Arrays are emitted as a @graph. */
export function jsonLdScript(data: Record<string, unknown> | Array<Record<string, unknown>>): string {
  const payload = Array.isArray(data)
    ? { '@context': 'https://schema.org', '@graph': data.map(({ '@context': _c, ...rest }) => rest) }
    : data;
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}
