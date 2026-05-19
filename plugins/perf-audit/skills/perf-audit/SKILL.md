---
name: perf-audit
description: On-demand performance audit for a Next.js + SigNoz app. Gathers slow routes from bundle sizes, Web Vitals RUM, and backend traces, then fans out parallel subagents — one per finding, each in its own worktree — that open PRs against the worst offenders. Repo-agnostic; reads `.claude/perf.json` from the current repo for thresholds and signal sources. Stops at "ready for review"; never auto-merges. Use when the user says "run a perf audit", "audit performance", "find slow routes", or invokes `/msilvis:perf-audit`.
---

# Perf Audit — Gather, Fan Out, Open PRs

You are the orchestrator for a one-shot performance audit. You discover the slowest things in this repo from three signal sources, then spawn one subagent per finding to fix it. Each subagent works in its own git worktree and opens its own PR. You do **not** edit source code yourself, and you do **not** auto-merge — every finding stops at "ready for review."

This skill is repo-agnostic. All repo-specific knobs live in `.claude/perf.json` in the target repo. The skill itself only knows the contract.

## Arguments

- No args → top 3 findings, both frontend and backend scopes, parallel fan-out.
- `--top N` → cap the number of findings (and therefore subagents) at N. Default 3.
- `--scope frontend` → bundle + Web Vitals only.
- `--scope backend` → API latency + DB spans only.
- `--scope both` → everything (default).
- `--dry-run` → print findings, do not enter worktrees, do not spawn subagents, do not push.

## Phase 0 — Load the contract and probe signal sources

1. Read `.claude/perf.json` from the current working directory. If it does not exist, stop and tell the user:

   > This repo has no `.claude/perf.json`. The perf-audit skill needs that file to know which workspace to build, which SigNoz service to query, and what budgets to enforce. Want me to scaffold one?

   Do not proceed without the contract; do not guess values.

2. Validate the required keys before touching anything: `app_type`, `signoz_service`, `branch_prefix`. If `app_type` includes `frontend`, also require the `web` and `web_vitals` blocks. If it includes `backend`, also require the `backend` block.

3. **Probe for SigNoz MCP.** The Web Vitals and backend p95 legs depend on `mcp__Signoz__*` tools. Check whether they are loaded in this session (use `ToolSearch` with `select:mcp__Signoz__signoz_list_services` or similar). If they are NOT loaded:

   - Tell the user in one line: "SigNoz MCP not loaded in this session — Web Vitals + backend p95 legs will fall back to the local-dev data path (`dev.fallback` block in `.claude/perf.json`). Restart Claude Code to pick up the SigNoz MCP for a real prod-data run."
   - If `dev.fallback` is **not** configured in the contract, skip the affected legs entirely and tell the user which findings won't appear this run. Do not abort the whole skill — frontend bundle still runs.
   - If `dev.fallback` **is** configured, proceed using the fallback path described in Phases 1b–1c.

4. Echo a one-line plan back to the user: scope, top N, app_type, signoz_service, signal sources (`signoz` vs `dev-fallback`). Then continue (no confirmation prompt — the skill is on-demand and the user just invoked it).

## Phase 1 — Gather (sequential, in the orchestrator)

Run only the steps that match the resolved scope. Collect findings into an in-memory list `[{ id, kind, route_or_target, current, budget, suspected_files, evidence }]`. Skip any path matched by `skip_paths`.

### 1a. Frontend bundle sizes (scope: frontend, both)

Run the configured `web.build_command` from the repo root. Capture stdout.

**Source the per-route sizes:**

1. First try parsing Next.js's per-route "First Load JS" table — the section beginning with `Route (app)` or `Route (pages)` with a `First Load JS` column. This works on Next ≤15 / webpack builds.
2. If the table has no size column (Next 16 + Turbopack drops it), check `<repo>/web/.next/diagnostics/route-bundle-stats.json` (emitted automatically by `next build` on Next 16+, or by `next experimental-analyze` if absent). Each row is `{ route, firstLoadUncompressedJsBytes, firstLoadChunkPaths }`. The metric is **uncompressed** bytes.
3. If neither is available — *and only then* — run `cd <web> && pnpm exec next experimental-analyze` to produce the diagnostics, then read the JSON. Do not pre-install `@next/bundle-analyzer`; do not enable `ANALYZE=true`.

**Pick the right budget:**

- If the table parse succeeded → compare to `web.first_load_js_budget_kb` (gzipped).
- If you fell back to `route-bundle-stats.json` → compare to `web.first_load_js_uncompressed_budget_kb` (uncompressed). If that key is missing from the contract, fail the leg with a clear message: "Next 16/Turbopack emits uncompressed bytes only; add `web.first_load_js_uncompressed_budget_kb` to `.claude/perf.json` (typical: 3× the gzipped budget)."

For each route over budget, record a finding:

```
kind: "bundle"
route_or_target: <route path>
current: "<n> kB First Load JS (<gzipped|uncompressed>)"
budget: "<m> kB"
suspected_files: <files under web.routes_root that map to this route>
evidence: <table row OR the route's entry from route-bundle-stats.json>
```

**Shared-baseline detection.** If the top N routes cluster within ~5% of each other, the dominant cost is almost certainly a shared layout / vendor chunk, not the leaf pages. Add a one-line note to each finding's `evidence` calling this out, and tell the subagent that route-local splits may not move the diagnostic — they should escalate to `BLOCKED=` if the bulk of the bundle is shared baseline rather than wasting effort on micro-splits.

If `pnpm run build` fails outright, stop the frontend leg and surface the error — do not spawn agents against a broken build.

### 1b. Frontend Real-User Web Vitals (scope: frontend, both)

**Preferred (SigNoz MCP loaded):** invoke the `msilvis:signoz-logs` skill as a subtask with this query intent:

> Pull the last `<web_vitals.window_days>` days of logs from service `<signoz_service>` where the event name equals `<web_vitals.event_name>`. Group by the `<web_vitals.path_field>` field and the metric name. For each (path, metric) pair return p75 of `value`. Return as a JSON array, one row per (path, metric).

**Fallback (SigNoz MCP unavailable, `dev.fallback` configured):** drive a local Playwright sweep against the running dev server.

1. Confirm the dev server is up at `dev.fallback.base_url`. If not, surface to the user and stop the leg — do not start `pnpm run dev` yourself (it has side effects on Postgres, manifest cache, etc.).
2. If the contract specifies `dev.fallback.qa_session_command`, run it once to mint a session and capture the auth URL.
3. Use the `mcp__playwright__*` tools to navigate to each route in `dev.fallback.routes` (or auto-derive from `routes-manifest.json` if not listed). For each route, hit it **twice** (cold then warm) and capture via `performance.getEntriesByType('navigation')[0]`: `responseStart` (TTFB), `paint.first-contentful-paint`, and the last `largest-contentful-paint` entry.
4. Report **warm** numbers. The cold hit primes the Next dev compile cache; the warm hit is the real server cost. Caveat the user that dev-mode numbers are indicative not absolute — they're useful for finding outliers among siblings, not for matching prod budgets exactly.

For each row, compare p75 (SigNoz) or warm value (fallback) against the matching budget:
- `LCP` → `web_vitals.p75_lcp_ms_budget`
- `INP` → `web_vitals.p75_inp_ms_budget` (fallback path: INP isn't measurable from a scripted Playwright nav — skip it under fallback)
- `CLS` → `web_vitals.p75_cls_budget` (skip if not configured — CLS isn't always budgeted)

Record one finding per route that overshoots **any** metric (combine overages on the same route into a single finding — do not spawn multiple agents at the same route).

```
kind: "web-vitals"
route_or_target: <path>
current: "p75 LCP <a>ms, p75 INP <b>ms"  // or "warm TTFB <a>ms, FCP <b>ms (dev-fallback)"
budget: "LCP <x>ms, INP <y>ms"
suspected_files: <files under web.routes_root that map to this route>
evidence: <raw rows from the SigNoz response OR Playwright timing JSON>
```

### 1c. Backend latency + DB spans (scope: backend, both)

**Preferred (SigNoz MCP loaded):** invoke `msilvis:signoz-logs` twice. Use `<signoz_trace_service>` (which defaults to `<signoz_service>` if the contract doesn't set it separately) — backends commonly emit traces under a `-server` suffixed service while browser RUM logs use the bare name, and the two must be distinguished.

1. **Slow API routes.** Query traces for service `<signoz_trace_service>` over the last `<web_vitals.window_days>` days. For each `http.route` (or `http.target`) return p95 duration. Compare to `backend.slow_route_p95_ms_budget`. If neither attribute is present on any span, the backend isn't HTTP-instrumented yet — surface that to the user as a single line and skip this sub-leg (do not fabricate a finding).

2. **Slow DB spans.** Query traces for the same service+window, filter `db.system` present (Prisma / Postgres / etc.). Group by `db.statement` or operation name, return p95 duration. Compare to `backend.slow_db_span_p95_ms_budget`. Same rule: if no `db.system` spans exist, surface and skip.

**Fallback (SigNoz MCP unavailable, `dev.fallback` configured):** parse the running dev server's log.

1. Read `dev.fallback.log_path` (or default `logs/app.log`, or the dev process's tee'd stdout if the contract specifies `dev.fallback.log_command`). Tail the last 5 minutes, or the entire file if the dev server was just started.
2. Extract every line matching Next's request log format: `GET|POST <path> <status> in <total>ms (next.js: <a>ms, [middleware/proxy: <b>ms,] application-code: <c>ms)`. The middleware/proxy segment is optional and named after whatever middleware the repo runs. The `application-code` value is the pure handler time — that's what to budget against.
3. Group by route template (collapse `[id]`/`[hash]` segments by replacing UUID-shaped and numeric path segments with `[id]`). Take p95 of `application-code` per group. Compare to `backend.slow_route_p95_ms_budget`.
4. Also surface any non-Next warnings in the log: `pg` deprecations, Prisma `slow query`, unhandled rejections. Record each as a separate finding with `kind: "warning"` if its budget is "zero occurrences."
5. DB-span p95: not available from Next's request log. Skip the db-span leg under fallback unless `dev.fallback.prisma_slow_query_threshold_ms` is set and the app logs slow Prisma calls.

Record one finding per overage:

```
kind: "api-latency" | "db-span" | "warning"
route_or_target: <route path | db operation | warning key>
current: "p95 <n>ms"  // or "<n> occurrences"
budget: "p95 <m>ms"   // or "zero"
suspected_files: <best-effort grep — route file for api-latency, query call sites for db-span>
evidence: <SigNoz rows OR matching log lines>
```

For db-span findings, do a quick `grep -rn` in `src/` and `web/app/` for distinctive tokens from the SQL or the operation name. If you can't pin it to ≤5 files, leave `suspected_files: []` and let the subagent search.

### 1d. Rank, dedupe, cap

- Collapse multiple metric overages on the same route into one finding (frontend).
- If a route shows up in both bundle and web-vitals, prefer the web-vitals finding (it has user impact attached) and mention the bundle overage in its `evidence`.
- Sort by severity: ratio of `current` to `budget`, descending.
- Truncate to `--top N`.

If the list is empty after this: report "All budgets clean across <scope>. Nothing to do." and exit. Do not spawn anything.

## Phase 2 — Plan + confirm (one-shot)

Print the planned fan-out as a table:

```
Found <N> performance issues. Spawning <N> subagents in parallel:

  1. [bundle]       /inventory             243 kB → 200 kB
  2. [web-vitals]   /loadouts              p75 LCP 3.1s → 2.5s
  3. [db-span]      itemDefs.findMany      p95 480ms → 300ms
```

If `--dry-run`, stop here.

Otherwise continue to Phase 3 without asking — the skill is fire-and-forget.

## Phase 3 — Fan out (parallel subagents, single message)

For each finding, derive:

- A short kebab-case slug from the finding (e.g. `home-bundle-over-budget`, `loadouts-lcp`, `item-defs-findmany-p95`).
- A branch name: `<branch_prefix>/<slug>` (clamped to 50 chars total).

Spawn all subagents in **one message** with multiple `Agent` tool calls so they run concurrently. Each agent:

- Uses `subagent_type: "general-purpose"`.
- Receives the prompt below, populated for that finding.
- Calls `EnterWorktree` with `name: <branch_prefix>/<slug>` as its very first action.

**Worktree isolation — choose ONE mode based on the fan-out:**

- **Default (≤2 agents OR scope is purely static like bundle):** parallel fan-out with the standard `EnterWorktree`. Subagents share the parent checkout's git objects but each has its own working tree.
- **Risky (≥3 agents AND any agent needs `pnpm run dev`):** the parent checkout's `node_modules`, `.next/`, Postgres data, and dev-server port are shared resources. Multiple agents touching them at once will corrupt state (this happened in v1 — the dev server died mid-run and one PR couldn't reproduce its warm-timing test). In this case, **serialize**: spawn agents one at a time, await each, then spawn the next. The orchestrator must own that serialization — do not delegate it to the agents.
- **Required isolation override:** the contract may set `fan_out.isolation: "serial"` to force serialization regardless of agent count, or `fan_out.isolation: "parallel"` to override the default risky-mode serialization (use this only if you've validated nothing in the agents' validation steps touches dev/Postgres).

Tell the user up front which mode you picked and why ("3 backend agents, all need dev server → serializing").

### Subagent prompt template

```
You are fixing one performance finding in this repo. You work alone in a fresh git worktree, run validation, open a PR, and stop. Do NOT merge. Do NOT touch unrelated routes or files.

## Setup

Your first action is `EnterWorktree` with name `<branch_prefix>/<slug>`. After that, read `CLAUDE.md` in the repo root (and any nested CLAUDE.md the worktree exposes) and respect every rule.

## Finding

- Kind: <kind>
- Target: <route_or_target>
- Current: <current>
- Budget: <budget>
- Suspected files: <suspected_files or "search the repo">
- Evidence:
<evidence, indented>

## What to do

1. Diagnose. Read the suspected files (or search if none were provided). Form a hypothesis about why this is over budget.
2. Fix, with the smallest possible diff that gets the metric under budget:
   - For `bundle`: prefer `dynamic()` imports, route-level code splitting, or removing dead imports. Do not change behavior. If a heavyweight dep is at fault and there is no obviously safe split, stop with `BLOCKED=`.
   - For `web-vitals`: target the specific metric over budget (LCP → image priority, preconnect, server-side data; INP → defer or break up long tasks; CLS → reserve space, avoid late-inserted layout shifts).
   - For `api-latency`: look for N+1 queries, missing indexes, oversized payloads, missing pagination. If the fix is a schema migration, follow that repo's migration workflow exactly.
   - For `db-span`: same — index, narrow `select`, batch, or memoize. Never `db push`.
3. Validate. Run the repo's standard validation (`pnpm run ci` or `pnpm run validate` — whichever the repo's CLAUDE.md prescribes). If the fix changes the rendered bundle, also re-run the build and confirm the new First Load JS for the target route is at or below the budget. For backend findings you cannot easily reproduce locally, run unit tests and document the expected p95 improvement in the PR body.
4. Commit only the files you changed. No `-A`, no `.`, no `--no-verify`. Footer:
   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
5. Push: `git push -u origin HEAD`.
6. Open the PR with `gh pr create`. Title ≤70 chars, prefixed `perf(<scope>):`. Body MUST use the two-section template:

   ## Summary
   - Why: <one bullet, the user impact — "page LCP was over budget on 4G", "admin list took >800ms p95">
   - What: <one bullet per substantive change>
   - Trade-offs / caveats: <optional bullet>

   ## Test plan
   - [ ] <verifiable check #1 — e.g. "build /inventory and confirm First Load JS < 200 kB">
   - [ ] <verifiable check #2 — e.g. "open /loadouts in prod after deploy, watch SigNoz p75 LCP for 24h">
   - [ ] <verifiable check #3 — e.g. "run `pnpm run test:unit` and confirm green">

7. On the **last two lines** of your reply, print exactly these markers and nothing after:
   - `PR_URL=<url>`
   - `RESULT=<2-3 sentences: what changed, the before/after number, and the file(s) touched. Plain language for the orchestrator to relay.>`

   If you cannot proceed, instead print on the **last line**:
   - `BLOCKED=<1-2 sentences: what the human needs to decide or unblock>`
```

## Phase 4 — Collect

Once all subagents return, print a single summary block:

```
Perf audit done. <N> findings, <P> PRs opened, <B> blocked.

✅ Opened:
  - [#1234] /inventory bundle  → <result>  <url>
  - [#1235] /loadouts LCP      → <result>  <url>

⛔ Blocked:
  - itemDefs.findMany p95      → <blocked reason>
```

Do not open a parent tracking PR or roll-up issue. Each finding stands alone.

## Rules and safety

- **Read the contract first.** No `.claude/perf.json`, no run.
- **Stop at review.** Never merge a PR this skill opens.
- **One worktree per finding.** Subagents must not share working directories.
- **Don't touch unrelated routes.** Each PR addresses exactly one finding.
- **Don't fabricate budgets.** If the contract doesn't define a budget for a metric (e.g. no `p75_cls_budget`), skip that metric — don't invent a number.
- **Don't auto-add bundle-analyzer or other deps.** Parse the existing Next build output, fall back to `route-bundle-stats.json`, or invoke `next experimental-analyze` (which ships with Next 16+ and writes the same diagnostic). Do not add `@next/bundle-analyzer` or enable `ANALYZE=true` for the user.
- **Skip the path list.** Anything matched by `skip_paths` is invisible to this skill.
- **`--dry-run` is read-only.** It builds (which writes to `.next/`) but never enters a worktree, never spawns agents, never pushes.

## Contract reference

The `.claude/perf.json` contract this skill consumes:

```jsonc
{
  "app_type": "frontend" | "backend" | "frontend+backend",
  "signoz_service": "<service name in SigNoz>",     // used for log queries (browser RUM, web-vitals)
  "signoz_trace_service": "<service name>-server",  // optional; used for trace queries (api-latency, db-span). Defaults to signoz_service. Set this when the Node OTel SDK emits traces under a different service.name than the browser logger.
  "branch_prefix": "perf",                  // worktrees become <branch_prefix>/<slug>
  "skip_paths": ["/healthz", "/api/v1/log-web-vitals"],
  "web": {                                  // required if app_type includes frontend
    "workspace_filter": "web",
    "build_command": "pnpm --filter web build",
    "first_load_js_budget_kb": 200,         // gzipped budget — used when Next prints the First Load JS table (≤Next 15 / webpack)
    "first_load_js_uncompressed_budget_kb": 600, // uncompressed budget — used when falling back to route-bundle-stats.json (Next 16+/Turbopack). Typical: 3× the gzipped budget.
    "routes_root": "web/app"
  },
  "web_vitals": {                           // required if app_type includes frontend
    "event_name": "web-vital",
    "path_field": "path",
    "window_days": 7,
    "p75_lcp_ms_budget": 2500,
    "p75_inp_ms_budget": 200,
    "p75_cls_budget": 0.1                   // optional; omit to skip CLS budgeting
  },
  "backend": {                              // required if app_type includes backend
    "slow_route_p95_ms_budget": 800,
    "slow_db_span_p95_ms_budget": 300
  },
  "dev": {                                  // optional — enables local-dev fallback when SigNoz MCP isn't loaded
    "fallback": {
      "base_url": "https://<host>.local",   // running dev server
      "qa_session_command": "pnpm run qa:session", // optional — mints an auth session for Playwright
      "log_path": "logs/app.log",           // or null if the dev process tees stdout instead
      "log_command": null,                  // optional — e.g. "tail -n 5000 /tmp/dev.log" if the log is captured elsewhere
      "routes": ["/", "/dashboard"],        // optional — defaults to auto-discovery from routes-manifest.json
      "prisma_slow_query_threshold_ms": 200 // optional — only meaningful if the app logs slow Prisma calls
    }
  },
  "fan_out": {                              // optional — override worktree isolation mode
    "isolation": "auto"                     // "auto" (default) | "serial" | "parallel"
  }
}
```
