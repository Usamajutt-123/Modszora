'use client';

import Script from 'next/script';
import { MONETAG_DOMAIN, MONETAG_TAG_SRC, hasMonetag } from '@/lib/ads';

/**
 * Monetag main tag (push notifications / in-page push).
 *
 * The Monetag stack has two halves and both are required:
 *
 *  1. `public/sw.js` — the service worker, served from the site root so its
 *     scope is the whole origin. Static, always present, but completely inert
 *     on its own.
 *  2. This tag — Monetag's loader, which calls
 *     `navigator.serviceWorker.register('/sw.js')`, shows the permission
 *     prompt and handles subscription. Without it the worker is never
 *     registered and no revenue is earned.
 *
 * Gated on NEXT_PUBLIC_MONETAG_ZONE_ID exactly like every Adsterra unit: with
 * the variable unset this renders nothing and makes zero network requests, so
 * local development and previews stay clean.
 *
 * `afterInteractive` keeps the loader off the critical rendering path, and the
 * stable `id` stops React Strict Mode from injecting it twice in development.
 * `data-cfasync="false"` is required by Monetag so Cloudflare Rocket Loader
 * does not defer or rewrite the tag.
 *
 * Mounted in the public route group only — never inside /admin.
 */
export function MonetagScript() {
  if (!hasMonetag()) return null;

  return (
    <>
      {/* Shaves a round trip off the loader fetch and the worker's importScripts. */}
      <link rel="preconnect" href={`https://${MONETAG_DOMAIN}`} crossOrigin="" />
      <Script id="monetag-tag" src={MONETAG_TAG_SRC} strategy="afterInteractive" data-cfasync="false" />
    </>
  );
}
