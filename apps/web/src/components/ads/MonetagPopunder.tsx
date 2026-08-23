'use client';

import { useEffect } from 'react';

/**
 * Monetag Popunder — zone 11634583.
 *
 * Mounted ONLY inside the download flow (DownloadCountdown), so the tag
 * loads exclusively on /download/[slug] pages — the rest of the site never
 * loads it. Monetag's own script then catches the user's click (the
 * download-button click) and fires the popunder itself while the browser's
 * user-gesture window is still valid. Injecting the loader inside a click
 * handler instead would arrive too late and get silently blocked — that was
 * the old bug.
 *
 * Equivalent of the official snippet:
 *   <script>(function(s){s.dataset.zone='11634583',s.src='https://al5sm.com/tag.min.js'})
 *   ([document.documentElement, document.body].filter(Boolean).pop()
 *   .appendChild(document.createElement('script')))</script>
 *
 * Frequency/capping is controlled entirely by Monetag's zone settings.
 */

const ZONE = '11634583';
const SRC = 'https://al5sm.com/tag.min.js';
const SCRIPT_ID = 'monetag-popunder';

export function MonetagPopunder() {
  useEffect(() => {
    // Guard: never double-inject (React Strict Mode / remounts).
    if (document.getElementById(SCRIPT_ID)) return;

    try {
      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.dataset.zone = ZONE;
      s.src = SRC;
      s.async = true;
      (document.body || document.documentElement).appendChild(s);
    } catch {
      /* Ad is best-effort — never break the page. */
    }
  }, []);

  return null;
}
