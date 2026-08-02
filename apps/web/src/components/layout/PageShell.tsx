import type { ReactNode } from 'react';
import type { Crumb } from '@modverse/shared';
import { breadcrumbJsonLd } from '@modverse/shared';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { jsonLdScript } from '@/lib/metadata';
import { env, siteUrl } from '@/lib/env';

/** Shared shell for simple content pages (legal, about, contact, FAQ). */
export function PageShell({
  title,
  intro,
  crumbs,
  children,
  wide = false,
}: {
  title: string;
  intro?: string;
  crumbs: Crumb[];
  children: ReactNode;
  wide?: boolean;
}) {
  const ctx = { siteUrl: siteUrl(), siteName: env.NEXT_PUBLIC_SITE_NAME || 'MODVerse' };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(ctx, crumbs)) }} />
      <div className={`container py-8 ${wide ? '' : 'max-w-3xl'}`}>
        <Breadcrumbs crumbs={crumbs} className="mb-5" />
        <h1 className="text-display-sm font-extrabold">{title}</h1>
        {intro ? <p className="mt-3 text-base leading-relaxed text-muted">{intro}</p> : null}
        <div className="mt-8">{children}</div>
      </div>
    </>
  );
}
