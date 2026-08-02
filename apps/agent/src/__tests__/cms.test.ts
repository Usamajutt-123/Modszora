/**
 * CMS content-generation tests.
 *
 * Runs without OPENAI_API_KEY, which exercises the deterministic fallback
 * paths — exactly the paths that must never fail in production when the
 * model is unavailable, rate-limited or returns malformed JSON.
 */
import {
  aiBlogBundleSchema,
  aiWallpaperMetaSchema,
  aiReviewBundleSchema,
  blogPostSchema,
  BLOG_TEMPLATES,
  wallpaperSchema,
  type BlogTemplate,
} from '@modverse/shared';
import { generateBlogArticle, generateKeywordIdeas, generateWallpaperMeta, runReviewAction } from '../services/content-ai.js';

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, got?: unknown) => {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name}${got !== undefined ? ` → ${JSON.stringify(got).slice(0, 160)}` : ''}`);
  }
};

/* ═══════════ blog generation ═══════════ */

console.log('\n[1] Blog generator — every template produces valid output');
for (const template of BLOG_TEMPLATES) {
  const { bundle, source } = await generateBlogArticle({
    template,
    gameNames: ['Minecraft', 'Subway Surfers', 'Asphalt 9'],
    wordCount: 900,
  });
  const parsed = aiBlogBundleSchema.safeParse(bundle);
  check(
    `${template.padEnd(24)} valid (${source})`,
    parsed.success,
    parsed.success ? undefined : parsed.error.issues.slice(0, 2),
  );
  check(`${template.padEnd(24)} has <h2> sections`, bundle.content.includes('<h2>'));
  check(`${template.padEnd(24)} slug is url-safe`, /^[a-z0-9]+(-[a-z0-9]+)*$/.test(bundle.slug), bundle.slug);
}

console.log('\n[2] Blog output survives the strict BlogPost schema');
{
  const { bundle } = await generateBlogArticle({ template: 'top-10', gameNames: ['A', 'B'] });
  const post = blogPostSchema.safeParse({
    title: bundle.title,
    slug: bundle.slug,
    category: bundle.category,
    excerpt: bundle.excerpt,
    content: bundle.content,
    tags: bundle.tags,
    readingMinutes: bundle.readingMinutes,
    seo: {
      title: bundle.seoTitle,
      description: bundle.metaDescription,
      keywords: bundle.keywords,
      twitterCard: 'summary_large_image',
      noindex: false,
    },
  });
  check('generated post passes blogPostSchema', post.success, post.success ? undefined : post.error.issues.slice(0, 3));
}

console.log('\n[3] Blog generator with zero context (worst case)');
{
  const { bundle } = await generateBlogArticle({ template: 'gaming-tips', gameNames: [] });
  const parsed = aiBlogBundleSchema.safeParse(bundle);
  check('still valid with no games supplied', parsed.success, parsed.success ? undefined : parsed.error.issues[0]);
  check('content is substantial', bundle.content.length > 400, bundle.content.length);
}

/* ═══════════ wallpaper metadata ═══════════ */

console.log('\n[4] Wallpaper metadata generator');
{
  const { meta } = await generateWallpaperMeta({ gameName: 'Neon Drift Arena', category: 'racing', index: 2 });
  const parsed = aiWallpaperMetaSchema.safeParse(meta);
  check('metadata valid', parsed.success, parsed.success ? undefined : parsed.error.issues.slice(0, 2));
  check('slug url-safe', /^[a-z0-9]+(-[a-z0-9]+)*$/.test(meta.slug), meta.slug);
  check('meta description within limits', meta.metaDescription.length >= 50 && meta.metaDescription.length <= 180, meta.metaDescription.length);
  check('alt text is descriptive', meta.altText.length >= 10, meta.altText);
  check('category preserved', meta.category === 'racing', meta.category);
}

console.log('\n[5] Wallpaper record assembles into a valid Wallpaper');
{
  const { meta } = await generateWallpaperMeta({ gameName: 'Test Game', category: 'action' });
  const wallpaper = wallpaperSchema.safeParse({
    title: meta.title,
    slug: meta.slug,
    category: meta.category,
    tags: meta.tags,
    image: { url: 'https://cdn.test/a.webp', format: 'webp', width: 1080, height: 1920, bytes: 120_000 },
    resolution: '1080x1920',
    width: 1080,
    height: 1920,
    seo: {
      title: meta.seoTitle,
      description: meta.metaDescription,
      keywords: meta.keywords,
      twitterCard: 'summary_large_image',
      noindex: false,
    },
  });
  check('passes wallpaperSchema', wallpaper.success, wallpaper.success ? undefined : wallpaper.error.issues.slice(0, 3));
}

/* ═══════════ review actions ═══════════ */

console.log('\n[6] Review generator — all actions');
const baseReview = {
  title: 'Test Game Review',
  summary: 'A summary long enough to be meaningful for the generator to work with during testing.',
  body: '<p>Original body paragraph describing the game in reasonable detail.</p>',
  score: 7.2,
  scoreBreakdown: { gameplay: 8, graphics: 7, content: 7, performance: 6, value: 9 },
  pros: ['Fast', 'Free', 'Offline'],
  cons: ['Repetitive', 'Large download'],
  verdict: 'A solid pick for anyone who wants the full experience without the grind.',
};

for (const action of ['generate', 'regenerate', 'improve-seo', 'improve-rating', 'expand'] as const) {
  const result = await runReviewAction({
    action,
    review: action === 'generate' ? {} : baseReview,
    gameName: 'Test Game',
    gameFacts: { developer: 'Test Dev', category: 'action' },
  });
  const okResult = !('error' in result);
  check(`${action.padEnd(16)} succeeds`, okResult, okResult ? undefined : (result as { error: string }).error);
  if (okResult) {
    const parsed = aiReviewBundleSchema.safeParse(result.bundle);
    check(`${action.padEnd(16)} output valid`, parsed.success, parsed.success ? undefined : parsed.error.issues[0]);
  }
}

console.log('\n[7] improve-rating makes the score the honest average');
{
  const result = await runReviewAction({
    action: 'improve-rating',
    review: { ...baseReview, score: 9.9 }, // deliberately inflated
    gameName: 'Test Game',
  });
  if ('error' in result) check('improve-rating ran', false, result.error);
  else {
    const b = result.bundle.scoreBreakdown;
    const expected = Number((Object.values(b).reduce((a, x) => a + x, 0) / 5).toFixed(1));
    check(`score corrected 9.9 → ${result.bundle.score} (avg ${expected})`, Math.abs(result.bundle.score - expected) < 0.15, {
      got: result.bundle.score,
      expected,
    });
  }
}

console.log('\n[8] expand meaningfully lengthens the body');
{
  const before = baseReview.body.length;
  const result = await runReviewAction({ action: 'expand', review: baseReview, gameName: 'Test Game' });
  if ('error' in result) check('expand ran', false, result.error);
  else check(`body grew ${before} → ${result.bundle.body.length}`, result.bundle.body.length > before * 2);
}

console.log('\n[9] translate without OpenAI fails loudly rather than silently');
{
  const result = await runReviewAction({
    action: 'translate',
    review: baseReview,
    gameName: 'Test Game',
    targetLanguage: 'es',
  });
  check('returns a clear error', 'error' in result, result);
  if ('error' in result) check('error mentions OpenAI', /openai/i.test(result.error), result.error);
}

console.log('\n[10] Review refinement works on a very short draft');
{
  const result = await runReviewAction({
    action: 'improve-seo',
    review: { title: 'wip', body: 'x' },
    gameName: 'Draft Game',
  });
  check('short draft accepted', !('error' in result), result);
}

/* ═══════════ keywords ═══════════ */

console.log('\n[11] Keyword research');
{
  const trending = await generateKeywordIdeas({ seedTopics: ['Minecraft', 'Free Fire'], count: 8 });
  check('returns ideas', trending.ideas.length > 0, trending.ideas.length);
  check('all have keyword text', trending.ideas.every((i) => i.keyword.length > 2));
  check('difficulty within 0-100', trending.ideas.every((i) => i.difficulty >= 0 && i.difficulty <= 100));

  // Fair comparison: identical seeds and count, only the mode differs.
  // (Comparing different seed sets is meaningless — phrase length, not mode,
  // dominates the difficulty heuristic.)
  const SEEDS = ['Minecraft', 'Free Fire'];
  const [modeTrending, modeLow] = await Promise.all([
    generateKeywordIdeas({ seedTopics: SEEDS, wantLowCompetition: false, count: 6 }),
    generateKeywordIdeas({ seedTopics: SEEDS, wantLowCompetition: true, count: 6 }),
  ]);
  const avgOf = (xs: { difficulty: number }[]) => xs.reduce((s, i) => s + i.difficulty, 0) / Math.max(1, xs.length);
  const avgLow = avgOf(modeLow.ideas);
  const avgAll = avgOf(modeTrending.ideas);
  check(
    `low-competition mode is no harder on identical seeds (${avgLow.toFixed(1)} vs ${avgAll.toFixed(1)})`,
    avgLow <= avgAll,
    { avgLow, avgAll },
  );
  check(
    'low-competition mode excludes high-difficulty transactional terms',
    modeLow.ideas.every((i) => i.difficulty <= 50),
    modeLow.ideas.filter((i) => i.difficulty > 50).map((i) => i.keyword),
  );
  check('no duplicate keywords', new Set(trending.ideas.map((i) => i.keyword)).size === trending.ideas.length);
}

console.log(`\n═══ ${pass} passed, ${fail} failed ═══`);
process.exit(fail > 0 ? 1 : 0);
