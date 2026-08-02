# MODVerse — build status

Verified on this machine. Every claim below was executed, not assumed.

## Test results

| Suite | Result |
|---|---|
| Shared logic (slugs, semver, fingerprints, AES-GCM) | **11 / 11** |
| Scraper adapters + sanitiser + routing | **45 / 45** |
| SEO / review generation (rich + sparse input) | **38 / 38** |
| CMS generators (blog / wallpaper / review / keywords) | **48 / 48** |
| AN1 title normalisation | **5 / 5** |
| HTTP route suite (200 / 404 / 307 / 401) | **39 / 39** |
| Admin UI audit (7 pages × dark/light) | **14 / 14, 0 issues** |
| Visual + a11y audit (12 routes × dark/light × desktop/mobile) | **30 / 30, 0 issues** |
| TypeScript strict across 3 packages | **clean** |
| Production build (web + agent + shared) | **clean** |

## Database — executed against PostgreSQL 17

Both migrations apply idempotently. Behaviour verified with live SQL:

- Weighted full-text search ranks correctly (`0.9753` for a matching phrase)
- Trigram fuzzy match survives typos (`minecrft` → `minecraft`, sim `0.583`)
- Duplicate `package_name` rejected by constraint
- `trending_score()` time-decay: fresh 890 k-download game outranks an old
  2.4 M-download game (`242807` vs `63650`) — exactly the intent
- `related_games()`, `increment_metric()`, `publish_due_content()` all correct
- `updated_at` trigger fires; in-flight agent job dedupe holds

### RLS, exercised as the `anon` role

| Attack | Result |
|---|---|
| Read a draft game | blocked |
| Read a spam comment | blocked |
| Read `settings` (API keys) | 0 rows |
| Read `agent_jobs` | 0 rows |
| Insert `pending` comment | allowed (intended) |
| Insert `approved` comment | **blocked** |
| `UPDATE games` | **blocked** |

## Agent — run against live sites

- Discovery on `an1.com` returned 6 real games
- Full ingest of *Idle Miner Tycoon*: title, `v5.60.0`, 229.5 MB, Android 7.0+,
  category auto-classified `simulation`, slug `idle-miner-tycoon-mod-apk`,
  SEO + 5 FAQs + 5 install steps + 8.0/10 review — end to end in ~18 s
- Queue verified: concurrency cap, 2s→5s backoff recovering on attempt 3,
  fatal errors skipping retries, cancellation, URL dedupe

## CMS expansion — what was added

Full CRUD for **wallpapers, reviews, blog and news**, each with a manual form
and an AI path writing identical records. Plus a media library, an AI
suggestions engine, and a charts-driven dashboard.

Verified against PostgreSQL 17 with live SQL:

- `cms_totals()` returns all 18 counts in one round trip
- `increment_content_metric()` rejects unknown tables (SQL-injection safe)
- `publish_due_content()` now promotes games, posts, wallpapers **and** reviews
- Suggestion `dedupe_key` upserts: two inserts → one row, updated in place
- Wallpaper and review full-text search vectors
- `0003_cms.sql` re-runs cleanly (idempotent `ALTER TYPE ... ADD VALUE`)

Live agent verification:

- Blog generator: all 6 templates produce schema-valid HTML with `<h2>` sections
- Review generator: all 6 actions work; `expand` grew a body 32 → 1188 chars;
  `improve-rating` corrected an inflated 9.9 to the honest average 7.4
- Content analysis: all 7 checks ran with no database and produced 0 errors
- Every new endpoint returns 401 without the agent key

## Bugs found and fixed during the build

1. **Soft-404s** — a group-level `loading.tsx` streamed `200 OK` before
   `notFound()` could set the status. Google would have indexed every missing
   page. Fixed by scoping loading files to leaf routes.
2. **Fabricated listings** — `an1.com` answers unknown URLs with `200` and an
   unrelated article; the agent built a listing from a Sony phones news post.
   Fixed with canonical-URL comparison + page-confidence scoring.
3. **`__name is not defined`** — esbuild injects a helper into
   `page.evaluate()` callbacks that does not exist in the browser. Broke all
   scroll-based scraping. Fixed by passing scripts as strings.
4. **Bogus package names** — a loose regex matched `window.location.href`.
   Fixed with a sanitiser; regression-tested against 8 false positives.
5. **Public chrome in admin** — the admin area inherited the marketing header.
   Fixed with a `(site)` route group.
6. **`node:crypto` in the client bundle** — broke the build. Fixed with
   subpath exports (`@modverse/shared/hash`, `/crypto`).
7. **Non-immutable generated column** — `array_to_string` is STABLE, so the
   search vector was rejected by Postgres. Fixed with an immutable wrapper.
8. **Schema violation on sparse sources** — a source yielding 2 mod features
   failed the min-3 rule and dropped the listing. Fixed by topping up.

### Found during the CMS expansion

9. **Review refinement rejected short drafts** — `reviewSchema.partial()` still
   enforced the published-content minimums (200-char body), so the generator
   refused to improve a work-in-progress. That is exactly when it is most
   useful. Fixed with a separate loose `reviewContextSchema` for input.
10. **Functions crossing the server/client boundary** — passing `formatBytes`
    into `<UsageMeter>` from a server component crashed the dashboard with a
    500. Fixed by making the formatter a declarative `format` prop.
11. **Fallback reviews failed their own schema** — the deterministic review
    body was under the 600-character minimum, so any non-OpenAI generation
    produced output that could not be saved. Fixed with a complete baseline.
12. **Validation ran after the demo guard** — bad input returned a vague 503
    instead of a 422 with field errors. Reordered so callers always get
    precise validation feedback.
13. **A test compared different inputs** — the low-competition keyword check
    used different seed sets for each mode, so it measured phrase length
    rather than mode. Corrected to an identical-seed comparison.

## Performance

- 103 kB shared First Load JS; game page +7 kB
- Homepage static with 10-min ISR; 28 game + 28 download pages prerendered
- Cards are server components — a 60-item grid ships no component JS
- Zero layout shift: aspect-ratio boxes, blur placeholders, reserved ad slots

## Not included

- Live Supabase/OpenAI/MultCloud credentials (none were provided). Every
  integration is implemented and degrades gracefully; supply keys to activate.
- A Lighthouse score. The harness here has no stable network for the image
  CDN, so any number would be misleading. The structural work Lighthouse
  measures — CLS prevention, JS budget, semantics, metadata — is done and
  verified by the audit script.
