import * as cheerio from 'cheerio';
import type { AgentSource, ScrapedGame } from '@modverse/shared';
import { absoluteUrl, parseSizeToBytes, stripHtml, unique } from '@modverse/shared';
import { AGENT_SOURCE_META } from '@modverse/shared';
import { fetchHtml } from '../core/browser.js';
import { fetchText, isAllowedByRobots } from '../core/http.js';
import { createLogger, type Logger } from '../core/logger.js';

export type CheerioRoot = cheerio.CheerioAPI;

/**
 * Minimum confidence required before a parsed page is accepted as a game
 * listing. Tuned so a page needs at least a couple of hard app signals
 * (package name, size, version, store link) rather than just a title.
 */
const MIN_GAME_PAGE_CONFIDENCE = 0.45;

export interface ListingItem {
  url: string;
  title?: string;
  version?: string;
}

/**
 * Base scraper.
 *
 * Site-specific adapters override `parseListing` / `parseDetail`, but inherit
 * a large set of generic extractors that already work on most MOD APK sites
 * because nearly all of them use the same structured-data conventions
 * (JSON-LD SoftwareApplication, OpenGraph, or a WordPress theme).
 */
export abstract class BaseScraper {
  abstract readonly source: AgentSource;
  protected readonly log: Logger;

  /** Set true when a site needs JS execution to render content. */
  protected usePlaywright = false;

  constructor() {
    this.log = createLogger(`scraper:${this.constructor.name}`);
  }

  get origin(): string {
    return AGENT_SOURCE_META[this.source].origin;
  }

  get listUrl(): string {
    const meta = AGENT_SOURCE_META[this.source];
    return `${meta.origin}${meta.listPath}`;
  }

  /* ───────────────────────── fetching ───────────────────────── */

  protected async loadHtml(url: string, opts: { scroll?: boolean; waitFor?: string } = {}): Promise<CheerioRoot | null> {
    if (!(await isAllowedByRobots(url))) {
      this.log.warn(`robots.txt disallows ${url}`);
      return null;
    }

    let html: string | null = null;

    if (this.usePlaywright) {
      html = await fetchHtml(url, opts);
    } else {
      html = await fetchText(url).catch(() => null);
      // Some pages return a JS challenge shell; fall back to a real browser.
      if (!html || html.length < 800 || /just a moment|enable javascript|cf-browser-verification/i.test(html)) {
        this.log.debug(`falling back to Playwright for ${url}`);
        html = await fetchHtml(url, opts);
      }
    }

    if (!html) return null;

    const $ = cheerio.load(html);

    // Soft-redirect detection: many MOD sites answer an unknown slug with a
    // 200 and a canonical pointing at a completely different article.
    const canonical = $('link[rel="canonical"]').attr('href') ?? $('meta[property="og:url"]').attr('content');
    if (canonical && !this.sameContentPath(url, canonical)) {
      this.log.warn(`soft redirect detected: ${url} → ${canonical}`);
      return null;
    }

    return $;
  }

  /** Compares two URLs ignoring protocol, www, trailing slash and query. */
  protected sameContentPath(a: string, b: string): boolean {
    const norm = (raw: string): string | null => {
      try {
        const u = new URL(raw, this.origin);
        return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '').toLowerCase()}`;
      } catch {
        return null;
      }
    };
    const na = norm(a);
    const nb = norm(b);
    if (!na || !nb) return true; // cannot compare — do not block
    return na === nb;
  }

  /* ───────────────────────── contract ───────────────────────── */

  /** Returns candidate detail-page URLs from a listing/index page. */
  abstract parseListing($: CheerioRoot, pageUrl: string): ListingItem[];

  /** Extracts a full game record from a detail page. */
  abstract parseDetail($: CheerioRoot, url: string): Partial<ScrapedGame>;

  /* ───────────────────────── public API ───────────────────────── */

  async discover(limit = 20, pageUrl?: string): Promise<ListingItem[]> {
    const url = pageUrl ?? this.listUrl;
    const $ = await this.loadHtml(url, { scroll: true });
    if (!$) {
      this.log.warn(`could not load listing ${url}`);
      return [];
    }
    const items = this.parseListing($, url)
      .filter((i) => i.url.startsWith('http'))
      .filter((i, idx, arr) => arr.findIndex((x) => x.url === i.url) === idx);

    this.log.info(`discovered ${items.length} candidates from ${this.source}`);
    return items.slice(0, limit);
  }

  /**
   * Confidence score (0-1) that a parsed page is really a game/app listing.
   *
   * MOD APK sites answer unknown URLs with a 200 and a soft-redirect to an
   * unrelated article instead of a 404. Without this gate the pipeline will
   * happily manufacture a listing out of a news post.
   */
  protected scoreAsGamePage(candidate: ScrapedGame, $: CheerioRoot): { score: number; signals: string[] } {
    const signals: string[] = [];
    let score = 0;

    const add = (points: number, label: string) => {
      score += points;
      signals.push(label);
    };

    // ── strong signals: only an app listing realistically has these ──
    if (candidate.packageName) add(0.4, 'package-name');
    if (candidate.playStoreUrl) add(0.3, 'play-store-link');
    if (candidate.sizeBytes || candidate.sizeText) add(0.25, 'file-size');
    if (candidate.androidVersion) add(0.25, 'android-version');
    if (candidate.modApkUrl || candidate.originalApkUrl) add(0.2, 'download-link');

    // ── supporting signals ──
    if (candidate.version) add(0.15, 'version');
    if (candidate.modFeatures.length >= 2) add(0.15, 'mod-features');
    if (candidate.developer) add(0.1, 'developer');
    if (candidate.screenshotUrls.length >= 2) add(0.1, 'screenshots');
    if (/\b(mod|apk|download)\b/i.test(candidate.title)) add(0.1, 'title-keyword');

    const ld = this.readJsonLd($);
    const ldType = ld?.['@type'];
    const typeStr = Array.isArray(ldType) ? ldType.join(',') : String(ldType ?? '');
    if (/SoftwareApplication|MobileApplication|VideoGame/i.test(typeStr)) {
      add(0.4, 'app-schema');
    } else if (/NewsArticle|BlogPosting/i.test(typeStr)) {
      // Explicit negative: the page declares itself as editorial content.
      add(-0.5, 'article-schema(-)');
    }

    return { score: Math.max(0, Math.min(1, score)), signals };
  }

  async scrape(url: string): Promise<ScrapedGame | null> {
    const $ = await this.loadHtml(url, { scroll: true });
    if (!$) return null;

    // Generic extraction first, then let the adapter refine/override.
    const generic = this.genericExtract($, url);
    const specific = this.parseDetail($, url);

    const merged: ScrapedGame = {
      ...generic,
      ...pruneUndefined(specific),
      source: this.source,
      sourceUrl: url,
      scrapedAt: new Date().toISOString(),
      title: (specific.title || generic.title || '').trim(),
      modFeatures: unique([...(generic.modFeatures ?? []), ...(specific.modFeatures ?? [])]).slice(0, 24),
      screenshotUrls: unique([...(specific.screenshotUrls ?? []), ...(generic.screenshotUrls ?? [])]).slice(0, 12),
    };

    if (!merged.title) {
      this.log.warn(`no title extracted from ${url}`);
      return null;
    }

    // Normalise size once at the boundary.
    if (!merged.sizeBytes && merged.sizeText) {
      merged.sizeBytes = parseSizeToBytes(merged.sizeText);
    }

    // Reject pages that do not look like an app listing (soft-404s and
    // redirected news articles are the common case).
    const { score, signals } = this.scoreAsGamePage(merged, $);
    if (score < MIN_GAME_PAGE_CONFIDENCE) {
      this.log.warn(
        `rejected ${url}: does not look like a game page (confidence ${score.toFixed(2)}, signals: ${signals.join(', ') || 'none'})`,
      );
      return null;
    }
    this.log.debug(`page confidence ${score.toFixed(2)} [${signals.join(', ')}]`);

    return merged;
  }

  /* ─────────────────── generic extraction helpers ─────────────────── */

  /**
   * Extracts everything derivable from standards: JSON-LD, OpenGraph,
   * meta tags and common label/value tables.
   */
  protected genericExtract($: CheerioRoot, url: string): ScrapedGame {
    const ld = this.readJsonLd($);
    const og = (prop: string) => $(`meta[property="og:${prop}"]`).attr('content')?.trim();
    const meta = (name: string) => $(`meta[name="${name}"]`).attr('content')?.trim();

    const title =
      (ld?.name as string) ||
      og('title') ||
      $('h1').first().text().trim() ||
      $('title').text().split(/[|\-–—]/)[0]?.trim() ||
      '';

    const descriptionHtml =
      $('#description, .description, .game-description, .entry-content, .post-content, article .content').first().html() ??
      undefined;

    const descriptionText =
      (ld?.description as string) ||
      (descriptionHtml ? stripHtml(descriptionHtml) : undefined) ||
      og('description') ||
      meta('description') ||
      undefined;

    const labels = this.readLabelTable($);

    const version =
      (ld?.softwareVersion as string) ||
      labels.version ||
      // Headings are the most reliable non-structured source ("Game MOD APK v1.2.3").
      this.matchFirst($('h1').first().text(), [/\bv?(\d+(?:\.\d+){1,3}[a-z0-9._-]*)/i]) ||
      this.matchFirst($('title').text(), [/\bv?(\d+(?:\.\d+){1,3}[a-z0-9._-]*)/i]) ||
      this.matchFirst($.html(), [
        /(?:version|ver)[\s:]+v?(\d+(?:\.\d+){1,3}[a-z0-9._-]*)/i,
        /\bv(\d+(?:\.\d+){2,3})\b/i,
      ]) ||
      undefined;

    const sizeText = (ld?.fileSize as string) || labels.size || undefined;

    const androidVersion =
      (ld?.operatingSystem as string) ||
      labels.android ||
      labels.requirements ||
      this.matchFirst($.html(), [/android\s*([\d.]+\+?)\s*(?:and up|or higher|\+)?/i]) ||
      undefined;

    const developer =
      (typeof ld?.author === 'object' && ld?.author !== null ? (ld.author as any).name : undefined) ||
      labels.developer ||
      labels.publisher ||
      labels.offeredby ||
      undefined;

    const packageName = this.sanitisePackageName(
      labels.package ||
        labels.packagename ||
        labels.packageid ||
        this.matchFirst($.html(), [
          // Only trust a package name from an unambiguous context.
          /play\.google\.com\/store\/apps\/details\?id=([a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*){1,})/,
          /data-package=["']([a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*){2,})["']/,
          // Labelled in prose or a table cell: "Package: com.vendor.app".
          // Anchored on the label so it cannot drift onto arbitrary JS.
          /\b(?:package|package\s*name|package\s*id|app\s*id)\b\s*[:=]\s*["']?([a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*){2,})/i,
          /["'](?:packageName|package_name|appId|app_id)["']\s*:\s*["']([a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*){2,})["']/,
        ]),
    );

    const playStoreUrl =
      $('a[href*="play.google.com/store/apps/details"]').first().attr('href') ||
      (packageName ? `https://play.google.com/store/apps/details?id=${packageName}` : undefined);

    const iconUrl =
      (ld?.image as string) ||
      $('.app-icon img, .game-icon img, .entry-thumb img, .post-thumbnail img, img.icon').first().attr('src') ||
      og('image') ||
      undefined;

    const screenshotUrls = this.collectScreenshots($, url);

    const rating = this.parseRating(ld);

    const modFeatures = this.collectModFeatures($);

    const whatsNew =
      $('#whatsnew, .whats-new, .changelog, .what-new').first().text().trim().slice(0, 4000) || undefined;

    return {
      source: this.source,
      sourceUrl: url,
      title,
      originalName: title || null,
      version: version ?? null,
      modVersion: labels.modversion ?? null,
      packageName: packageName ?? null,
      developer: developer ?? null,
      publisher: labels.publisher ?? null,
      categoryHint: labels.category ?? (ld?.applicationCategory as string) ?? null,
      androidVersion: androidVersion ?? null,
      requirements: labels.requirements ?? null,
      sizeText: sizeText ?? null,
      sizeBytes: parseSizeToBytes(sizeText),
      rating,
      descriptionHtml: descriptionHtml ?? null,
      descriptionText: descriptionText ?? null,
      modFeatures,
      whatsNew: whatsNew ?? null,
      iconUrl: absoluteUrl(iconUrl, url),
      bannerUrl: absoluteUrl(og('image') ?? null, url),
      screenshotUrls,
      playStoreUrl: absoluteUrl(playStoreUrl ?? null, url),
      originalApkUrl: null,
      modApkUrl: null,
      releaseDate: labels.released ?? null,
      updatedDate: labels.updated ?? labels.lastupdated ?? null,
      scrapedAt: new Date().toISOString(),
    };
  }

  /** Reads the first SoftwareApplication-ish JSON-LD node. */
  protected readJsonLd($: CheerioRoot): Record<string, unknown> | null {
    const nodes: Record<string, unknown>[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = $(el).contents().text();
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed];
        for (const node of list) if (node && typeof node === 'object') nodes.push(node);
      } catch {
        /* malformed JSON-LD is common — ignore */
      }
    });

    const preferred = ['SoftwareApplication', 'MobileApplication', 'WebApplication', 'Product', 'VideoGame'];
    for (const type of preferred) {
      const hit = nodes.find((n) => {
        const t = n['@type'];
        return Array.isArray(t) ? t.includes(type) : t === type;
      });
      if (hit) return hit;
    }
    return nodes[0] ?? null;
  }

  /**
   * Harvests "Label: Value" pairs from tables, definition lists and the
   * label/value div patterns used by most MOD APK WordPress themes.
   */
  protected readLabelTable($: CheerioRoot): Record<string, string> {
    const out: Record<string, string> = {};

    const put = (rawKey: string, rawValue: string) => {
      const key = rawKey
        .toLowerCase()
        .replace(/[^a-z]/g, '')
        .replace(/^(app|game)/, '');
      const value = rawValue.replace(/\s+/g, ' ').trim();
      if (!key || !value || value.length > 300) return;
      if (!out[key]) out[key] = value;
    };

    $('table tr').each((_, tr) => {
      const cells = $(tr).find('th, td');
      if (cells.length >= 2) put($(cells[0]!).text(), $(cells[1]!).text());
    });

    $('dl').each((_, dl) => {
      const dts = $(dl).find('dt');
      const dds = $(dl).find('dd');
      dts.each((i, dt) => {
        const dd = dds[i];
        if (dd) put($(dt).text(), $(dd).text());
      });
    });

    $('li, .info-row, .app-info-item, .detail-item, .single-info').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length > 200) return;
      const m = /^([A-Za-z][A-Za-z \-/]{2,24})\s*[:：]\s*(.+)$/.exec(text);
      if (m?.[1] && m[2]) put(m[1], m[2]);
    });

    return out;
  }

  protected collectScreenshots($: CheerioRoot, base: string): string[] {
    const urls: string[] = [];
    const SELECTORS = [
      '.screenshots img',
      '.screenshot img',
      '.gallery img',
      '.swiper-slide img',
      '.slider img',
      '[class*="screenshot"] img',
      '[class*="gallery"] img',
      'figure img',
    ];

    for (const sel of SELECTORS) {
      $(sel).each((_, el) => {
        const $el = $(el);
        const src = $el.attr('data-src') || $el.attr('data-lazy-src') || $el.attr('data-original') || $el.attr('src');
        const abs = absoluteUrl(src ?? null, base);
        if (!abs) return;
        if (/logo|icon|avatar|placeholder|loading|blank|spinner|1x1/i.test(abs)) return;
        if (!/\.(jpe?g|png|webp|avif)(\?|$)/i.test(abs)) return;
        urls.push(abs);
      });
      if (urls.length >= 4) break;
    }

    return unique(urls).slice(0, 12);
  }

  /**
   * Finds the "MOD Features" / "MOD Info" list, which is the single most
   * important field on a MOD APK page and is almost always a <ul> under a
   * heading containing "mod".
   */
  protected collectModFeatures($: CheerioRoot): string[] {
    const features: string[] = [];

    $('h1, h2, h3, h4, h5, strong, b, .mod-title').each((_, el) => {
      const heading = $(el).text().toLowerCase();
      if (!/\bmod\b/.test(heading)) return;
      if (!/(feature|info|menu|apk info|what.s in)/.test(heading)) return;

      let node = $(el).next();
      for (let hops = 0; hops < 4 && node.length; hops += 1) {
        if (node.is('ul, ol')) {
          node.find('li').each((__, li) => {
            const text = $(li).text().replace(/\s+/g, ' ').trim();
            if (text.length >= 3 && text.length <= 200) features.push(text);
          });
          break;
        }
        if (node.is('p') && node.text().includes('\n')) {
          node
            .text()
            .split('\n')
            .map((l) => l.replace(/^[•\-*–]\s*/, '').trim())
            .filter((l) => l.length >= 3 && l.length <= 200)
            .forEach((l) => features.push(l));
          break;
        }
        node = node.next();
      }
    });

    // Fallback: scan for classic mod phrases anywhere in the body text.
    if (features.length === 0) {
      const body = $('body').text();
      const PATTERNS = [
        /unlimited\s+(?:money|coins?|gems?|gold|cash|diamonds?|ammo|health|energy|lives|resources)/gi,
        /(?:all|premium|full)\s+(?:unlocked|characters?\s+unlocked|levels?\s+unlocked|skins?\s+unlocked)/gi,
        /(?:no|remove[d]?)\s+ads/gi,
        /god\s*mode/gi,
        /one\s*hit\s*(?:kill|ko)/gi,
        /free\s+(?:shopping|purchase|craft)/gi,
        /mod\s*menu/gi,
        /anti[\s-]?ban/gi,
        /unlocked\s+premium/gi,
      ];
      for (const re of PATTERNS) {
        const hits = body.match(re);
        if (hits) features.push(...hits.map((h) => this.titleCase(h.replace(/\s+/g, ' ').trim())));
      }
    }

    return unique(features.map((f) => f.replace(/^[•\-*–]\s*/, '').trim()))
      .filter((f) => f.length >= 3 && f.length <= 200)
      .slice(0, 24);
  }

  protected parseRating(ld: Record<string, unknown> | null): number | null {
    const agg = ld?.aggregateRating as Record<string, unknown> | undefined;
    const raw = agg?.ratingValue ?? ld?.ratingValue;
    const value = typeof raw === 'string' ? Number.parseFloat(raw) : typeof raw === 'number' ? raw : NaN;
    if (!Number.isFinite(value)) return null;
    // Some sites report out of 10 or 100 — normalise to 5.
    if (value > 10) return Math.min(5, Number((value / 20).toFixed(2)));
    if (value > 5) return Math.min(5, Number((value / 2).toFixed(2)));
    return Number(value.toFixed(2));
  }

  /**
   * Rejects strings that look like a package name but are really JS
   * identifiers, filenames or CSS selectors picked up by a loose regex.
   */
  protected sanitisePackageName(raw: string | null | undefined): string | undefined {
    if (!raw) return undefined;
    const value = raw.trim().replace(/^["']|["']$/g, '');
    if (!/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*){1,}$/.test(value)) return undefined;
    if (value.length < 6 || value.length > 160) return undefined;

    const BAD_PREFIX = /^(window|document|navigator|console|location|self|globalThis|jquery|\$|this|module|exports|process|require)\b/i;
    if (BAD_PREFIX.test(value)) return undefined;

    const BAD_SUFFIX = /\.(js|css|png|jpg|jpeg|webp|gif|svg|html|php|json|xml|apk|zip|min|href|length|value|src|com|net|org|io|co|innerHTML|textContent)$/i;
    if (BAD_SUFFIX.test(value)) return undefined;

    // A real Android package has at least two dots (com.vendor.app) except
    // for a handful of legacy two-segment ids, which we still allow.
    const segments = value.split('.');
    if (segments.length < 2) return undefined;
    if (segments.some((seg) => seg.length === 0)) return undefined;

    return value;
  }

  protected matchFirst(html: string | null, patterns: RegExp[]): string | undefined {
    if (!html) return undefined;
    for (const re of patterns) {
      const m = re.exec(html);
      if (m?.[1]) return m[1].trim();
    }
    return undefined;
  }

  protected titleCase(text: string): string {
    return text.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  /** Finds a plausible direct APK/download link on a detail page. */
  protected findDownloadLink($: CheerioRoot, base: string): string | null {
    const candidates: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const text = $(el).text().toLowerCase();
      const cls = ($(el).attr('class') ?? '').toLowerCase();
      const looksLikeDownload =
        /\.apk(\?|$)|\.xapk(\?|$)|\/download\/|\/dl\/|download\.php/i.test(href) ||
        /download|télécharger|descargar/.test(text) ||
        /download|btn-dl/.test(cls);
      if (!looksLikeDownload) return;
      const abs = absoluteUrl(href, base);
      if (abs && !/facebook|twitter|telegram|whatsapp|play\.google/i.test(abs)) candidates.push(abs);
    });
    // Prefer explicit .apk URLs.
    return candidates.find((c) => /\.(apk|xapk)(\?|$)/i.test(c)) ?? candidates[0] ?? null;
  }
}

function pruneUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)) {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}
