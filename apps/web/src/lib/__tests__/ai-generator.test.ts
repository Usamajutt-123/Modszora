import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAutoBlog, generateAutoReview } from '../ai-generator.js';
import { blogPostSchema, reviewSchema } from '@modverse/shared';

test('Standalone AI Generator Suite', async (t) => {
  await t.test('generateAutoBlog produces schema-valid blog post (top-10)', async () => {
    const post = await generateAutoBlog({
      template: 'top-10',
      games: ['Subway Surfers', 'Shadow Fight 2'],
    });

    assert.ok(post.title.length > 5, 'Has valid title');
    assert.ok(post.slug.length > 3, 'Has valid slug');
    assert.ok(post.content.includes('<h2'), 'Content contains HTML headings');
    assert.ok(post.tags.length > 0, 'Has tags');
    assert.equal(post.status, 'published');

    const parsed = blogPostSchema.safeParse(post);
    assert.ok(parsed.success, `Schema validation error: ${JSON.stringify(parsed.error?.flatten())}`);
  });

  await t.test('generateAutoBlog handles news roundup template', async () => {
    const post = await generateAutoBlog({
      template: 'news-roundup',
      isNews: true,
    });

    assert.ok(post.title.includes('Modszora') || post.title.includes('Android'), 'Title contains expected keywords');
    assert.ok(post.excerpt.length >= 30, 'Excerpt meets length');

    const parsed = blogPostSchema.safeParse(post);
    assert.ok(parsed.success, `Schema validation error: ${JSON.stringify(parsed.error?.flatten())}`);
  });

  await t.test('generateAutoReview produces schema-valid review', async () => {
    const review = await generateAutoReview({
      slug: 'subway-surfers-mod-apk',
      name: 'Subway Surfers',
    });

    assert.ok(review.title.includes('Subway Surfers'), 'Review title contains game name');
    assert.ok(review.score >= 0 && review.score <= 10, 'Review score between 0 and 10');
    assert.ok(review.pros.length >= 2, 'Has pros');
    assert.ok(review.cons.length >= 1, 'Has cons');
    assert.ok(review.body.includes('<h2'), 'Body contains HTML headings');

    const parsed = reviewSchema.safeParse(review);
    assert.ok(parsed.success, `Schema validation error: ${JSON.stringify(parsed.error?.flatten())}`);
  });
});
