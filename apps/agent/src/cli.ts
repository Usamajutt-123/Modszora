#!/usr/bin/env node
/**
 * MODVerse Agent CLI — run pipeline actions without the HTTP server.
 *
 *   npm run cli -- ingest <url> [--publish] [--no-mega] [--live]
 *   npm run cli -- discover [source...] [--limit N]
 *   npm run cli -- check-updates [--limit N]
 *   npm run cli -- recommend [--limit N]
 *   npm run cli -- status
 */
import { config, describeFeatures } from './config/index.js';
import { createLogger } from './core/logger.js';
import { closeBrowser } from './core/browser.js';
import { getScraper } from './scrapers/adapters.js';
import { ingestUrl } from './pipeline/ingest.js';
import { listGamesNeedingUpdateCheck } from './services/supabase.js';
import { AGENT_SOURCES, type AgentSource } from '@modverse/shared';

const log = createLogger('cli');
const args = process.argv.slice(2);
const command = args[0];
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positional = args.slice(1).filter((a) => !a.startsWith('--'));
const flagValue = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function usage(): void {
  console.log(`
MODVerse Agent CLI

  ingest <url>            Scrape, enrich and publish a single game URL
      --publish             Set status=published (default: draft)
      --no-mega             Skip the MultCloud → Mega transfer
      --no-review           Skip editorial review generation
      --live                Disable dry run (actually writes)

  discover [sources...]   Crawl listing pages for new games
      --limit N             Candidates per source (default 10)

  check-updates           Re-scrape tracked games and report version bumps
      --limit N             Games to check (default 20)

  recommend               Score candidates without publishing
      --limit N             Candidates per source (default 10)

  status                  Print configuration and feature availability

Sources: ${AGENT_SOURCES.join(', ')}
`);
}

async function main(): Promise<number> {
  switch (command) {
    case 'status': {
      const f = describeFeatures();
      console.log('\nMODVerse Agent configuration');
      console.log('─'.repeat(52));
      for (const [k, v] of Object.entries(f)) console.log(`  ${k.padEnd(12)}: ${v}`);
      console.log(`  ${'sources'.padEnd(12)}: ${config.enabledSources.join(', ')}`);
      console.log(`  ${'concurrency'.padEnd(12)}: ${config.AGENT_CONCURRENCY}`);
      console.log(`  ${'publishUrl'.padEnd(12)}: ${config.MODVERSE_PUBLISH_URL}`);
      console.log('─'.repeat(52));
      return 0;
    }

    case 'ingest': {
      const url = positional[0];
      if (!url) {
        console.error('Error: a URL is required.\n');
        usage();
        return 1;
      }
      const result = await ingestUrl({
        url,
        autoPublish: flags.has('--publish'),
        uploadToMega: !flags.has('--no-mega'),
        generateReviewToo: !flags.has('--no-review'),
        dryRun: !flags.has('--live'),
        onProgress: (pct, note) => process.stdout.write(`\r  ${String(Math.round(pct)).padStart(3)}%  ${note.padEnd(52)}`),
      });
      process.stdout.write('\n\n');
      console.log(`  action     : ${result.action}`);
      console.log(`  slug       : ${result.slug ?? '—'}`);
      console.log(`  changes    : ${result.changes.join(', ') || '—'}`);
      console.log(`  seo source : ${result.seoSource ?? '—'}`);
      console.log(`  mega       : ${result.megaUrl ?? '—'}`);
      if (result.warnings.length) console.log(`  warnings   : ${result.warnings.join(' | ')}`);
      console.log(`  timings    : ${JSON.stringify(result.timings)}`);
      if (result.game) {
        console.log(`\n  ${result.game.name}  v${result.game.version}  ${(result.game.sizeBytes / 1048576).toFixed(1)}MB`);
        console.log(`  ${result.game.seo.title}`);
      }
      return result.action === 'failed' ? 1 : 0;
    }

    case 'discover': {
      const limit = Number(flagValue('limit') ?? 10);
      const sources = (positional.length ? positional : [...config.enabledSources]).filter((s): s is AgentSource =>
        (AGENT_SOURCES as readonly string[]).includes(s),
      );
      for (const source of sources) {
        try {
          const items = await getScraper(source).discover(limit);
          console.log(`\n${source} — ${items.length} candidates`);
          items.forEach((i, n) => console.log(`  ${String(n + 1).padStart(2)}. ${(i.title || '(untitled)').slice(0, 58).padEnd(58)} ${i.url}`));
        } catch (err) {
          console.error(`  ${source}: ${err instanceof Error ? err.message : err}`);
        }
      }
      return 0;
    }

    case 'check-updates': {
      const limit = Number(flagValue('limit') ?? 20);
      const games = await listGamesNeedingUpdateCheck(limit);
      if (!games.length) {
        console.log('No tracked games with source URLs (is Supabase configured?).');
        return 0;
      }
      console.log(`Checking ${games.length} games…`);
      for (const g of games) console.log(`  ${g.name.padEnd(34)} v${g.version.padEnd(12)} ${g.sourceUrl}`);
      return 0;
    }

    case 'recommend': {
      const limit = Number(flagValue('limit') ?? 10);
      for (const source of config.enabledSources) {
        try {
          const items = await getScraper(source).discover(limit);
          console.log(`\n${source}`);
          items.slice(0, limit).forEach((i, n) => {
            const score = Math.max(0, 100 - n * 6);
            console.log(`  ${String(score).padStart(3)}  ${(i.title || '(untitled)').slice(0, 52).padEnd(52)} ${i.url}`);
          });
        } catch (err) {
          console.error(`  ${source}: ${err instanceof Error ? err.message : err}`);
        }
      }
      return 0;
    }

    default:
      usage();
      return command ? 1 : 0;
  }
}

main()
  .then(async (code) => {
    await closeBrowser();
    process.exit(code);
  })
  .catch(async (err) => {
    log.error(err instanceof Error ? err.message : String(err));
    await closeBrowser();
    process.exit(1);
  });
