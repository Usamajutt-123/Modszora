import type { AgentSource, ScrapedGame } from '@modverse/shared';
import { absoluteUrl, parseSizeToBytes, stripHtml, unique } from '@modverse/shared';
import { BaseScraper, type CheerioRoot, type ListingItem } from './base.js';

/**
 * Site-specific adapters.
 *
 * Each one only encodes what differs from the generic extractor in
 * BaseScraper: the listing selector and any fields the site exposes in an
 * unusual place. Everything else (JSON-LD, OG, label tables, mod features,
 * screenshots) is inherited.
 *
 * Selectors are written defensively with multiple fallbacks, because MOD
 * APK sites re-theme frequently. When a selector stops matching, the
 * generic path still produces a usable record rather than failing hard.
 */

/* ─────────────────────────── APKMirror ─────────────────────────── */

export class ApkMirrorScraper extends BaseScraper {
  readonly source: AgentSource = 'apkmirror';
  protected override usePlaywright = true; // Cloudflare-fronted

  parseListing($: CheerioRoot, pageUrl: string): ListingItem[] {
    const items: ListingItem[] = [];
    $('.appRow, .listWidget .appRow, div.widget_appmanager_recentpostswidget .appRow').each((_, el) => {
      const link = $(el).find('a.fontBlack, h5.appRowTitle a, a[href*="/apk/"]').first();
      const href = link.attr('href');
      const abs = absoluteUrl(href ?? null, pageUrl);
      if (abs && /\/apk\//.test(abs)) items.push({ url: abs, title: link.text().trim() });
    });
    if (!items.length) {
      $('a[href*="/apk/"]').each((_, el) => {
        const abs = absoluteUrl($(el).attr('href') ?? null, pageUrl);
        if (abs) items.push({ url: abs, title: $(el).text().trim() });
      });
    }
    return items;
  }

  parseDetail($: CheerioRoot, url: string): Partial<ScrapedGame> {
    const labels = this.readLabelTable($);
    const infoText = $('.appspec-value, .apk-detail-table').text();

    return {
      title: $('h1.marginZero, .app-title h1, h1').first().text().replace(/\s+/g, ' ').trim() || undefined,
      developer: $('a[href*="/developer/"]').first().text().trim() || labels.developer || undefined,
      version: $('.appspec-row .appspec-value').first().text().trim() || labels.version || undefined,
      packageName:
        this.matchFirst(infoText, [/([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,})/i]) ||
        this.matchFirst($.html(), [/data-package="([^"]+)"/]) ||
        undefined,
      sizeText: labels.size || this.matchFirst(infoText, [/([\d.]+\s*[KMG]B)/i]) || undefined,
      androidVersion: labels.android || labels.requirements || undefined,
      // APKMirror hosts original (unmodded) APKs.
      originalApkUrl: this.findDownloadLink($, url) ?? undefined,
      modFeatures: [],
    };
  }
}

/* ─────────────────────────── APKPure ─────────────────────────── */

export class ApkPureScraper extends BaseScraper {
  readonly source: AgentSource = 'apkpure';
  protected override usePlaywright = true;

  parseListing($: CheerioRoot, pageUrl: string): ListingItem[] {
    const items: ListingItem[] = [];
    $('.app-item, .category-template-item, li.search-dl, .apk-list-item').each((_, el) => {
      const link = $(el).find('a').first();
      const abs = absoluteUrl(link.attr('href') ?? null, pageUrl);
      if (abs && !/\/(category|developer|search)\//.test(abs)) {
        items.push({ url: abs, title: $(el).find('.p1, .title, h3').first().text().trim() });
      }
    });
    return items;
  }

  parseDetail($: CheerioRoot, url: string): Partial<ScrapedGame> {
    const labels = this.readLabelTable($);
    return {
      title: $('.title-like, h1.title, h1').first().text().trim() || undefined,
      developer: $('.details-author a, .developer a, span.developer').first().text().trim() || labels.developer || undefined,
      version: $('.details-sdk span, .version').first().text().replace(/^v/i, '').trim() || labels.version || undefined,
      packageName:
        $('.details-sdk').attr('data-pkg') ||
        this.matchFirst($.html(), [/"packageName"\s*:\s*"([^"]+)"/, /package=([a-z][a-z0-9_.]+)/i]) ||
        undefined,
      sizeText: labels.size || $('.detail-sdk-size, .size').first().text().trim() || undefined,
      androidVersion: labels.requiresandroid || labels.android || undefined,
      originalApkUrl: this.findDownloadLink($, url) ?? undefined,
      modFeatures: [],
    };
  }
}

/* ─────────────────────────── HappyMod ─────────────────────────── */

export class HappyModScraper extends BaseScraper {
  readonly source: AgentSource = 'happymod';
  protected override usePlaywright = true;

  parseListing($: CheerioRoot, pageUrl: string): ListingItem[] {
    const items: ListingItem[] = [];
    $('.mod-item, .app-item, .item, .pdt-item, li.hp-item').each((_, el) => {
      const link = $(el).find('a[href]').first();
      const abs = absoluteUrl(link.attr('href') ?? null, pageUrl);
      if (abs && abs !== pageUrl && !/\/(category|tag|page)\//.test(abs)) {
        items.push({
          url: abs,
          title: $(el).find('.title, h3, .name, dt').first().text().trim(),
          version: $(el).find('.version, .ver').first().text().trim() || undefined,
        });
      }
    });
    return items;
  }

  parseDetail($: CheerioRoot, url: string): Partial<ScrapedGame> {
    const labels = this.readLabelTable($);

    // HappyMod lists mod features in a dedicated block.
    const modFeatures: string[] = [];
    $('.mod-info li, .mod-features li, #mod-info li, .happymod-features li').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length >= 3 && text.length <= 200) modFeatures.push(text);
    });

    const modInfoText = $('.mod-info, #mod-info, .mod-desc').text();
    if (!modFeatures.length && modInfoText) {
      modInfoText
        .split('\n')
        .map((l) => l.replace(/^[•\-*–]\s*/, '').trim())
        .filter((l) => l.length >= 3 && l.length <= 200)
        .forEach((l) => modFeatures.push(l));
    }

    return {
      title: $('h1, .app-name, .detail-title').first().text().replace(/\s*mod\s*apk.*$/i, '').trim() || undefined,
      developer: labels.developer || $('.developer a, .author').first().text().trim() || undefined,
      version: labels.version || $('.version-name, .ver').first().text().replace(/^v/i, '').trim() || undefined,
      modVersion: labels.modversion || undefined,
      packageName: labels.package || this.matchFirst($.html(), [/id=([a-z][a-z0-9_.]{5,})/i]) || undefined,
      sizeText: labels.size || undefined,
      androidVersion: labels.android || labels.requirements || undefined,
      modApkUrl: this.findDownloadLink($, url) ?? undefined,
      modFeatures: unique(modFeatures).slice(0, 24),
    };
  }
}

/* ─────────────────────────── ModDroid ─────────────────────────── */

export class ModDroidScraper extends BaseScraper {
  readonly source: AgentSource = 'moddroid';

  parseListing($: CheerioRoot, pageUrl: string): ListingItem[] {
    const items: ListingItem[] = [];
    $('.game-item, .app-card, article, .post-item').each((_, el) => {
      const link = $(el).find('a[href]').first();
      const abs = absoluteUrl(link.attr('href') ?? null, pageUrl);
      if (abs && abs !== pageUrl) items.push({ url: abs, title: $(el).find('h2, h3, .title').first().text().trim() });
    });
    return items;
  }

  parseDetail($: CheerioRoot, url: string): Partial<ScrapedGame> {
    const labels = this.readLabelTable($);
    return {
      title: $('h1').first().text().replace(/\s*(mod|apk).*$/i, '').trim() || undefined,
      developer: labels.developer || labels.publisher || undefined,
      version: labels.version || undefined,
      modVersion: labels.mod || labels.modversion || undefined,
      sizeText: labels.size || undefined,
      androidVersion: labels.android || labels.requirements || undefined,
      packageName: labels.package || undefined,
      modApkUrl: this.findDownloadLink($, url) ?? undefined,
    };
  }
}

/* ─────────────────────────── AN1 ─────────────────────────── */

export class An1Scraper extends BaseScraper {
  readonly source: AgentSource = 'an1';
  protected override usePlaywright = true; // AN1 renders its detail pages client-side

  parseListing($: CheerioRoot, pageUrl: string): ListingItem[] {
    const items: ListingItem[] = [];
    $('.item, .post, .app-item, .game').each((_, el) => {
      const link = $(el).find('a[href]').first();
      const abs = absoluteUrl(link.attr('href') ?? null, pageUrl);
      if (abs && abs !== pageUrl && !/\/(page|category)\//.test(abs)) {
        items.push({ url: abs, title: $(el).find('.name, h2, h3').first().text().trim() });
      }
    });
    return items;
  }

  parseDetail($: CheerioRoot, url: string): Partial<ScrapedGame> {
    const labels = this.readLabelTable($);
    const bodyText = $('body').text().replace(/\s+/g, ' ');

    // AN1 h1 reads: "Download <Name> (MOD, <feature>) <version> free on android"
    const rawH1 = $('h1.name, h1').first().text().replace(/\s+/g, ' ').trim();
    const title = An1Scraper.cleanTitle(rawH1);

    // The spec block is plain text, not a table, so read it with regex.
    const version =
      labels.version ||
      this.matchFirst(rawH1, [/\b(\d+(?:\.\d+){1,3})\b/]) ||
      this.matchFirst(bodyText, [/Version[:\s]*([\d.]+)/i]);

    const sizeText = labels.size || this.matchFirst(bodyText, [/\b([\d.]+\s*(?:[KMG]b|[KMG]B))\b/]);

    const androidVersion =
      labels.android ||
      labels.requirements ||
      this.matchFirst(bodyText, [/Android[:\s]*([\d.]+\+?)/i, /([\d.]+)\s*(?:and up|\+)/i]);

    // Mod features live in the h1 parentheses: "(MOD, Unlimited Coins)".
    const modFeatures: string[] = [];
    const parenthetical = /\((?:MOD[,\s]*)?([^)]+)\)/i.exec(rawH1);
    if (parenthetical?.[1]) {
      parenthetical[1]
        .split(/[,/]/)
        .map((f) => f.trim())
        .filter((f) => f.length >= 3 && f.length <= 80 && !/^mod$/i.test(f))
        .forEach((f) => modFeatures.push(this.titleCase(f)));
    }

    return {
      title: title || undefined,
      developer: labels.developer || labels.author || undefined,
      version: version || undefined,
      sizeText: sizeText || undefined,
      androidVersion: androidVersion || undefined,
      packageName: this.sanitisePackageName(labels.package),
      modApkUrl: this.findDownloadLink($, url) ?? undefined,
      modFeatures,
    };
  }

  /** Strips AN1's "Download … free on android" wrapper from the heading. */
  static cleanTitle(raw: string): string {
    return raw
      .replace(/^\s*download\s+/i, '')
      .replace(/\s*free\s+on\s+android\s*$/i, '')
      .replace(/\s*\((?:MOD|HACK)[^)]*\)\s*/gi, ' ')
      .replace(/\s*\bv?\d+(?:\.\d+){1,3}[a-z0-9._-]*\s*$/i, '')
      .replace(/\s*[-–—:]\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
}

/* ─────────────────────────── APKAward ─────────────────────────── */

export class ApkAwardScraper extends BaseScraper {
  readonly source: AgentSource = 'apkaward';

  parseListing($: CheerioRoot, pageUrl: string): ListingItem[] {
    const items: ListingItem[] = [];
    $('article, .post, .entry, .app-box').each((_, el) => {
      const link = $(el).find('a[href]').first();
      const abs = absoluteUrl(link.attr('href') ?? null, pageUrl);
      if (abs && abs !== pageUrl) items.push({ url: abs, title: $(el).find('h2, h3, .entry-title').first().text().trim() });
    });
    return items;
  }

  parseDetail($: CheerioRoot, url: string): Partial<ScrapedGame> {
    const labels = this.readLabelTable($);
    return {
      title: $('h1.entry-title, h1').first().text().replace(/\s*(mod|apk).*$/i, '').trim() || undefined,
      developer: labels.developer || undefined,
      version: labels.version || undefined,
      sizeText: labels.size || undefined,
      androidVersion: labels.android || undefined,
      packageName: labels.package || undefined,
      modApkUrl: this.findDownloadLink($, url) ?? undefined,
    };
  }
}

/* ─────────────────────────── RevDL ─────────────────────────── */

export class RevDlScraper extends BaseScraper {
  readonly source: AgentSource = 'revdl';

  parseListing($: CheerioRoot, pageUrl: string): ListingItem[] {
    const items: ListingItem[] = [];
    $('article, .post, .item-list').each((_, el) => {
      const link = $(el).find('h2 a, h3 a, a.title').first();
      const abs = absoluteUrl(link.attr('href') ?? null, pageUrl);
      if (abs) items.push({ url: abs, title: link.text().trim() });
    });
    return items;
  }

  parseDetail($: CheerioRoot, url: string): Partial<ScrapedGame> {
    const labels = this.readLabelTable($);
    const title = $('h1.entry-title, h1').first().text().trim();
    return {
      title: title.replace(/\s*(mod|apk|v[\d.]+).*$/i, '').trim() || undefined,
      version: labels.version || this.matchFirst(title, [/v?(\d+(?:\.\d+){1,3})/]) || undefined,
      developer: labels.developer || undefined,
      sizeText: labels.size || undefined,
      androidVersion: labels.android || labels.requirements || undefined,
      modApkUrl: this.findDownloadLink($, url) ?? undefined,
    };
  }
}

/* ─────────────────────────── LiteAPKs ─────────────────────────── */

export class LiteApksScraper extends BaseScraper {
  readonly source: AgentSource = 'liteapks';

  parseListing($: CheerioRoot, pageUrl: string): ListingItem[] {
    const items: ListingItem[] = [];
    $('article, .post-item, .app-item, .grid-item').each((_, el) => {
      const link = $(el).find('a[href]').first();
      const abs = absoluteUrl(link.attr('href') ?? null, pageUrl);
      if (abs && abs !== pageUrl) items.push({ url: abs, title: $(el).find('h2, h3, .title').first().text().trim() });
    });
    return items;
  }

  parseDetail($: CheerioRoot, url: string): Partial<ScrapedGame> {
    const labels = this.readLabelTable($);

    const modFeatures: string[] = [];
    $('.mod-info li, .modinfo li, .features li').each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t.length >= 3 && t.length <= 200) modFeatures.push(t);
    });

    return {
      title: $('h1').first().text().replace(/\s*(mod|apk).*$/i, '').trim() || undefined,
      developer: labels.developer || labels.offeredby || undefined,
      version: labels.version || undefined,
      modVersion: labels.modversion || undefined,
      sizeText: labels.size || undefined,
      androidVersion: labels.android || labels.requirements || undefined,
      packageName: labels.package || labels.packagename || undefined,
      modApkUrl: this.findDownloadLink($, url) ?? undefined,
      modFeatures,
    };
  }
}

/* ─────────────────────────── registry ─────────────────────────── */

const REGISTRY: Record<AgentSource, () => BaseScraper> = {
  apkmirror: () => new ApkMirrorScraper(),
  apkpure: () => new ApkPureScraper(),
  happymod: () => new HappyModScraper(),
  moddroid: () => new ModDroidScraper(),
  an1: () => new An1Scraper(),
  apkaward: () => new ApkAwardScraper(),
  revdl: () => new RevDlScraper(),
  liteapks: () => new LiteApksScraper(),
};

const instances = new Map<AgentSource, BaseScraper>();

export function getScraper(source: AgentSource): BaseScraper {
  let s = instances.get(source);
  if (!s) {
    s = REGISTRY[source]();
    instances.set(source, s);
  }
  return s;
}

/** Resolves the right adapter for an arbitrary URL, or null if unsupported. */
export function scraperForUrl(url: string): BaseScraper | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }

  const MAP: Array<[RegExp, AgentSource]> = [
    [/apkmirror\.com$/, 'apkmirror'],
    [/apkpure\.(com|net|org|io)$/, 'apkpure'],
    [/happymod\.(com|io|net)$/, 'happymod'],
    [/moddroid\.(co|com)$/, 'moddroid'],
    [/an1\.(com|net)$/, 'an1'],
    [/apkaward\.com$/, 'apkaward'],
    [/revdl\.com$/, 'revdl'],
    [/liteapks\.com$/, 'liteapks'],
  ];

  for (const [re, source] of MAP) {
    if (re.test(host)) return getScraper(source);
  }
  return null;
}

export { BaseScraper };
export type { ListingItem };

/** Exposed for tests: parse a raw HTML string with a given adapter. */
export function parseWithAdapter(source: AgentSource, $: CheerioRoot, url: string): Partial<ScrapedGame> {
  return getScraper(source).parseDetail($, url);
}

export const helpers = { stripHtml, parseSizeToBytes };
