/**
 * Central Adsterra / AdSense ad configuration.
 *
 * Every NEXT_PUBLIC_* variable is read statically (a literal
 * `process.env.NEXT_PUBLIC_…` reference) so Next.js can inline it into the
 * client bundle at build time. Never build a key name dynamically — a lookup
 * like `process.env[`NEXT_PUBLIC_…${x}`]` compiles to `undefined` in the
 * browser and every ad would silently fail. All eight are written out in
 * full below.
 *
 * With no Adsterra variables set the site renders its dashed placeholder
 * boxes and makes zero network requests to any ad host.
 */

export type AdFormat = 'leaderboard' | 'rectangle' | 'sidebar' | 'in-article';

export interface AdSize {
  width: number;
  height: number;
  label: string; // e.g. '728 × 90'
  className: string; // e.g. 'min-h-[90px]' — reserves space, prevents CLS
}

/**
 * Adsterra only offers these banner sizes: 160×300, 160×600, 300×250,
 * 320×50, 728×90 and 468×60. There is no 300×600 unit, so the sidebar slot
 * uses the 160×600 skyscraper.
 */
export const AD_SIZES: Record<AdFormat, AdSize> = {
  leaderboard: { width: 728, height: 90, label: '728 × 90', className: 'min-h-[90px]' },
  rectangle: { width: 300, height: 250, label: '300 × 250', className: 'min-h-[250px]' },
  sidebar: { width: 160, height: 600, label: '160 × 600', className: 'min-h-[600px]' },
  'in-article': { width: 468, height: 60, label: '468 × 60', className: 'min-h-[60px]' },
};

/** 320×50 mobile banner, used to replace the 728×90 leaderboard below `md`. */
export const MOBILE_BANNER: AdSize = {
  width: 320,
  height: 50,
  label: '320 × 50',
  className: 'min-h-[50px]',
};

// ─── Environment (all optional; site must render without any of them) ───────

/** Banner host — identical for all five banner units on this account. */
export const ADSTERRA_DOMAIN = process.env.NEXT_PUBLIC_ADSTERRA_DOMAIN || undefined;
/** 728 × 90 — download page, above the content. */
export const ADSTERRA_KEY_LEADERBOARD = process.env.NEXT_PUBLIC_ADSTERRA_KEY_LEADERBOARD || undefined;
/** 300 × 250 — sidebars on download, blog and review pages. */
export const ADSTERRA_KEY_RECTANGLE = process.env.NEXT_PUBLIC_ADSTERRA_KEY_RECTANGLE || undefined;
/** 160 × 600 — desktop sidebars on game and blog pages (skyscraper). */
export const ADSTERRA_KEY_SIDEBAR = process.env.NEXT_PUBLIC_ADSTERRA_KEY_SIDEBAR || undefined;
/** 468 × 60 — inside article content on game, download and review pages. */
export const ADSTERRA_KEY_IN_ARTICLE = process.env.NEXT_PUBLIC_ADSTERRA_KEY_IN_ARTICLE || undefined;
/** 320 × 50 — replaces the 728×90 leaderboard below the `md` breakpoint. */
export const ADSTERRA_KEY_MOBILE = process.env.NEXT_PUBLIC_ADSTERRA_KEY_MOBILE || undefined;
/** Native Banner host — separate product, note the DIFFERENT host. */
export const ADSTERRA_NATIVE_DOMAIN = process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_DOMAIN || undefined;
/** Native Banner key — one native unit per page. */
export const ADSTERRA_NATIVE_KEY = process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_KEY || undefined;
/** Legacy AdSense fallback (existing variable). */
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || undefined;

const BANNER_KEYS: Record<AdFormat | 'mobile', string | undefined> = {
  leaderboard: ADSTERRA_KEY_LEADERBOARD,
  rectangle: ADSTERRA_KEY_RECTANGLE,
  sidebar: ADSTERRA_KEY_SIDEBAR,
  'in-article': ADSTERRA_KEY_IN_ARTICLE,
  mobile: ADSTERRA_KEY_MOBILE,
};

/** The Adsterra unit key for a banner format ('mobile' is the 320×50 swap). */
export function adsterraKey(format: AdFormat | 'mobile'): string | undefined {
  return BANNER_KEYS[format];
}

/** True when the banner unit for `format` is fully configured. */
export function hasAdsterraBanner(format: AdFormat): boolean {
  return Boolean(ADSTERRA_DOMAIN && adsterraKey(format));
}

/** True when the Native Banner unit is fully configured. */
export function hasAdsterraNative(): boolean {
  return Boolean(ADSTERRA_NATIVE_DOMAIN && ADSTERRA_NATIVE_KEY);
}

/**
 * A complete standalone HTML document for one banner iframe.
 *
 * Every Adsterra banner snippet assigns to the same global `atOptions`
 * variable, so two banners in one document would overwrite each other and
 * only the last one would render. Rendering each banner inside its own
 * `iframe srcDoc=…` gives each one its own window, so every placement gets
 * an isolated `atOptions` and all of them load at once.
 *
 * The structure reproduces the publisher snippet exactly — `atOptions`
 * assigned first, then the `invoke.js` script tag — with the script URL
 * built as `//www.${domain}/${key}/invoke.js` so it inherits the page
 * protocol.
 */
export function bannerDocument(key: string, domain: string, size: AdSize): string {
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style>' +
    '</head><body>' +
    `<script type="text/javascript">var atOptions = {"key":"${key}","format":"iframe","height":${size.height},"width":${size.width},"params":{}};</script>` +
    `<script type="text/javascript" src="//www.${domain}/${key}/invoke.js"></script>` +
    '</body></html>'
  );
}
