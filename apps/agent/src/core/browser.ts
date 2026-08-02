import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { config } from '../config/index.js';
import { createLogger } from './logger.js';

/**
 * Shared Playwright browser.
 *
 * A single browser instance is reused across jobs (launching Chromium costs
 * ~300ms and ~120MB); each job gets an isolated context so cookies and
 * storage never leak between sources.
 */

const log = createLogger('browser');

let browser: Browser | null = null;
let launching: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;
  if (launching) return launching;

  launching = chromium
    .launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    })
    .then((b) => {
      browser = b;
      launching = null;
      log.info('chromium launched');
      b.on('disconnected', () => {
        log.warn('chromium disconnected');
        browser = null;
      });
      return b;
    })
    .catch((err) => {
      launching = null;
      throw err;
    });

  return launching;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => undefined);
    browser = null;
    log.info('chromium closed');
  }
}

export interface ContextOptions {
  blockAssets?: boolean;
  locale?: string;
  timezone?: string;
}

export async function createContext(opts: ContextOptions = {}): Promise<BrowserContext> {
  const { blockAssets = true, locale = 'en-US', timezone = 'UTC' } = opts;
  const b = await getBrowser();

  const context = await b.newContext({
    userAgent: config.AGENT_USER_AGENT,
    locale,
    timezoneId: timezone,
    viewport: { width: 1366, height: 900 },
    javaScriptEnabled: true,
    bypassCSP: true,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      DNT: '1',
    },
  });

  context.setDefaultTimeout(config.AGENT_NAV_TIMEOUT_MS);
  context.setDefaultNavigationTimeout(config.AGENT_NAV_TIMEOUT_MS);

  if (blockAssets) {
    // Scraping only needs the DOM. Blocking media/fonts/ads cuts page weight
    // by ~80% and dramatically reduces timeouts on ad-heavy MOD sites.
    await context.route('**/*', (route) => {
      const type = route.request().resourceType();
      const url = route.request().url();

      if (type === 'image' || type === 'media' || type === 'font') return route.abort();

      const AD_HOSTS = [
        'doubleclick.net',
        'googlesyndication.com',
        'google-analytics.com',
        'googletagmanager.com',
        'adservice.google',
        'facebook.net',
        'amazon-adsystem',
        'taboola',
        'outbrain',
        'popads',
        'propellerads',
        'adsterra',
        'hilltopads',
      ];
      if (AD_HOSTS.some((h) => url.includes(h))) return route.abort();

      return route.continue();
    });
  }

  // Reduce trivially detectable automation signals.
  // Passed as a string for the same bundler-safety reason as the scroll script.
  await context.addInitScript(
    `Object.defineProperty(navigator, 'webdriver', { get: function () { return undefined; } });
     Object.defineProperty(navigator, 'languages', { get: function () { return ['en-US', 'en']; } });
     Object.defineProperty(navigator, 'plugins', { get: function () { return [1, 2, 3, 4, 5]; } });`,
  );

  return context;
}

/**
 * Runs `fn` with a fresh page and guarantees cleanup even on throw.
 */
export async function withPage<T>(fn: (page: Page) => Promise<T>, opts: ContextOptions = {}): Promise<T> {
  const context = await createContext(opts);
  const page = await context.newPage();
  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}

/** Navigates and returns the settled HTML, or null when the page is unusable. */
export async function fetchHtml(url: string, opts: { waitFor?: string; scroll?: boolean } = {}): Promise<string | null> {
  return withPage(async (page) => {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (!response) return null;
    if (response.status() >= 400) {
      log.warn(`HTTP ${response.status()} for ${url}`);
      return null;
    }

    if (opts.waitFor) {
      await page.waitForSelector(opts.waitFor, { timeout: 10_000 }).catch(() => undefined);
    }
    if (opts.scroll) {
      // Trigger lazy-loaded screenshot galleries.
      //
      // NOTE: this is passed as a STRING, not a function. Bundlers (tsx/esbuild,
      // and `tsc` with certain helpers) rewrite arrow functions and inject
      // helpers such as `__name`, which do not exist inside the page context
      // and throw "ReferenceError: __name is not defined". A string body is
      // evaluated verbatim by Chromium and is immune to that transform.
      await page
        .evaluate(
          `new Promise((resolve) => {
             var y = 0;
             function step() {
               window.scrollBy(0, 800);
               y += 800;
               if (y >= document.body.scrollHeight || y > 12000) { resolve(); return; }
               setTimeout(step, 120);
             }
             step();
           })`,
        )
        .catch(() => undefined);
      await page.waitForTimeout(400);
    }

    return page.content();
  });
}
