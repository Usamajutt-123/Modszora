/**
 * Visual QA helper — screenshots key routes in both themes and reports
 * console errors, failed requests and basic a11y/SEO signals.
 *
 * Usage: node scripts/shoot.mjs [baseUrl] [outDir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = process.argv[3] ?? '/tmp/shots';
mkdirSync(OUT, { recursive: true });

const ROUTES = process.env.ROUTES
  ? process.env.ROUTES.split(',')
  : ['/', '/game/minecraft-mod-apk', '/download/minecraft-mod-apk', '/browse', '/search'];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
];

const problems = [];

const PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="#5b3df5"/><stop offset="55%" stop-color="#8a6cff"/><stop offset="100%" stop-color="#ff3da8"/>
</linearGradient></defs><rect width="600" height="600" fill="url(#g)"/>
<circle cx="300" cy="240" r="86" fill="rgba(255,255,255,.22)"/>
<rect x="150" y="380" width="300" height="26" rx="13" fill="rgba(255,255,255,.28)"/>
<rect x="200" y="424" width="200" height="20" rx="10" fill="rgba(255,255,255,.18)"/></svg>`;

const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--no-sandbox'] });

for (const vp of VIEWPORTS) {
  for (const theme of ['dark', 'light']) {
    if (vp.name === 'mobile' && theme === 'light') continue; // keep the matrix lean

    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      colorScheme: theme,
      reducedMotion: 'reduce',
    });

    // Serve a lightweight local placeholder for every optimised/remote image.
    // The sandbox cannot proxy ~100 CDN images quickly, and layout/CLS
    // behaviour is what we are verifying here, not photo content.
    await ctx.route('**/_next/image**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: PLACEHOLDER }));
    await ctx.route('https://picsum.photos/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: PLACEHOLDER }));

    for (const route of ROUTES) {
      const page = await ctx.newPage();
      const errors = [];
      const failed = [];

      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text().slice(0, 220));
      });
      page.on('requestfailed', (r) => {
        const url = r.url();
        // Ignore external image CDN failures in the sandbox (no egress to picsum).
        if (!url.startsWith(BASE)) return;
        failed.push(`${url.replace(BASE, '')} — ${r.failure()?.errorText ?? 'failed'}`);
      });
      page.on('pageerror', (e) => errors.push(`PAGEERROR ${String(e).slice(0, 220)}`));

      const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => {
        problems.push(`${route} [${vp.name}/${theme}] navigation failed: ${e.message}`);
        return null;
      });

      if (!resp) {
        await page.close();
        continue;
      }

      if (resp.status() >= 400) problems.push(`${route} [${vp.name}/${theme}] HTTP ${resp.status()}`);

      await page.waitForTimeout(700);

      const name = route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '_');
      const file = `${OUT}/${name}-${vp.name}-${theme}.png`;
      // Full-page shots of very long pages crash the renderer; clip instead.
      const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      const clipHeight = Math.min(fullHeight, 5200);
      try {
        await page.screenshot({
          path: file,
          clip: { x: 0, y: 0, width: vp.width, height: clipHeight },
        });
      } catch (e) {
        problems.push(`${route} [${vp.name}/${theme}] screenshot failed: ${e.message.slice(0, 80)}`);
      }

      // Basic quality probes
      const audit = await page.evaluate(() => {
        const imgs = [...document.querySelectorAll('img')];
        const h1s = [...document.querySelectorAll('h1')];
        const buttons = [...document.querySelectorAll('button')];
        return {
          h1: h1s.length,
          h1Text: h1s[0]?.textContent?.trim().slice(0, 60) ?? null,
          imgsNoAlt: imgs.filter((i) => !i.hasAttribute('alt')).length,
          imgsBroken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
          btnNoLabel: buttons.filter(
            (b) => !b.textContent?.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title'),
          ).length,
          title: document.title,
          hasSkipLink: !!document.querySelector('a[href="#main"]'),
          bodyOverflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
          scrollW: document.documentElement.scrollWidth,
          winW: window.innerWidth,
          jsonLd: document.querySelectorAll('script[type="application/ld+json"]').length,
        };
      });

      if (audit.h1 !== 1) problems.push(`${route} [${vp.name}/${theme}] h1 count = ${audit.h1}`);
      if (audit.imgsNoAlt > 0) problems.push(`${route} [${vp.name}/${theme}] ${audit.imgsNoAlt} img without alt`);
      if (audit.btnNoLabel > 0) problems.push(`${route} [${vp.name}/${theme}] ${audit.btnNoLabel} unlabelled button`);
      if (audit.bodyOverflowX) {
        problems.push(`${route} [${vp.name}/${theme}] HORIZONTAL OVERFLOW ${audit.scrollW}>${audit.winW}`);
      }
      if (errors.length) problems.push(`${route} [${vp.name}/${theme}] console: ${errors.slice(0, 3).join(' | ')}`);
      if (failed.length) problems.push(`${route} [${vp.name}/${theme}] failed req: ${failed.slice(0, 3).join(' | ')}`);

      console.log(
        `✓ ${route.padEnd(30)} ${vp.name}/${theme}  h1=${audit.h1} jsonld=${audit.jsonLd} overflow=${audit.bodyOverflowX} → ${file.split('/').pop()}`,
      );
      await page.close();
    }
    await ctx.close();
  }
}

await browser.close();

console.log('\n─────────── ISSUES ───────────');
if (!problems.length) console.log('None 🎉');
else problems.forEach((p) => console.log('• ' + p));
