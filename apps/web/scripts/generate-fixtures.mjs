/**
 * Generates src/data/fixtures.generated.ts — the demo dataset used when
 * Supabase is not configured. Deterministic: same input => same output,
 * so builds are reproducible and diffs stay clean.
 *
 * Run: node scripts/generate-fixtures.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../src/data/fixtures.generated.ts');

/* deterministic PRNG */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const rnd = (seed) => (hash(seed) % 100000) / 100000;
const between = (seed, min, max) => min + rnd(seed) * (max - min);
const intBetween = (seed, min, max) => Math.floor(between(seed, min, max + 1));
const choice = (seed, arr) => arr[Math.floor(rnd(seed) * arr.length)];

const slugify = (s) =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
const gameSlug = (n) => `${slugify(n.replace(/\b(mod|apk)\b/gi, ''))}-mod-apk`;

/* ── seed catalogue ── */
const SEEDS = [
  ['Subway Surfers','com.kiloo.subwaysurf','SYBO Games','arcade','3.41.0',['Endless Runner','Offline','Casual'],['Unlimited Coins','Unlimited Keys','All Characters Unlocked','No Ads'],152,4.6,'trending,popular,offline','Dash through subways dodging trains in this record-breaking endless runner.'],
  ['Minecraft','com.mojang.minecraftpe','Mojang Studios','adventure','1.21.44',['Sandbox','Building','Offline'],['Premium Skins Unlocked','Unlimited Resources','God Mode','All Textures'],745,4.8,'premium,editors-choice,offline','Build, mine and survive in the infinite blocky sandbox that defined a genre.'],
  ['Stardew Valley','com.chucklefish.stardewvalley','ConcernedApe','simulation','1.6.14',['Farming','Offline','Pixel Art'],['Unlimited Money','Max Energy','All Seeds Unlocked','Instant Growth'],385,4.9,'premium,offline,editors-choice','Inherit a run-down farm and rebuild it into a thriving countryside empire.'],
  ['Asphalt 9 Legends','com.gameloft.android.ANMP.GloftA9HM','Gameloft','racing','4.9.1a',['Arcade Racing','Multiplayer','Cars'],['Unlimited Tokens','All Cars Unlocked','Nitro Never Ends','Free Upgrades'],2450,4.5,'trending,popular','Drive 200+ licensed hypercars through cinematic arcade racing spectacle.'],
  ['Among Us','com.innersloth.spacemafia','InnerSloth LLC','casual','2024.11.26',['Social Deduction','Multiplayer','Party'],['All Skins Unlocked','All Pets Unlocked','Always Impostor','No Ads'],238,4.3,'popular,mod-menu','Find the impostor aboard your spaceship before the crew is picked off.'],
  ['Clash of Clans','com.supercell.clashofclans','Supercell','strategy','16.386.16',['Base Building','PvP','Strategy'],['Unlimited Gems','Unlimited Gold','Unlimited Elixir','Fast Building'],385,4.6,'popular,mod-menu','Build your village, train troops and raid rivals in the classic strategy war.'],
  ['Monument Valley 3','com.ustwo.monumentvalley3','ustwo games','puzzle','1.2.9',['Puzzle','Offline','Artistic'],['Full Game Unlocked','All Chapters','No Ads','Premium Content'],620,4.9,'premium,editors-choice,offline','Guide a silent princess through impossible Escher-inspired architecture.'],
  ['Dead Cells','com.playdigious.deadcells.mobile','Playdigious','action','3.5.2',['Roguelike','Metroidvania','Offline'],['All Weapons Unlocked','Unlimited Cells','God Mode','All DLC Unlocked'],1180,4.8,'premium,editors-choice,offline','A brutal roguevania where every death teaches and every run feels fresh.'],
  ['PUBG Mobile','com.tencent.ig','Level Infinite','shooter','3.6.0',['Battle Royale','Multiplayer','FPS'],['Aimbot Menu','No Recoil','Wallhack','Unlimited UC'],1890,4.2,'trending,mod-menu','Drop into a 100-player battle royale and be the last squad standing.'],
  ['Genshin Impact','com.miHoYo.GenshinImpact','HoYoverse','rpg','5.3.0',['Open World','Gacha','Anime'],['Unlimited Primogems','All Characters','Damage Multiplier','Free Wishes'],4200,4.4,'trending,popular','Explore the vast anime fantasy world of Teyvat with elemental combat.'],
  ['FIFA Soccer','com.ea.gp.fifamobile','ELECTRONIC ARTS','sports','23.0.05',['Football','Sports','Multiplayer'],['Unlimited Coins','All Players Unlocked','Max Stats','Free Packs'],1420,4.1,'popular','Build your ultimate football squad and compete in live events.'],
  ['Hill Climb Racing 2','com.fingersoft.hcr2','Fingersoft','racing','1.61.1',['Physics','Offline','Casual'],['Unlimited Coins','All Vehicles','Max Upgrades','No Ads'],168,4.5,'offline,popular','Physics-based uphill racing with wildly upgradeable vehicles.'],
  ['Plants vs Zombies 2','com.ea.game.pvz2_row','ELECTRONIC ARTS','strategy','11.6.1',['Tower Defense','Offline','Casual'],['Unlimited Coins','Unlimited Gems','All Plants Unlocked','Max Sun'],920,4.4,'offline,popular','Defend your lawn across time periods with an arsenal of plants.'],
  ['Alto\u2019s Odyssey','com.noodlecake.altosodyssey','Noodlecake','arcade','1.0.30',['Endless','Relaxing','Offline'],['Unlimited Coins','All Characters','No Ads','Full Unlock'],185,4.8,'premium,offline,editors-choice','A serene endless sandboarding journey across dunes and temples.'],
  ['Shadow Fight 4','com.nekki.shadowfight4','NEKKI','action','1.9.12',['Fighting','Martial Arts','PvP'],['Unlimited Gems','All Heroes Unlocked','Max Level','One Hit Kill'],780,4.5,'trending,mod-menu','Cinematic 3D fighting with deep martial arts combos and hero collecting.'],
  ['The Sims Mobile','com.ea.simsfreeplay_row','ELECTRONIC ARTS','simulation','45.0.1',['Life Sim','Building','Casual'],['Unlimited Simoleons','Unlimited Cash','All Items Unlocked','Max Skills'],640,4.2,'popular','Create Sims, design homes and script the lives you always wanted.'],
  ['Brawl Stars','com.supercell.brawlstars','Supercell','shooter','59.197',['MOBA','Multiplayer','Arcade'],['Unlimited Gems','All Brawlers','Max Power Level','Free Skins'],420,4.4,'trending,mod-menu','Fast 3v3 brawls and battle royale with a huge roster of characters.'],
  ['Terraria','com.and.games505.TerrariaPaid','505 Games','adventure','1.4.4.9.6',['Sandbox','Offline','2D'],['Full Version Unlocked','Unlimited Items','God Mode','All Bosses'],195,4.7,'premium,offline','Dig, fight and build across a procedurally generated 2D world.'],
  ['Real Racing 3','com.ea.games.r3_row','ELECTRONIC ARTS','racing','12.6.1',['Simulation','Cars','Multiplayer'],['Unlimited Money','Unlimited Gold','All Cars Unlocked','No Damage'],2900,4.3,'popular','Console-grade racing simulation with real tracks and licensed cars.'],
  ['Candy Crush Saga','com.king.candycrushsaga','King','puzzle','1.283.0.2',['Match 3','Casual','Offline'],['Unlimited Lives','Unlimited Moves','All Levels Unlocked','No Ads'],95,4.6,'popular,offline','The match-three phenomenon with thousands of sugary levels.'],
  ['Bloons TD 6','com.ninjakiwi.bloonstd6','Ninja Kiwi','strategy','44.2',['Tower Defense','Offline','Strategy'],['Unlimited Monkey Money','All Towers Unlocked','Free Upgrades','God Mode'],168,4.8,'premium,offline,editors-choice','Deep, endlessly replayable tower defense with monkeys and bloons.'],
  ['Standoff 2','com.axlebolt.standoff2','AXLEBOLT LTD','shooter','0.31.2',['FPS','Multiplayer','Competitive'],['Aim Assist','Unlimited Gold','All Skins','No Recoil'],1650,4.5,'trending,mod-menu','Competitive tactical FPS with skins, ranks and esports ambitions.'],
  ['GRID Autosport','com.feralinteractive.gridautosport','Feral Interactive','racing','1.10.1RC5',['Simulation','Premium','Offline'],['Full Game Unlocked','All DLC','Unlimited Credits','All Cars'],4900,4.6,'premium,offline','A full console racing sim, faithfully ported to mobile.'],
  ['Eight-Bit Dungeon','com.pixelforge.eightbitdungeon','Pixel Forge','rpg','2.4.0',['Retro','Roguelike','Offline'],['Unlimited Gold','All Classes Unlocked','Max Stats','No Ads'],88,4.4,'offline,latest','Retro dungeon crawling with permadeath and pixel-perfect combat.'],
  ['Neon Drift Arena','com.voltstudio.neondrift','Volt Studio','racing','1.8.3',['Drifting','Neon','Arcade'],['Unlimited Nitro','All Cars Unlocked','Unlimited Cash','Ghost Mode'],540,4.3,'latest,trending','Synthwave drift racing through rain-soaked neon cityscapes.'],
  ['Horror Hospital Escape','com.darkloop.horrorhospital','DarkLoop Games','horror','3.2.1',['Survival Horror','Offline','Escape'],['Unlimited Batteries','God Mode','All Chapters','No Ads'],720,4.1,'offline,latest','Escape an abandoned hospital while something hunts you in the dark.'],
  ['Sky Fortress Tactics','com.ironvale.skyfortress','Ironvale','strategy','2.0.7',['Turn Based','Tactics','Offline'],['Unlimited Resources','All Units Unlocked','Skip Cooldowns','Max Level'],410,4.5,'latest,editors-choice','Turn-based airborne tactics across floating island battlefields.'],
  ['Cricket League Pro','com.stumpmedia.cricketleague','Stump Media','sports','4.1.2',['Cricket','Multiplayer','Sports'],['Unlimited Coins','All Teams Unlocked','Perfect Timing','No Ads'],310,4.2,'popular,latest','Fast two-over cricket matches with real-time online multiplayer.'],
];

const now = Date.now();
const DAY = 86400000;
const ANDROID = ['7.0+','8.0+','9.0+','10.0+','11.0+','12.0+','13.0+'];

function mediaAsset(seed, w, h, alt) {
  return {
    url: `https://picsum.photos/seed/${seed}/${w}/${h}.webp`,
    width: w, height: h, alt, format: 'webp',
    bytes: intBetween(seed + 'b', 40000, 320000),
  };
}

function buildGame(seed, i) {
  const [name, pkg, dev, category, version, genres, features, sizeMb, rating, collectionsCsv, tagline] = seed;
  const slug = gameSlug(name);
  const s = slug;
  const publishedAt = new Date(now - intBetween(s + 'pub', 1, 240) * DAY);
  const updatedDate = new Date(publishedAt.getTime() + intBetween(s + 'upd', 0, 30) * DAY);
  const downloads = intBetween(s + 'dl', 25000, 4800000);
  const views = downloads + intBetween(s + 'vw', 10000, 900000);
  const collections = collectionsCsv.split(',').filter(Boolean);
  if (i < 6 && !collections.includes('latest')) collections.push('latest');
  if (updatedDate.getTime() > now - 21 * DAY) collections.push('recently-updated');

  const modVersion = `v${version.split('.').slice(0, 2).join('.')}-mod`;
  const sizeBytes = Math.round(sizeMb * 1024 * 1024);
  const androidVersion = choice(s + 'av', ANDROID);
  const year = new Date().getFullYear();

  const description = [
    `<p><strong>${name} MOD APK</strong> is the fully unlocked build of ${dev}'s ${category} hit, rebuilt for players who want the complete experience without the grind. ${tagline}</p>`,
    `<h2>About ${name}</h2>`,
    `<p>${tagline} Since launch it has grown into one of the most-played ${genres[0].toLowerCase()} titles on Android, and version ${version} refines progression pacing, netcode and rendering performance on mid-range hardware.</p>`,
    `<p>This modded release keeps the original gameplay loop intact and simply removes the paywalls: ${features.slice(0, 3).map((f) => f.toLowerCase()).join(', ')} and more are enabled from the first launch.</p>`,
    `<h2>Gameplay</h2>`,
    `<p>Sessions are designed for mobile: short, readable and immediately satisfying. Controls are tuned for touch with adjustable sensitivity, and the interface scales cleanly from compact phones to tablets. Because the MOD unlocks the full content library, every mode, map and character is reachable without waiting on timers.</p>`,
    `<h2>Why choose the MOD version?</h2>`,
    `<p>The stock build gates its best content behind in-app purchases and energy timers. The MOD removes both, so you keep the design and drop the friction. Every APK on MODSzora is signature-checked and scanned before publication.</p>`,
  ].join('\n');

  const faqs = [
    { question: `Is ${name} MOD APK safe to install?`, answer: `Yes. Every ${name} APK published on MODSzora is scanned with multiple antivirus engines and signature-verified before release. Install only from this page to be sure you have the untampered file.` },
    { question: `Do I need root to run ${name} MOD APK?`, answer: `No root is required. The mod runs on any stock Android ${androidVersion.replace('+','')} or newer device. Just enable "Install unknown apps" for your browser or file manager and tap the APK.` },
    { question: `Will ${name} MOD work online?`, answer: `Offline and single-player content works fully. Online modes may detect modified clients, so use a secondary account if you plan to play competitively.` },
    { question: `How do I update ${name} MOD APK?`, answer: `Return to this page and download the newest version. MODSzora tracks upstream releases automatically, so this listing reflects ${version} as of ${updatedDate.toLocaleDateString('en-US',{month:'long',year:'numeric'})}.` },
    { question: `Why did the installation fail?`, answer: `The most common cause is an existing copy signed with a different key. Uninstall the Play Store build first, then reinstall the MOD APK and grant storage permission when prompted.` },
  ];

  const installationGuide = [
    `Tap the Download button above and wait for ${name}-v${version}-MODSzora.apk to finish downloading.`,
    'Open Settings → Security and enable "Install unknown apps" for your browser or file manager.',
    'Uninstall any existing copy of the game to avoid a signature conflict.',
    'Open the downloaded APK and confirm the install prompt.',
    sizeMb > 500 ? 'Extract the included OBB folder to Android/obb/ before first launch.' : 'Launch the game and allow storage permission when prompted.',
    'Verify the mod menu appears on the main screen, then start playing.',
  ];

  const screenshots = Array.from({ length: 5 }, (_, k) =>
    mediaAsset(`${s}-shot-${k}`, 1080, 1920, `${name} MOD APK gameplay screenshot ${k + 1}`),
  );

  const seoTitle = `${name} MOD APK ${version} (${features[0]})`;
  const metaDescription = `Download ${name} MOD APK v${version} — ${features.slice(0,2).join(' + ')}. Free, virus-scanned and updated for Android ${androidVersion}. ${year} release.`;

  return {
    slug, name, originalName: name, version, modVersion, packageName: pkg,
    developer: dev, publisher: dev, category,
    genres, tags: [...genres.map((g) => g.toLowerCase()), category, 'mod apk', 'android'],
    collections: [...new Set(collections)],
    androidVersion,
    requirements: `Android ${androidVersion.replace('+','')} or higher · ${sizeMb > 500 ? '3' : '2'} GB RAM · ${Math.ceil(sizeMb * 1.6)} MB free storage`,
    sizeBytes,
    rating, ratingCount: intBetween(s + 'rc', 1200, 240000),
    downloads, views,
    shortDescription: `${tagline} MOD unlocks ${features.slice(0, 2).join(' and ').toLowerCase()}.`.slice(0, 300),
    description,
    modFeatures: features,
    whatsNew: `• Updated to v${version}\n• ${choice(s+'wn',['Seasonal event content added','New characters and cosmetics','Reworked progression curve','Fresh maps and challenges'])}\n• Performance and memory optimisations\n• Mod menu re-verified against the latest build\n• Crash fixes reported by the community`,
    installationGuide,
    releaseDate: new Date(publishedAt.getTime() - intBetween(s+'rel',60,900) * DAY).toISOString(),
    updatedDate: updatedDate.toISOString(),
    status: 'published',
    publishedAt: publishedAt.toISOString(),
    scheduledFor: null,
    featured: i < 5,
    icon: mediaAsset(`${s}-icon`, 512, 512, `${name} icon`),
    banner: mediaAsset(`${s}-banner`, 1280, 720, `${name} banner`),
    screenshots,
    downloadLinks: [
      { label: 'Mega (Fast)', url: `https://mega.nz/file/${slugify(name).slice(0,8)}#demo-key`, kind: 'mega', sizeBytes, isPrimary: true },
      { label: 'Mirror Server', url: `https://mirror.modszora.app/${slug}.apk`, kind: 'mirror', sizeBytes, isPrimary: false },
      { label: 'Google Play', url: `https://play.google.com/store/apps/details?id=${pkg}`, kind: 'playstore', isPrimary: false },
    ],
    virusScan: {
      provider: 'VirusTotal', status: 'clean',
      scannedAt: new Date(now - intBetween(s+'vs',1,10) * DAY).toISOString(),
      detections: 0, engines: intBetween(s + 'eng', 58, 72),
      sha256: Array.from({length:64},(_,k)=>'0123456789abcdef'[hash(s+k)%16]).join(''),
    },
    faqs,
    seo: {
      title: seoTitle.slice(0, 70),
      description: metaDescription.slice(0, 180),
      keywords: [`${name.toLowerCase()} mod apk`,`${name.toLowerCase()} hack`,`${name.toLowerCase()} ${version}`,`download ${name.toLowerCase()}`,`${category} mod apk`,`${dev.toLowerCase()} mod`,`mod apk ${year}`,'android mod games','unlimited money apk'],
      canonical: null,
      ogTitle: seoTitle.slice(0, 95),
      ogDescription: metaDescription.slice(0, 200),
      ogImage: `https://picsum.photos/seed/${s}-banner/1200/630.webp`,
      twitterCard: 'summary_large_image',
      twitterTitle: seoTitle.slice(0, 70),
      twitterDescription: metaDescription.slice(0, 200),
      jsonLd: null, noindex: false,
    },
    playStoreUrl: `https://play.google.com/store/apps/details?id=${pkg}`,
    originalApkUrl: null,
    modApkUrl: null,
    megaUrl: `https://mega.nz/file/${slugify(name).slice(0,8)}#demo-key`,
    sourceSite: choice(s + 'src', ['happymod','moddroid','an1','apkaward','liteapks','revdl']),
    sourceUrl: `https://happymod.com/${slug}/${pkg}/`,
    contentHash: hash(s + version).toString(16).padStart(8, '0').repeat(8).slice(0, 64),
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    createdAt: publishedAt.toISOString(),
    updatedAt: updatedDate.toISOString(),
  };
}

const games = SEEDS.map(buildGame);

/* ── wallpapers ── */
const WP = [
  ['Neon Samurai Standoff','action'],['Cyber Ronin Skyline','sci-fi'],['Drift King Midnight','racing'],
  ['Dragon Realm Dawn','fantasy'],['Esports Arena Lights','esports'],['Minimal Controller','minimal'],
  ['Anime Blade Dancer','anime'],['Mech Pilot Cockpit','sci-fi'],['Battle Royale Drop','action'],
  ['Retro Arcade Grid','minimal'],['Shadow Assassin','characters'],['Galaxy Racer','racing'],
];
const wallpapers = WP.map(([title, category], i) => {
  const slug = slugify(title);
  return {
    slug, title, category,
    tags: [category, 'gaming wallpaper', '4k', 'phone'],
    image: mediaAsset(`wp-${slug}`, 1920, 1080, `${title} gaming wallpaper`),
    thumbnail: mediaAsset(`wp-${slug}`, 640, 360, `${title} thumbnail`),
    resolution: '1920x1080',
    downloads: intBetween(slug + 'd', 800, 42000),
    status: 'published',
    seo: {
      title: `${title} Gaming Wallpaper (4K Download)`.slice(0,70),
      description: `Download the ${title} gaming wallpaper in 4K for phone and desktop. Free ${category} wallpaper from the MODSzora gallery.`.slice(0,180),
      keywords: [`${slug} wallpaper`, `${category} wallpaper`, 'gaming wallpaper 4k', 'phone wallpaper', 'hd game background'],
      canonical: null, ogTitle: title, ogDescription: `${title} — free 4K gaming wallpaper.`,
      ogImage: `https://picsum.photos/seed/wp-${slug}/1200/630.webp`,
      twitterCard: 'summary_large_image', twitterTitle: title,
      twitterDescription: `${title} — free 4K gaming wallpaper.`, jsonLd: null, noindex: false,
    },
    id: `00000000-0000-4000-8001-${String(i).padStart(12, '0')}`,
    createdAt: new Date(now - intBetween(slug, 1, 180) * DAY).toISOString(),
  };
});

/* ── reviews ── */
const reviews = games.slice(0, 8).map((g, i) => {
  const s = g.slug + 'rev';
  const breakdown = {
    gameplay: Number(between(s + 'gp', 7.4, 9.7).toFixed(1)),
    graphics: Number(between(s + 'gr', 7.0, 9.6).toFixed(1)),
    content: Number(between(s + 'ct', 7.2, 9.5).toFixed(1)),
    performance: Number(between(s + 'pf', 6.8, 9.4).toFixed(1)),
    value: Number(between(s + 'vl', 8.0, 9.9).toFixed(1)),
  };
  const score = Number((Object.values(breakdown).reduce((a, b) => a + b, 0) / 5).toFixed(1));
  return {
    slug: `${g.slug.replace('-mod-apk','')}-review`,
    title: `${g.name} Review — Is the MOD Version Worth It in ${new Date().getFullYear()}?`,
    gameSlug: g.slug,
    summary: `We spent a full week with ${g.name} v${g.version} to see how the modded build holds up against the stock release on real hardware.`,
    body: [
      `<p>${g.name} has been near the top of the ${g.category} charts for years, and ${g.developer} keeps shipping meaningful updates. We installed v${g.version} on a mid-range device and a flagship to see how the modded build behaves in day-to-day play.</p>`,
      `<h2>First impressions</h2>`,
      `<p>Installation took under a minute and the mod menu appeared immediately. ${g.modFeatures[0]} works exactly as advertised, which changes the early game dramatically — the usual multi-hour onboarding grind collapses into a few minutes.</p>`,
      `<h2>Performance</h2>`,
      `<p>On the mid-range handset we held a stable frame rate at medium settings with occasional dips during heavy scenes. The flagship ran maxed out without complaint. Battery drain was consistent with the stock build, so the mod adds no measurable overhead.</p>`,
      `<h2>Content and balance</h2>`,
      `<p>Unlocking everything is a double-edged sword. If you enjoy progression systems, ${g.name} loses some of its pull. If you have played the original and simply want access to late-game content, this is the fastest route there.</p>`,
      `<h2>Verdict</h2>`,
      `<p>A confident recommendation for returning players and anyone allergic to energy timers. Newcomers may want a few hours with the stock version first to appreciate what the mod removes.</p>`,
    ].join('\n'),
    score, scoreBreakdown: breakdown,
    pros: ['Every unlock available from the first launch','No advertising interruptions at any point','Runs cleanly on mid-range hardware','Mod menu is stable and easy to toggle','Offline play fully supported'],
    cons: ['Progression loses tension once everything is unlocked','Online competitive modes carry ban risk','Large download on metered connections'],
    verdict: `${g.name} MOD APK delivers exactly what it promises: the complete ${g.category} experience with the paywalls stripped out and no measurable performance cost. Scored ${score}/10.`,
    cover: mediaAsset(`${g.slug}-review`, 1280, 720, `${g.name} review cover`),
    author: 'MODSzora Editorial',
    status: 'published',
    publishedAt: new Date(now - intBetween(s, 2, 90) * DAY).toISOString(),
    seo: {
      title: `${g.name} Review ${new Date().getFullYear()} — Score ${score}/10`.slice(0,70),
      description: `Our hands-on ${g.name} MOD APK review: performance, mod menu stability, pros, cons and a final score of ${score}/10.`.slice(0,180),
      keywords: [`${g.name.toLowerCase()} review`,`${g.name.toLowerCase()} mod review`,'mod apk review',`${g.category} game review`,'android game review'],
      canonical: null, ogTitle: `${g.name} Review — ${score}/10`,
      ogDescription: `Hands-on review of ${g.name} MOD APK v${g.version}.`,
      ogImage: `https://picsum.photos/seed/${g.slug}-review/1200/630.webp`,
      twitterCard: 'summary_large_image', twitterTitle: `${g.name} Review — ${score}/10`,
      twitterDescription: `Hands-on review of ${g.name} MOD APK.`, jsonLd: null, noindex: false,
    },
    id: `00000000-0000-4000-8002-${String(i).padStart(12, '0')}`,
  };
});

/* ── blog ── */
const POSTS = [
  ['How to Install MOD APK Files Safely on Android','guides','Every step to sideload a modded APK without breaking your device or your data.'],
  ['Best Offline Android Games You Can Play Without Wi-Fi','news','Long flights and dead zones are no excuse to stop playing. These titles need zero connection.'],
  ['Why Signature Verification Matters for Modded APKs','guides','A modified APK is re-signed. Here is what that means for security and how we verify every upload.'],
  ['Top 10 Mod Menu Games Dominating This Month','news','The mod menus the community is actually installing right now, ranked by download velocity.'],
  ['Android 15 and the Future of Sideloading','updates','New install restrictions are landing. Here is what changes for MOD APK users.'],
  ['Mobile Esports Is Quietly Outgrowing PC in Asia','esports','Prize pools, viewership and infrastructure are shifting toward handheld competition.'],
  ['OBB Files Explained: Why Some Games Need Extra Steps','tips','Large games ship data separately. This is how to place OBB folders correctly.'],
  ['How MODSzora Detects Game Updates Automatically','updates','A look inside the ingestion agent that keeps thousands of listings current.'],
];
const posts = POSTS.map(([title, category, excerpt], i) => {
  const slug = slugify(title);
  const content = [
    `<p>${excerpt}</p>`,
    `<h2>Why this matters</h2>`,
    `<p>Android's openness is its greatest strength and its sharpest edge. Sideloading gives you access to software the Play Store will never carry, but it also removes the safety net Google provides. Understanding the mechanics — not just the button presses — is what separates a safe install from a compromised device.</p>`,
    `<h2>The practical steps</h2>`,
    `<ol><li>Confirm the source is reputable and the file is scanned.</li><li>Check the package name matches the official app.</li><li>Uninstall conflicting builds before installing.</li><li>Grant only the permissions the game genuinely needs.</li><li>Keep Play Protect enabled for baseline scanning.</li></ol>`,
    `<h2>Common mistakes</h2>`,
    `<p>The single most frequent failure is a signature conflict: Android refuses to install a modded APK over a Play Store build because the signing keys differ. Uninstalling first resolves it in nearly every case. The second most common issue is a missing OBB directory for large titles.</p>`,
    `<h2>Closing thoughts</h2>`,
    `<p>Treat every APK as untrusted until verified. MODSzora scans, hashes and signature-checks every file it publishes, but a informed user is still the best line of defence.</p>`,
  ].join('\n');
  return {
    slug, title, category, excerpt, content,
    cover: mediaAsset(`post-${slug}`, 1280, 720, title),
    tags: [category, 'android', 'mod apk', 'guide'],
    author: 'MODSzora Editorial',
    readingMinutes: Math.max(3, Math.round(content.split(/\s+/).length / 220)),
    status: 'published',
    publishedAt: new Date(now - intBetween(slug, 1, 150) * DAY).toISOString(),
    scheduledFor: null,
    seo: {
      title: title.slice(0, 70),
      description: excerpt.slice(0, 180),
      keywords: [slug.split('-').slice(0,3).join(' '), category, 'android guide', 'mod apk tips', 'gaming news'],
      canonical: null, ogTitle: title.slice(0,95), ogDescription: excerpt.slice(0,200),
      ogImage: `https://picsum.photos/seed/post-${slug}/1200/630.webp`,
      twitterCard: 'summary_large_image', twitterTitle: title.slice(0,70),
      twitterDescription: excerpt.slice(0,200), jsonLd: null, noindex: false,
    },
    id: `00000000-0000-4000-8003-${String(i).padStart(12, '0')}`,
  };
});

const banner = `/**
 * AUTO-GENERATED by scripts/generate-fixtures.mjs — do not edit by hand.
 * Demo dataset served when Supabase is not configured.
 */
import type { BlogPost, GameRecord, Review, Wallpaper } from '@modverse/shared';

`;

const body =
  banner +
  `export const demoGames = ${JSON.stringify(games, null, 2)} as unknown as GameRecord[];\n\n` +
  `export const demoWallpapers = ${JSON.stringify(wallpapers, null, 2)} as unknown as (Wallpaper & { id: string; createdAt: string })[];\n\n` +
  `export const demoReviews = ${JSON.stringify(reviews, null, 2)} as unknown as (Review & { id: string })[];\n\n` +
  `export const demoPosts = ${JSON.stringify(posts, null, 2)} as unknown as (BlogPost & { id: string })[];\n`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, body, 'utf8');
console.log(`✓ fixtures: ${games.length} games, ${wallpapers.length} wallpapers, ${reviews.length} reviews, ${posts.length} posts`);
console.log(`✓ written to ${OUT}`);
