'use client';

import { useEffect } from 'react';
import { env } from '@/lib/env';

/**
 * Adsterra Popunder — fresh injection on every /download/[slug] page.
 *
 * We do NOT use next/script here: with a stable `id`, Next.js dedupes the
 * <script> across client-side navigations, so moving from /download/a to
 * /download/b never re-ran the script and the popunder only fired once per
 * client session.
 *
 * Instead this client component:
 *   1. Removes any previously-injected popunder script on every mount.
 *   2. Injects a BRAND NEW <script> pointing at the Adsterra invoke.js URL
 *      on every /download/[slug] page load.
 *   3. Adsterra's own invoke.js binds to the next user gesture on the page
 *      and opens the popunder under the current tab — which is exactly the
 *      download-button click.
 *
 * No localStorage / sessionStorage flag is set — every visit to a download
 * page fires the popunder on its first click. With the env var unset this
 * component is a complete no-op.
 */
export function PopunderScript() {
  useEffect(() => {
    const src = env.NEXT_PUBLIC_ADSTERRA_POPUNDER_SRC;
    if (!src) return;

    const SCRIPT_ID = 'adsterra-popunder';

    // Always start clean — remove any leftover script from a previous page.
    document.getElementById(SCRIPT_ID)?.remove();

    // Delete any global Adsterra may have left behind so the fresh script
    // re-initialises its click listener instead of no-op'ing.
    try {
      // @ts-expect-error - Adsterra attaches globals we cannot type.
      delete window.atOptions;
      // @ts-expect-error
      delete window.popunder;
      // @ts-expect-error
      delete window.PopUnder;
    } catch {
      /* non-fatal */
    }

    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.type = 'text/javascript';
    // Fresh <script> element on every /download/[slug] mount. The browser may
    // serve invoke.js from its cache, but Adsterra re-runs the script and
    // re-binds its one-click popunder listener for this page view.
    s.src = src;
    s.async = true;
    document.head.appendChild(s);

    return () => {
      // Clean up when leaving the download page so the next one starts fresh.
      document.getElementById(SCRIPT_ID)?.remove();
    };
  }, []);

  return null;
}
