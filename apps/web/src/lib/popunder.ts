/**
 * Monetag Popunder — fires from a download-button click, EVERY time.
 *
 * The Monetag loader (https://quge5.com/88/tag.min.js, zone 272339) is
 * injected synchronously inside the click handler. A popunder opened outside
 * a genuine user gesture is silently discarded by browsers, so this MUST run
 * directly off the click. The download link always keeps working, so every
 * failure path (missing DOM, ad blocker) is swallowed.
 *
 * There is deliberately NO frequency cap on this side: the loader is
 * re-injected on every download click, so a visitor who downloads several
 * games triggers the popunder each time. Any capping is left to Monetag's
 * own zone settings — nothing here throttles it.
 */

/** Monetag popunder loader URL and zone (account-specific, hardcoded). */
const POPUNDER_SRC = 'https://quge5.com/88/tag.min.js';
const POPUNDER_ZONE = '272339';

/** Stable element id — lets us replace (not pile up) scripts across clicks. */
const POPUNDER_SCRIPT_ID = 'monetag-popunder';

/**
 * Injects the Monetag popunder loader. Called from the download-button click
 * handler; re-injects on every call so each download attempt fires it.
 */
export function firePopunder(): void {
  try {
    // Tidy up any loader injected on a previous download click before adding a
    // fresh one, so repeated clicks don't accumulate stale nodes in <head>.
    document.getElementById(POPUNDER_SCRIPT_ID)?.remove();
  } catch {
    /* DOM unavailable — fail open. */
  }

  try {
    const s = document.createElement('script');
    s.id = POPUNDER_SCRIPT_ID;
    s.src = POPUNDER_SRC;
    s.async = true;
    s.dataset.zone = POPUNDER_ZONE;
    s.dataset.cfasync = 'false';
    document.head.appendChild(s);
  } catch {
    /* Popunder is best-effort — the download link must still work. */
  }
}
