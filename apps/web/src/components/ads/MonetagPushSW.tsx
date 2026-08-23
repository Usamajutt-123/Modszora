'use client';

import { useEffect } from 'react';

/**
 * Monetag Push Notifications — service-worker-only variant (zone 11634922,
 * see public/sw.js).
 *
 * This replaces the old tag.min.js injection, which was click-hijacking the
 * download buttons (users needed 2-3 clicks to reach a real link). It does
 * exactly two things and injects NO ad script into the page:
 *
 *   1. Registers the Monetag service worker (`/sw.js`) so the push zone can
 *      deliver notifications to subscribed visitors.
 *   2. Triggers `Notification.requestPermission()` on the first user gesture.
 *      Browsers auto-reject prompts that fire without a user interaction, so
 *      the request waits for the first tap/click/keystroke instead of firing
 *      on mount.
 *
 * Because no script is injected, the download flow is never click-hijacked.
 */
let swRegistered = false;
let permissionPending = false;

export function MonetagPushSW() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Service workers only exist on secure contexts (HTTPS/localhost).
    if (!window.isSecureContext) return;

    if (!swRegistered && 'serviceWorker' in navigator) {
      swRegistered = true;
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* Ads are best-effort and must never break the page. */
      });
    }

    if (!('Notification' in window) || permissionPending) return;

    const requestPermission = () => {
      window.removeEventListener('pointerdown', requestPermission);
      window.removeEventListener('keydown', requestPermission);
      if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
      permissionPending = true;
      Notification.requestPermission().catch(() => {
        /* Best-effort only — permission failures must never break the page. */
      });
    };
    window.addEventListener('pointerdown', requestPermission, { once: true });
    window.addEventListener('keydown', requestPermission, { once: true });

    return () => {
      window.removeEventListener('pointerdown', requestPermission);
      window.removeEventListener('keydown', requestPermission);
    };
  }, []);

  return null;
}
