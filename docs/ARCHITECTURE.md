# Architecture notes

Decisions that are non-obvious, and the reasoning behind them.

## 1. Two applications, not one

The agent needs a long-lived process, a Chromium binary and multi-minute job
runtimes. Vercel Functions provide none of those. Splitting them means the
website stays on the edge/serverless path it is optimised for, while the agent
runs on any container host. They communicate over one authenticated endpoint
(`POST /api/agent/publish`) using a shared secret.

## 2. Demo mode is a first-class runtime

`isDemoMode()` is checked in every repository function. With no Supabase
credentials the app serves a generated 28-game fixture set. This is not a
mock layer bolted on for screenshots — it is the same code path, so the UI
cannot drift from reality, and a reviewer can explore the entire product with
`npm install && npm run dev`.

## 3. Package name is the identity, fingerprint is the change signal

`UNIQUE (package_name)` at the database level makes duplicate listings
impossible even under concurrent writes. Separately, `contentFingerprint()`
hashes only the fields that matter (version, size, changelog, mod features,
screenshot set) with arrays sorted, so re-ordered screenshots do not register
as a change. An unchanged game therefore costs one HTTP fetch.

## 4. The scraper distrusts its input

Three defences, each added after observing a real failure:

- **Soft-redirect detection** — `an1.com/4552-subway-surfers-mod.html`
  returns `200 OK` while serving an article about Sony phones. Comparing the
  canonical URL to the requested URL catches this.
- **Page-confidence scoring** — a page must score ≥ 0.45 on app-specific
  signals. Measured: real listing 0.50, news article 0.00, empty page 0.00.
- **Package-name sanitising** — a loose regex matched `window.location.href`.
  Candidates are now rejected on JS globals, file extensions and shape.

## 5. Playwright scripts are passed as strings

`page.evaluate(() => {...})` breaks under `tsx`/esbuild because the bundler
injects a `__name` helper that does not exist in the browser context
(`ReferenceError: __name is not defined`). Passing the body as a string is
evaluated verbatim by Chromium and is immune to the transform.

## 6. `loading.tsx` placement is load-bearing

A `loading.tsx` at a route-**group** level wraps every child in a Suspense
boundary. Streaming flushes response headers with `200 OK` before a child's
`notFound()` can set the status, producing soft-404s that Google will index.
Loading files therefore live only on leaf routes that never call `notFound()`.

## 7. Server components by default

Game cards, grids and detail pages ship zero component JavaScript. Only genuine
interactivity is a client component: theme toggle, search typeahead, filter
panel, lightbox, countdown, comment form, agent console. A 60-card grid costs
nothing at runtime.

## 8. The LLM is optional, never load-bearing

`generateSeoBundle()` always returns a schema-valid bundle. If OpenAI is
missing, rate-limited, or returns malformed JSON, a deterministic heuristic
generator produces title, description, keywords, slug, long description, FAQs
and install steps from the scraped facts. `coerceSeo()` additionally repairs
common LLM drift (over-long titles, invalid category, too-few keywords) before
validation, so a slightly-wrong response is fixed rather than discarded.

## 9. Two-layer admin authorisation

Middleware answers "is there a session?" at the edge — cheap and fast. The
protected layout answers "is this email allowed?" on the server, which needs a
database lookup. Neither alone is sufficient: middleware cannot afford the
query, and the layout alone would let unauthenticated users reach RSC payloads.

## 10. RLS is verified, not assumed

Policies were exercised by executing real queries as the `anon` role: drafts
hidden, spam comments hidden, `settings` and `agent_jobs` invisible, comment
self-approval rejected, direct `UPDATE` on games rejected. See the table in
the README.
