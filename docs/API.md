# API reference

## Website

### `POST /api/agent/publish`
Auth: `Authorization: Bearer $AGENT_API_KEY`

The single write path for the agent. Validates against `publishRequestSchema`,
detects duplicates by package name, decides create vs update, and revalidates
affected ISR paths.

Responses: `created` · `updated` · `skipped` · `dry-run`

### `POST /api/comments`
Public, rate limited to 5/min/IP. Always stored as `pending` (or `spam` when
the heuristic flags it). RLS makes self-approval impossible.

### `POST /api/analytics`
Public beacon for `view` / `download` / `search` / `click`. Counter increments
use the atomic `increment_metric()` function.

### `POST /api/newsletter`
Public, rate limited to 5/min/IP.

### `GET /api/search/suggest?q=`
Typeahead, rate limited to 60/min/IP.

### `GET /api/cron/publish-scheduled`
Auth: `CRON_SECRET`, `AGENT_API_KEY`, or Vercel's `x-vercel-cron: 1`.
Promotes due scheduled content.

### `/api/admin/*`
All require an authenticated allow-listed admin session. The agent key is
attached server-side and never reaches the browser.

| Route | Purpose |
|---|---|
| `GET /api/admin/session` | Confirm the session is an allow-listed admin |
| `GET /api/admin/agent/status` | Agent health snapshot |
| `GET /api/admin/agent/jobs` | Job list |
| `GET /api/admin/agent/jobs/:id` | Job detail + logs |
| `POST /api/admin/agent/jobs/:id` | Cancel a job |
| `POST /api/admin/agent/ingest` | Manual one-click publish |
| `POST /api/admin/agent/trigger` | Run discovery / update-check / recommend |
| `GET /api/admin/agent/logs` | Recent agent logs |

## Agent

Base: `http://localhost:8787`. Everything except `/health` requires
`Authorization: Bearer $AGENT_API_KEY`.

| Route | Purpose |
|---|---|
| `GET /health` | Public liveness probe |
| `GET /api/status` | Queue, crons, sources, API usage, storage |
| `GET /api/jobs` | List jobs (`?status=`, `?type=`, `?limit=`) |
| `GET /api/jobs/:id` | Job detail with its log lines |
| `POST /api/jobs/:id/cancel` | Abort a running job |
| `POST /api/jobs` | Enqueue an arbitrary job |
| `POST /api/ingest` | Manual ingest (priority 9, jumps the queue) |
| `POST /api/discover` | Crawl sources for new games |
| `POST /api/check-updates` | Detect version bumps |
| `POST /api/recommend` | Score candidates without publishing |
| `GET /api/recommendations` | Stored recommendations |
| `GET /api/logs` | Ring-buffer logs |
| `GET /api/sources` | Source health |
| `GET /api/integrations` | Supabase / OpenAI / MultCloud reachability |
