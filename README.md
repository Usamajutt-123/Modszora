# MODVerse

An enterprise MOD APK platform with an autonomous AI ingestion agent.

MODVerse is two applications in one monorepo:

| App | Stack | Role |
|-----|-------|------|
| `apps/web` | Next.js 15 (App Router), React 19, TypeScript, Tailwind, Framer Motion | Public site + full Gaming CMS |
| `apps/agent` | Express 4, Playwright, OpenAI, Sharp, node-cron | Autonomous research / ingestion / publishing |
| `packages/shared` | TypeScript + Zod | Types, schemas and domain logic shared by both |

The agent researches eight MOD APK sources, detects new releases and version
bumps, downloads and compresses media, transfers APKs to Mega via MultCloud
remote upload, writes SEO copy with OpenAI, and publishes through the same
authenticated API a human admin would use.

---

## Quick start

```bash
git clone <your-repo> modverse && cd modverse
npm install
cp .env.example .env.local          # web app
cp .env.example apps/agent/.env     # agent
npm run dev                         # web :3000 + agent :8787
```

**The site boots with zero configuration.** With no Supabase credentials it
runs in *demo mode* against a bundled 28-game fixture set, so every page,
filter and layout is explorable immediately. Add credentials to switch to the
real database — no code changes.

---

## Architecture

```
                    ┌──────────────────────────────────────────┐
                    │  8 MOD APK sources (APKMirror, HappyMod, │
                    │  APKPure, ModDroid, AN1, APKAward,       │
                    │  RevDL, LiteAPKs)                        │
                    └────────────────┬─────────────────────────┘
                                     │ Playwright + polite HTTP
                                     │ (robots.txt, per-host throttle)
                    ┌────────────────▼─────────────────────────┐
                    │  AGENT  (apps/agent)                     │
                    │  ┌────────────────────────────────────┐  │
                    │  │ scrape → validate page confidence  │  │
                    │  │ dedupe (package name + fingerprint)│  │
                    │  │ SEO via OpenAI (heuristic fallback)│  │
                    │  │ media → Sharp → WebP → Storage     │  │
                    │  │ APK → MultCloud → Mega (no local)  │  │
                    │  └────────────────┬───────────────────┘  │
                    │   job queue: retries, backoff, cancel    │
                    └────────────────┬─────────────────────────┘
                                     │ POST /api/agent/publish
                                     │ Bearer AGENT_API_KEY
                    ┌────────────────▼─────────────────────────┐
                    │  WEB  (apps/web)                         │
                    │  Zod validation → duplicate check →      │
                    │  insert/update → revalidate ISR paths    │
                    └────────────────┬─────────────────────────┘
                                     │
                    ┌────────────────▼─────────────────────────┐
                    │  Supabase: Postgres (RLS) + Storage      │
                    └──────────────────────────────────────────┘
```

### Why the pipeline is ordered this way

Cheap checks run before expensive ones. A game that has not changed costs
exactly **one page fetch**: the scrape produces a content fingerprint, the
fingerprint matches the stored hash, and the job exits before touching
OpenAI, Sharp or MultCloud.

---

## The CMS

The admin area is a complete content management system, not just a game
manager. Every module supports both **manual entry** and **AI generation**,
and both paths write identical database records through the same Zod schemas.

| Module | Manual form | AI generation | Public routes |
|---|---|---|---|
| Games | ✓ | Agent ingest from URL | `/game/[slug]`, `/download/[slug]` |
| Wallpapers | ✓ full CRUD | From game screenshots | `/wallpapers`, `/wallpapers/[slug]` |
| Reviews | ✓ full CRUD | 6-action generator | `/reviews`, `/reviews/[slug]` |
| Blog | ✓ full CRUD | 6 article templates | `/blog`, `/blog/[slug]` |
| News | ✓ full CRUD | News roundup template | `/blog/[slug]` |

### Review Generator

Six editorial actions, available from the review editor:

| Action | What it does | Works without OpenAI |
|---|---|---|
| **Generate** | Writes a complete review from the stored game facts | ✓ |
| **Regenerate** | Rewrites from scratch with a fresh angle | ✓ |
| **Improve SEO** | Retargets title, summary and headings for search | ✓ |
| **Improve rating** | Makes the headline score the honest average of its parts | ✓ |
| **Expand** | Adds depth on performance, pacing, monetisation | ✓ |
| **Translate** | Translates to 8 languages, keeping HTML and scores | ✗ (needs the model) |

Translation is the only action that genuinely cannot be faked, so it returns a
precise error rather than silently doing nothing.

### Blog Generator

Six templates, each with a distinct editorial brief: Top 10 Games, How to
Install, Update Guide, MOD Features Explained, Gaming Tips, News Roundup.
Articles are grounded in the live catalogue — a top-list references games you
actually have.

### Wallpaper Generator

Turns a game's screenshots into publish-ready wallpapers. Screenshots are
portrait and desktop wallpapers are landscape, so a plain resize would
letterbox or squash; the generator uses Sharp's **attention-based crop** to
keep the visually busiest region. Each variant gets a thumbnail, a blur
placeholder and AI-written SEO metadata.

### Media Library

Indexes every object in storage with search, folder filtering (icons, banners,
screenshots, wallpapers, covers, uploads), preview, replace and delete. All
uploads route through one endpoint that applies EXIF rotation, caps dimensions
and converts to WebP, so nothing unoptimised reaches the bucket.

### AI Suggestions

Nine automated content-health checks, each producing actionable items with a
deep link to the exact editor needed:

- New trending games · Games needing updates
- Trending blog topics · Trending wallpapers
- Trending keywords · Low-competition keywords
- Missing screenshots · Broken links · Duplicate games

Findings carry a stable `dedupeKey`, so re-running analysis refreshes rows
instead of flooding the dashboard.

---

## Database

Two migrations in `supabase/migrations/`, both idempotent and verified
against PostgreSQL 17.

```bash
supabase db push
# or: psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
#     psql "$DATABASE_URL" -f supabase/migrations/0002_rls.sql
#     psql "$DATABASE_URL" -f supabase/migrations/0003_cms.sql
```

`0003_cms.sql` adds the CMS columns (featured/trending flags, media
dimensions, blog galleries, review prose sections), the `suggestions` and
`media_assets` tables, and extends `publish_due_content()` to cover all four
content types.

Highlights:

- **Weighted full-text search** — `tsvector` generated column, name weighted
  above tags, tags above description, plus `pg_trgm` for typo tolerance.
- **`trending_score()`** — time-decayed popularity, so a fresh game with
  890 k downloads correctly outranks an old one with 2.4 M.
- **`related_games()`** — ranks by category match + tag overlap + developer.
- **`increment_metric()`** — atomic counter bumps, no read-modify-write races.
- **`publish_due_content()`** — promotes scheduled games and posts.
- **Duplicate protection** — `UNIQUE (package_name)`; a partial unique index
  also prevents two identical in-flight agent jobs for the same URL.

### Row Level Security

Verified by executing real queries as the `anon` role:

| Check | Result |
|---|---|
| Anonymous reads a draft game | blocked |
| Anonymous reads a spam comment | blocked |
| Anonymous reads `settings` (API keys) | 0 rows |
| Anonymous reads `agent_jobs` | 0 rows |
| Anonymous inserts a `pending` comment | allowed |
| Anonymous inserts an `approved` comment | **blocked** |
| Anonymous updates `games` | **blocked** |

There is no public user registration anywhere in the product. Admin access
requires a Supabase session **and** membership of `ADMIN_EMAILS`.

---

## The AI Agent

### Manual mode — one-click publish

```bash
curl -X POST http://localhost:8787/api/ingest \
  -H "Authorization: Bearer $AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://happymod.com/example/com.example.game/","autoPublish":true}'
```

Or paste the URL into **Admin → AI Agent**. Progress streams live.

### Autonomous mode

| Cron | Default | Job |
|---|---|---|
| `CRON_DISCOVERY` | `0 */6 * * *` | Crawl sources, queue unseen games |
| `CRON_UPDATES` | `0 3 * * *` | Re-scrape tracked games, detect version bumps |
| `CRON_RECOMMENDATIONS` | `0 9 * * *` | Score candidates without publishing |

Set `CRON_ENABLED=true` to activate.

### CLI

```bash
npm run cli -w @modverse/agent -- status
npm run cli -w @modverse/agent -- discover an1 happymod --limit 10
npm run cli -w @modverse/agent -- ingest <url> --publish --live
npm run cli -w @modverse/agent -- check-updates
```

### Safety behaviours

These are not theoretical — each was found and fixed during development:

- **Soft-redirect detection.** MOD sites answer unknown URLs with `200 OK` and
  quietly serve an unrelated article. The scraper compares the canonical URL
  against the requested URL and rejects mismatches, so the agent cannot
  fabricate a listing from a news post.
- **Page-confidence scoring.** A parsed page must score ≥ 0.45 on app-specific
  signals (package name, file size, Android version, store link, mod
  features). A news article scores 0.00; a real listing scores 0.50+.
- **Package-name sanitising.** A loose regex will happily match
  `window.location.href`. Candidates are rejected unless they look like a real
  Android package and do not start with a JS global or end in a file extension.
- **Fatal vs retryable errors.** Bad input fails immediately; network blips
  retry with exponential backoff and jitter.
- **Dry run by default.** `AGENT_DRY_RUN=true` until you explicitly disable it.

### Graceful degradation

| Missing | Behaviour |
|---|---|
| `OPENAI_API_KEY` | Deterministic heuristic SEO generator. Never blocks publishing. |
| `MULTCLOUD_API_KEY` | Skips remote upload, keeps the direct MOD link, warns. |
| Supabase | Web serves fixtures; agent runs and reports what it *would* do. |
| Agent offline | Admin shows an actionable offline card; the public site is unaffected. |

---

## Testing

```bash
npm run typecheck                                   # all three packages
npx tsx apps/agent/src/__tests__/scraper.test.ts    # 45 assertions
npx tsx apps/agent/src/__tests__/seo.test.ts        # 38 assertions
npx tsx apps/agent/src/__tests__/cms.test.ts        # 48 assertions
npx tsx apps/agent/src/__tests__/an1-title.test.ts  # 5 assertions
node apps/web/scripts/shoot.mjs http://localhost:3000  # visual + a11y audit
```

The visual auditor screenshots every route in dark and light at desktop and
mobile widths, and fails on: missing/duplicate `h1`, images without `alt`,
unlabelled buttons, horizontal overflow, console errors and 4xx requests.

---

## Deployment

### Web → Vercel

1. Import the repo, set **Root Directory** to `apps/web`.
2. Add the environment variables from `.env.example`.
3. Deploy. `vercel.json` is included.

### Agent → any container host

The agent needs a persistent process and Playwright's Chromium, so it does
**not** run on Vercel Functions. Use Railway, Render, Fly.io or Docker:

```bash
docker build -t modverse-agent -f apps/agent/Dockerfile .
docker run -p 8787:8787 --env-file apps/agent/.env modverse-agent
```

Then point the web app at it via `NEXT_PUBLIC_AGENT_URL` and share the same
`AGENT_API_KEY`.

---

## Performance

- Static generation with ISR (10 min homepage, 30 min game pages).
- 103 kB shared First Load JS; the game page adds ~7 kB.
- Cards are server components — a 60-item grid ships zero component JS.
- AVIF/WebP with explicit `sizes`, aspect-ratio boxes and blur placeholders
  so image loading never shifts layout.
- Ad slots reserve their height for the same reason.
- `content-visibility: auto` on long lists.

---

## Legal

MODVerse indexes and verifies; it does not host copyrighted binaries. A DMCA
policy, privacy policy and terms are included, and removed listings are
recorded so the agent does not automatically republish them.

## Licence

Provided as-is for the commissioning party.
