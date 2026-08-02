import { generateSeoBundle, generateReview } from '../services/openai.js';
import { aiSeoBundleSchema } from '@modverse/shared';
import type { ScrapedGame } from '@modverse/shared';

// No OPENAI_API_KEY in the sandbox -> exercises the heuristic fallback path,
// which is exactly the path that must never fail in production.
const rich: ScrapedGame = {
  source: 'happymod', sourceUrl: 'https://happymod.com/x/', title: 'Asphalt 9 Legends',
  originalName: 'Asphalt 9', version: '4.9.1a', modVersion: null, packageName: 'com.gameloft.a9',
  developer: 'Gameloft', publisher: 'Gameloft', categoryHint: 'Racing', androidVersion: '8.0+',
  requirements: null, sizeText: '2.4 GB', sizeBytes: 2576980377, rating: 4.5,
  descriptionHtml: null,
  descriptionText: 'Asphalt 9 Legends is an arcade racing game featuring over 200 licensed hypercars from Ferrari, Porsche and Lamborghini. Race through cinematic tracks with TouchDrive controls.',
  modFeatures: ['Unlimited Tokens', 'All Cars Unlocked'], whatsNew: 'Season 12 content',
  iconUrl: null, bannerUrl: null, screenshotUrls: [], playStoreUrl: null,
  originalApkUrl: null, modApkUrl: null, releaseDate: null, updatedDate: null,
  scrapedAt: new Date().toISOString(),
};

// Worst case: almost nothing known
const sparse: ScrapedGame = {
  ...rich, title: 'Mystery Game', version: null, developer: null, publisher: null,
  categoryHint: null, androidVersion: null, sizeText: null, sizeBytes: null, rating: null,
  descriptionText: null, modFeatures: [], whatsNew: null,
};

let pass = 0, fail = 0;
const check = (n: string, c: boolean, g?: unknown) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}` + (g !== undefined ? ` → ${JSON.stringify(g)}` : '')); }
};

for (const [label, game] of [['RICH input', rich], ['SPARSE input', sparse]] as const) {
  console.log(`\n[${label}]`);
  const { bundle, source } = await generateSeoBundle(game);
  const valid = aiSeoBundleSchema.safeParse(bundle);
  check('source is fallback (no API key)', source === 'fallback', source);
  check('bundle passes strict zod schema', valid.success, valid.success ? '' : valid.error.issues.slice(0,3));
  check('seoTitle <= 70', bundle.seoTitle.length <= 70, bundle.seoTitle.length);
  check('metaDescription 50-180', bundle.metaDescription.length >= 50 && bundle.metaDescription.length <= 180, bundle.metaDescription.length);
  check('slug ends -mod-apk', bundle.slug.endsWith('-mod-apk'), bundle.slug);
  check('slug is url-safe', /^[a-z0-9]+(-[a-z0-9]+)*$/.test(bundle.slug), bundle.slug);
  check('>= 5 keywords', bundle.keywords.length >= 5, bundle.keywords.length);
  check('>= 3 modFeatures', bundle.modFeatures.length >= 3, bundle.modFeatures);
  check('>= 3 faqs', bundle.faqs.length >= 3, bundle.faqs.length);
  check('>= 3 install steps', bundle.installationGuide.length >= 3, bundle.installationGuide.length);
  check('longDescription >= 400 chars', bundle.longDescription.length >= 400, bundle.longDescription.length);
  check('longDescription has <h2>', bundle.longDescription.includes('<h2>'), false);
  check('valid category', ['action','adventure','simulation','sports','racing','puzzle','arcade','strategy','rpg','casual','shooter','horror'].includes(bundle.category), bundle.category);

  const rev = await generateReview(game, bundle);
  check('review generated', !!rev, !!rev);
  check('review score in 0-10', !!rev && rev.bundle.score >= 0 && rev.bundle.score <= 10, rev?.bundle.score);
  check('review has >=3 pros', (rev?.bundle.pros.length ?? 0) >= 3, rev?.bundle.pros.length);
  check('review has >=2 cons', (rev?.bundle.cons.length ?? 0) >= 2, rev?.bundle.cons.length);
}

// category inference sanity
console.log('\n[category inference]');
const cases: Array<[string,string,string]> = [
  ['Real Racing 3','A racing simulation with licensed cars','racing'],
  ['Zombie Sniper','First person shooter, guns and war','shooter'],
  ['Word Puzzle Deluxe','A word puzzle brain game','puzzle'],
  ['Farm Tycoon','Farming simulation and management tycoon','simulation'],
];
for (const [title, desc, expected] of cases) {
  const { bundle } = await generateSeoBundle({ ...sparse, title, descriptionText: desc, categoryHint: null });
  check(`"${title}" → ${expected}`, bundle.category === expected, bundle.category);
}

console.log(`\n═══ ${pass} passed, ${fail} failed ═══`);
process.exit(fail ? 1 : 0);
