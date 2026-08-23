'use client';

import { useEffect } from 'react';

/** Monetag Push Notifications — zone 11634922. Download flow only. */
const SRC = 'https://5gvci.com/act/files/tag.min.js?z=11634922';
const SCRIPT_ID = 'monetag-push';

export function MonetagPush() {
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;

    try {
      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.src = SRC;
      s.async = true;
      s.dataset.cfasync = 'false';
      document.body.appendChild(s);
    } catch {
      /* Ads are best-effort and must never break the page. */
    }
  }, []);

  return null;
}
