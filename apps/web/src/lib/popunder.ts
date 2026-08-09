/**
 * Adsterra Popunder — fires only from a download-button click, and only the
 * first time for a given visitor.
 *
 * The URL is a full absolute `https://` script URL (no key/domain split),
 * read statically so Next.js inlines it into the client bundle at build
 * time. With the env var unset this module is a complete no-op: no script,
 * no request, no error.
 *
 * The injection must happen synchronously inside the click handler — a
 * popunder opened outside a genuine user gesture is silently discarded by
 * browsers. The download link must always keep working, so every failure
 * path (blocked storage, missing DOM, ad blocker) is swallowed.
 */

/** Full Adsterra popunder script URL. Static lookup — never build the key dynamically. */
const POPUNDER_SRC = process.env.NEXT_PUBLIC_ADSTERRA_POPUNDER_SRC || undefined;

/** Stable element id — guards against injecting twice within one page view. */
const POPUNDER_SCRIPT_ID = 'adsterra-popunder';

/** localStorage flag that marks this visitor as already having fired it. */
const POPUNDER_FIRED_KEY = 'mv_pu_fired';

/**
 * Injects the popunder script. First click per visitor only; the flag is
 * persisted in localStorage so it survives page views, games and tabs.
 */
export function firePopunder(): void {
  if (!POPUNDER_SRC) return;

  try {
    if (localStorage.getItem(POPUNDER_FIRED_KEY)) return; // already fired — first click only
  } catch {
    /* Storage blocked (e.g. Safari private mode) — fail open. */
  }

  try {
    if (document.getElementById(POPUNDER_SCRIPT_ID)) return; // already injected this page view
  } catch {
    /* DOM unavailable — fail open. */
  }

  try {
    localStorage.setItem(POPUNDER_FIRED_KEY, '1');
  } catch {
    /* Fail open — the click must still proceed. */
  }

  try {
    const s = document.createElement('script');
    s.id = POPUNDER_SCRIPT_ID;
    s.src = POPUNDER_SRC;
    s.async = true;
    document.head.appendChild(s);
  } catch {
    /* Popunder is best-effort — the download link must still work. */
  }
}
