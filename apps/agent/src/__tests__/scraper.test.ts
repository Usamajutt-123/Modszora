import * as cheerio from 'cheerio';
import { getScraper, scraperForUrl } from '../scrapers/adapters.js';

// Realistic HappyMod-style detail page
const HAPPYMOD_HTML = `<!doctype html><html><head>
<title>Subway Surfers MOD APK 3.41.0 (Unlimited Coins) Download</title>
<meta property="og:title" content="Subway Surfers MOD APK 3.41.0">
<meta property="og:image" content="/uploads/subway-banner.jpg">
<meta name="description" content="Download Subway Surfers MOD APK with unlimited coins and keys.">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication",
"name":"Subway Surfers","softwareVersion":"3.41.0","fileSize":"152 MB",
"operatingSystem":"Android 7.0+","applicationCategory":"GameApplication",
"author":{"@type":"Organization","name":"SYBO Games"},
"aggregateRating":{"@type":"AggregateRating","ratingValue":"4.6","ratingCount":"12400"},
"image":"https://cdn.happymod.com/icons/subway.png"}</script>
</head><body>
<h1>Subway Surfers MOD APK</h1>
<table>
 <tr><th>Version</th><td>3.41.0</td></tr>
 <tr><th>Size</th><td>152 MB</td></tr>
 <tr><th>Developer</th><td>SYBO Games</td></tr>
 <tr><th>Package</th><td>com.kiloo.subwaysurf</td></tr>
 <tr><th>Android</th><td>7.0+</td></tr>
 <tr><th>Updated</th><td>2026-07-01</td></tr>
</table>
<h3>MOD Features</h3>
<ul class="mod-info">
 <li>Unlimited Coins</li>
 <li>Unlimited Keys</li>
 <li>All Characters Unlocked</li>
 <li>No Ads</li>
</ul>
<div class="screenshots">
 <img src="/shots/s1.jpg"><img data-src="/shots/s2.jpg"><img src="/shots/logo-icon.png"><img src="/shots/s3.webp">
</div>
<div class="description"><p>Subway Surfers is an <b>endless runner</b>.</p><p>Dodge trains and collect coins.</p></div>
<a class="download-btn" href="/download/subway-surfers-3.41.0.apk">Download APK</a>
<a href="https://play.google.com/store/apps/details?id=com.kiloo.subwaysurf">Google Play</a>
</body></html>`;

// A messy page: NO JSON-LD, no tables, features only in prose
const MESSY_HTML = `<!doctype html><html><head><title>Clash Royale Mod</title></head><body>
<h1>Clash Royale MOD APK v9.8.1</h1>
<div class="entry-content">
<p>Get unlimited gems and unlimited gold in this build. Mod menu included with anti-ban protection.</p>
<p>Requires Android 8.0 and up. File size: 1.2 GB</p>
<p>Package: com.supercell.clashroyale</p>
</div>
<a href="https://example.com/dl/clash.apk">Get it</a>
</body></html>`;

let pass = 0, fail = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}` + (got !== undefined ? ` → got: ${JSON.stringify(got)}` : '')); }
}

console.log('\n[1] HappyMod structured page');
{
  const s = getScraper('happymod');
  const $ = cheerio.load(HAPPYMOD_HTML);
  const generic = (s as any).genericExtract($, 'https://happymod.com/subway-surfers/');
  const specific = s.parseDetail($, 'https://happymod.com/subway-surfers/');
  const m = { ...generic, ...Object.fromEntries(Object.entries(specific).filter(([,v]) => v !== undefined && v !== null)) };

  check('title', m.title === 'Subway Surfers', m.title);
  check('version 3.41.0', m.version === '3.41.0', m.version);
  check('developer SYBO', m.developer === 'SYBO Games', m.developer);
  check('package name', m.packageName === 'com.kiloo.subwaysurf', m.packageName);
  check('size -> 152MB bytes', generic.sizeBytes === 152*1024*1024, generic.sizeBytes);
  check('rating 4.6', generic.rating === 4.6, generic.rating);
  check('android version', String(m.androidVersion).includes('7.0'), m.androidVersion);
  check('mod features = 4', specific.modFeatures?.length === 4, specific.modFeatures);
  check('features content', specific.modFeatures?.includes('Unlimited Coins'), specific.modFeatures?.[0]);
  check("screenshots exclude logo/icon", generic.screenshotUrls.length === 3, generic.screenshotUrls);
  check('screenshots absolute', generic.screenshotUrls.every((u:string)=>u.startsWith('https://happymod.com/')), generic.screenshotUrls[0]);
  check("playstore url", Boolean(m.playStoreUrl && m.playStoreUrl.includes("com.kiloo.subwaysurf")), m.playStoreUrl);
  check("apk link found", Boolean(specific.modApkUrl && specific.modApkUrl.includes(".apk")), specific.modApkUrl);
  check('description text extracted', (generic.descriptionText||'').includes('endless runner'), (generic.descriptionText||'').slice(0,40));
  check('icon from json-ld', generic.iconUrl === 'https://cdn.happymod.com/icons/subway.png', generic.iconUrl);
}

console.log('\n[2] Messy page (no JSON-LD, no tables) — graceful degradation');
{
  const s = getScraper('an1');
  const $ = cheerio.load(MESSY_HTML);
  const g = (s as any).genericExtract($, 'https://an1.com/clash/');
  check('still gets a title', !!g.title && g.title.includes('Clash Royale'), g.title);
  check('regex-extracts version', g.version === '9.8.1', g.version);
  check('regex-extracts package', g.packageName === 'com.supercell.clashroyale', g.packageName);
  check('regex-extracts android', String(g.androidVersion).startsWith('8.0'), g.androidVersion);
  check('prose mod features found', (g.modFeatures?.length ?? 0) >= 3, g.modFeatures);
  check('finds "unlimited gems"', g.modFeatures.some((f:string)=>/unlimited gems/i.test(f)), g.modFeatures);
  check('finds "mod menu"', g.modFeatures.some((f:string)=>/mod menu/i.test(f)), g.modFeatures);
  check('no crash on missing icon', g.iconUrl === null || typeof g.iconUrl === 'string', g.iconUrl);
}

console.log('\n[2b] package-name sanitiser must reject JS/DOM false positives');
{
  const s: any = getScraper('an1');
  const reject = ['window.location.href','document.body.innerHTML','jQuery.fn.init','app.min.js','styles.main.css','image.png','foo','a.b'];
  for (const bad of reject) check(`rejects "${bad}"`, s.sanitisePackageName(bad) === undefined, s.sanitisePackageName(bad));
  const accept = ['com.supercell.clashroyale','com.kiloo.subwaysurf','com.mojang.minecraftpe','net.example.game_two'];
  for (const good of accept) check(`accepts "${good}"`, s.sanitisePackageName(good) === good, s.sanitisePackageName(good));
}

console.log('\n[3] URL → adapter routing');
{
  const cases: Array<[string,string|null]> = [
    ['https://happymod.com/x/', 'happymod'],
    ['https://www.apkmirror.com/apk/a/b/', 'apkmirror'],
    ['https://apkpure.com/x/com.y', 'apkpure'],
    ['https://moddroid.co/game', 'moddroid'],
    ['https://an1.com/g', 'an1'],
    ['https://apkaward.com/g', 'apkaward'],
    ['https://www.revdl.com/g.html', 'revdl'],
    ['https://liteapks.com/g', 'liteapks'],
    ['https://evil-random-site.com/g', null],
    ['not-a-url', null],
  ];
  for (const [url, expected] of cases) {
    const got = scraperForUrl(url)?.source ?? null;
    check(`${url} → ${expected ?? 'rejected'}`, got === expected, got);
  }
}

console.log(`\n═══ ${pass} passed, ${fail} failed ═══`);
process.exit(fail > 0 ? 1 : 0);
