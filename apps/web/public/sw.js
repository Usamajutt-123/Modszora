/*
 * Monetag service worker.
 *
 * Served from the site root as /sw.js so its registration scope covers the
 * whole origin — Monetag requires exactly this path and scope, both for
 * site-ownership verification and for delivering push notifications.
 *
 * This file is intentionally static (no env interpolation) because anything
 * under public/ is copied verbatim by Next.js and never passed through the
 * bundler. It is completely inert until something calls
 * navigator.serviceWorker.register('/sw.js') — see
 * src/components/ads/MonetagScript.tsx, which only does so when
 * NEXT_PUBLIC_MONETAG_ZONE_ID is configured.
 *
 * Keep the three globals below assigned BEFORE importScripts: the imported
 * worker reads them at evaluation time.
 */
self.options = {
  domain: '5gvci.com',
  zoneId: 11630231,
};

self.lary = '';

importScripts('https://5gvci.com/act/files/service-worker.min.js?r=sw');
