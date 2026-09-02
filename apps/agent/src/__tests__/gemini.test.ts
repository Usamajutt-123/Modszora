import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aiStatus, complete } from '../services/openai.js';
import { contentRunners } from '../pipeline/content-jobs.js';
import { formatVersion } from '@modverse/shared';

describe('Gemini AI & Auto Content Suite', () => {
  it('formatVersion normalises duplicate v prefixes', () => {
    assert.equal(formatVersion('v0.101-mod'), 'v0.101-mod');
    assert.equal(formatVersion('vv0.101-mod'), 'v0.101-mod');
    assert.equal(formatVersion('0.101'), 'v0.101');
    assert.equal(formatVersion('v2.11.3'), 'v2.11.3');
    assert.equal(formatVersion('vv6.0.0'), 'v6.0.0');
    assert.equal(formatVersion(null), '');
    assert.equal(formatVersion(undefined), '');
  });

  it('aiStatus reports available provider and model', () => {
    const status = aiStatus();
    assert.ok(typeof status.available === 'boolean');
    assert.ok(typeof status.model === 'string');
    assert.ok(['gemini', 'openai', 'heuristic'].includes(status.provider));
  });

  it('contentRunners contains all 7 registered handlers', () => {
    assert.ok(typeof contentRunners.runBlogGeneration === 'function');
    assert.ok(typeof contentRunners.runWallpaperGeneration === 'function');
    assert.ok(typeof contentRunners.runReviewGeneration === 'function');
    assert.ok(typeof contentRunners.runAnalysis === 'function');
    assert.ok(typeof contentRunners.runAutoBlogGeneration === 'function');
    assert.ok(typeof contentRunners.runAutoNewsGeneration === 'function');
    assert.ok(typeof contentRunners.runAutoReviewGeneration === 'function');
  });
});
