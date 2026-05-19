---
name: pr-test-runner
description: Run the test plan checklist of a GitHub PR automatically. Parses the `## Test plan` markdown checklist, executes each item via Playwright (browser flows) or Bash (CLI checks), attempts to fix failures by editing source and re-running, flips passing items to `- [x]` in the PR body, commits + pushes any fixes, and posts a summary comment with pass/fixed/fail/skip results. Use when the user says "run the test plan", "verify this PR", "check off the test cases", or invokes `/msilvis:pr-test-runner` explicitly.
---

# PR Test Runner

Automatically execute every item in a PR's test plan checklist, flip passing items to `[x]`, and post a summary.

## Inputs

The user can pass a PR number, a full GitHub URL, or nothing (default: the open PR for the current branch).

1. **Parse the input.** Resolve to a PR number `$PR`:
   - Number (`123`) → use directly.
   - URL (`https://github.com/owner/repo/pull/123`) → strip to `123`.
   - Empty → `gh pr list --head $(git rev-parse --abbrev-ref HEAD) --json number --jq '.[0].number'`.
2. If resolution returns nothing, stop and ask the user which PR to run against. Don't guess.

## Step 1 — Fetch the PR body and check out the branch

```bash
gh pr view $PR --json body,headRefName,baseRefName,state,isDraft
```

- If `state` is not `OPEN`, warn the user and ask whether to proceed anyway.
- If the local checkout isn't already on `headRefName`, run `gh pr checkout $PR`. Test plan items must run against the PR's code, not `main`. If the working tree is dirty, stop and tell the user — don't stash or discard their work.

## Step 2 — Parse the test plan

Find the `## Test plan` or `## Test Plan` section in the body (case-insensitive on the second word). Extract every line that matches `^\s*- \[ \] ` (unchecked) or `^\s*- \[x\] ` (already checked).

- Already-checked items: skip — leave them alone, do not re-verify.
- Unchecked items: become the run list, in document order.
- Nested sub-items (indented under a parent): treat each as its own test case but record the parent context for the summary.

**Exit early** if there's no test plan section, or it has zero unchecked items. Tell the user clearly:

- No section: "PR #$PR has no `## Test plan` section. Nothing to run."
- All checked: "All items in PR #$PR are already checked. Nothing to do."

## Step 3 — Classify each item

For each unchecked item, decide:

- **Browser flow** — mentions UI elements, navigation, clicks, visual checks, "verify the page shows", "click the button", "the form should", routes/URLs, viewports, mobile/desktop. Use Playwright MCP (`mcp__playwright__browser_*`).
- **CLI / code check** — mentions running tests/lints/builds, file existence, command output, env vars, API responses, scripts. Use Bash.
- **Ambiguous** — the item is too vague to act on without guessing (e.g. "test it works", "make sure nothing's broken", or it references project knowledge you don't have). **Skip** with reason "ambiguous: <restate item>". Do not invent steps.

Load the Playwright tools once up front if any browser flows exist:

```
ToolSearch query="select:mcp__playwright__browser_navigate,mcp__playwright__browser_click,mcp__playwright__browser_fill_form,mcp__playwright__browser_snapshot,mcp__playwright__browser_evaluate,mcp__playwright__browser_console_messages,mcp__playwright__browser_resize,mcp__playwright__browser_take_screenshot,mcp__playwright__browser_wait_for,mcp__playwright__browser_close"
```

## Step 4 — Dev server (only if a browser flow needs it)

Skip this step entirely if every item is a CLI check.

Browser items must NEVER be skipped for "port in use" or "wrong server squatting on the port." Either the right server is reachable, or you reclaim the port and start one — those are the only two outcomes.

1. Detect the *port* the project's dev server expects. Look in this order:
   - `CLAUDE.md` / `README.md` for a documented dev port
   - `Caddyfile` / `docker-compose.yml` (extract the upstream `reverse_proxy localhost:<port>` target — ignore the public hostname)
   - `package.json` scripts (e.g. `next dev -p 3001`)
   - Fall back to `3000`
   Capture only the port. **Do not** use a proxy hostname (`*.local`, `*.test`, `*.localhost`, etc.) as the test URL — proxies like Caddy are global state shared with the user's main checkout, and they won't route to this PR's clone (which lives under `/tmp` or `.claude/worktrees/`). The test URL is `http://localhost:<port>` for the entire run.
2. Check whether the port is held by a process from THIS checkout:
   - `lsof -nP -iTCP:<port> -sTCP:LISTEN -F pn` to get the PID(s) listening.
   - For each PID, resolve its working dir: `lsof -a -p <pid> -d cwd -F n` → the `n` line is the cwd.
   - The port "belongs to us" iff at least one listener's cwd equals — or is a subdirectory of — the current repo checkout (`git rev-parse --show-toplevel`).
3. Decide:
   - **Nothing listening** → `cd $(git rev-parse --show-toplevel)` and start `mise run dev` in the background, poll `http://localhost:<port>` for up to 60s.
   - **Ours** → curl `http://localhost:<port>` to confirm 2xx/3xx, then proceed.
   - **Squatter** (listener exists but its cwd is not this checkout) → log the squatter's cwd + PID, kill it (`kill <pid>`; if still listening after 3s, `kill -9 <pid>`), then start `mise run dev` from this checkout and poll `http://localhost:<port>` for up to 60s. Do NOT skip browser items because of this — reclaiming the port is part of the job.
   The dev server **must** be started from the PR's checkout directory. Starting it anywhere else (the user's main repo, an unrelated worktree) means you'd be testing main's code instead of the PR's, and a green run wouldn't prove the PR is bug-free.
4. If the server still isn't reachable on `http://localhost:<port>` after 60s of polling, **fail** every browser item with reason `dev server failed to start: <last error / port owner / curl status>`. Do not mark them `skip` — a non-running dev server in CI/automation is a real failure of this run, not an "out of scope" condition. The only legitimate skip reason tied to the server is when there are zero browser items in the checklist (in which case Step 4 was skipped entirely).
5. **All subsequent navigation uses `http://localhost:<port>` as the base URL** — even if the test plan item or the project's README mentions a proxy hostname like `ghost.local`. Substitute the localhost URL when navigating. Hitting the proxy hostname would route through Caddy to whichever server is "ours" globally — likely the user's main checkout, not this PR's clone — defeating the whole point of running the test plan against the PR's code.

## Step 5 — Run each test case

Track results in an in-memory list: `{ raw_line, classification, status: pass|fixed|fail|skip, reason, fix_attempts, commits: [<sha>...] }`. `raw_line` must be the exact original line including indentation and the `- [ ]` prefix — it's used for the body rewrite in step 6.

`fixed` means the test failed initially, the skill edited source code, the test then passed, and the fix was committed + pushed to the PR branch. Treat `fixed` as a pass for box-flipping purposes.

### Browser flows

For each item:

1. Resize to desktop unless the item explicitly mentions mobile (then 390×844).
2. Navigate to the relevant route (infer from the item text; if no route is obvious, navigate to the dev URL root).
3. Perform the actions described.
4. Verify the expected outcome via `browser_snapshot`, `browser_evaluate`, or `browser_console_messages`.
5. Record `pass` / `fail` with a one-line reason. On failure, capture a screenshot via `browser_take_screenshot` and include the path in the reason.
6. Always check `browser_console_messages` after navigation — JS errors fail the case even if the visible flow worked.

### CLI / code checks

Run the command implied by the item. Pass = exit 0 (or matches the explicit assertion in the item, e.g. "the output should contain X" → grep). Fail = non-zero exit or assertion miss. Capture the last 10 lines of output for the reason.

### Skip reasons (use these exact prefixes for consistency)

Skips should be rare. Push hard to convert would-be skips into pass / fail / fixed — every silent skip is a hole in the QA pass. Reach for skip only when the item genuinely cannot be acted on from this run.

- `ambiguous: ...` — the item is too vague to act on without guessing (use sparingly; re-read the item first and infer the obvious route/assertion before giving up).
- `requires auth: <reason>` — login was needed but couldn't be performed (no per-repo config, env vars unset, or sign-in flow itself failed — record which).
- `manual verification` — item explicitly says "manually verify ..." or describes something only a human can judge (e.g. "designer to review color contrast").

Never use skip for:
- Port-in-use / squatter dev servers (Step 4 reclaims the port instead).
- Dev server failing to start (that's a `fail` on every browser item, per Step 4 step 4).
- Missing seed data, wrong DB pointed at, env not loaded — diagnose, fix the local env, and re-run; if still impossible, mark `fail` with the specific local-env reason so the summary's "local infra" banner can surface it.

### Auth redirect → log in and retry (do NOT skip on first redirect)

A test plan item is only allowed to skip with `requires auth` if you actually
attempted login per the [Per-repo login config](#per-repo-login-config) and
that attempt failed (or there's no config / no credentials for the repo).
**Never** mark `requires auth` just because the page redirected — that's the
trigger to log in, not to give up.

When a browser flow lands on a login screen (URL contains `/login`, `/signin`,
`/sign-in`, or the snapshot shows email + password inputs without the expected
target content):

1. Look up the PR's repo in the [Per-repo login config](#per-repo-login-config).
   If there's no row for the repo, mark the item `skip` with reason
   `requires auth: no login config for <repo>`.
2. **If the repo's row lists a seed command** and the seed hasn't been run
   yet this skill invocation, run it now. Record that it ran so subsequent
   auth-gated items in the same run skip the seed. If the seed exits
   non-zero, mark `skip` with reason
   `requires auth: seed failed (<one-line error>)` and stop attempting login
   for this run.
3. **Form-based repos** (Siltop-Visions, portal): read the credentials env
   vars listed in the row. If either is empty, mark `skip` with reason
   `requires auth: <ENV_VAR_NAME> unset`. **Do not log, echo, or include the
   credential value anywhere — only the env var name.**
   **Script-based repos** (ghost): the row documents a script (e.g.
   `pnpm run qa:session`) instead of env-var creds. Run the script, parse
   the printed session URL, and navigate to it. No password is involved, but
   the same "never log the URL's query string" rule applies — it contains a
   bearer-equivalent token.
4. Run the documented sign-in steps for that repo. If the form errors,
   the script fails, or the post-submit URL is still a login page, mark
   `skip` with reason `requires auth: sign-in failed (<one-line error from
   the page>)` and move on — do not retry login more than once per item.
5. On successful login, re-navigate to the original route and resume the test
   step. Once logged in, the session cookie persists for the rest of the run,
   so later auth-gated items in the same run do not need to repeat the login
   flow — just retry directly if you hit another redirect.
6. **Never** commit, log, screenshot, or include credentials (or session URLs
   from script-based flows) in the PR summary comment. Screenshots of the
   login form are fine as long as fields are empty or masked; never
   screenshot a populated password field.

### Failure handling — attempt a fix

When an item fails, try to fix the underlying issue, not the test. Skipped items are never fixed.

**Fix budget (hard caps — do not exceed):**

- Max **2** fix attempts per failing item. After the second failed re-run, mark `fail` with reason `fix attempts exhausted: <last error>`.
- Max **5** total fix attempts across the entire run. Once hit, stop attempting fixes for the rest of the run; remaining failures are recorded as `fail — global fix budget exhausted` with no edits made.
- If the working tree starts dirty (caught earlier in step 1), do not attempt any fixes — bail before running.

**Fix loop, per failing item:**

1. **Diagnose** from the failure signal:
   - Browser flow: console errors, network 4xx/5xx, the snapshot diff vs expected, the failing assertion.
   - CLI check: stderr, exit code, the specific assertion that missed.
2. **Locate the cause.** Read the relevant source files (use grep/Read on the PR's diff first — the regression is far more likely in code the PR just changed than elsewhere). Don't speculatively rewrite unrelated code.
3. **Decide whether the fix is in scope.** Only attempt a fix if **all** of these hold:
   - The cause is in code (not infra, secrets, env vars, third-party services, or flake).
   - The fix is small and local — a few lines, one or two files. Anything that looks like a refactor, an architectural change, or a new feature is out of scope: mark `fail — fix out of scope: <reason>` and move on.
   - The fix doesn't require modifying tests, CI config, or anything that would weaken the test plan itself. **Never** edit the test plan item, comment out assertions, add `--no-verify`, lower a threshold, or hardcode a value to make the check pass.
4. **Apply the fix** with Edit/Write. Keep the diff minimal.
5. **Re-run only that item.** Same classification, same flow.
6. **Verify it passes.** If yes:
   - Commit with: `fix: <one-line summary> (test plan: <truncated item>)` — no body, no co-author trailer (the bot wrapper adds attribution).
   - `git push` to the PR branch.
   - Record the commit SHA in `commits` and set status `fixed`.
   - Continue to the next test plan item.
7. **If the re-run still fails**, increment `fix_attempts`. If under the per-item cap (2), loop back to step 1 with the new error signal. If at the cap, **revert the failed fix attempt** (`git reset --hard <sha-before-attempts>`) so the PR isn't polluted with dead code, then mark `fail — fix attempts exhausted: <last error>`.

**Per-item fix isolation:** record `git rev-parse HEAD` before the *first* fix attempt for each item. Every fix attempt for that item that doesn't ultimately succeed must be reverted back to that pre-attempt SHA before moving on. Successful fixes (status `fixed`) stay committed and pushed.

**Don't try to fix:**

- Items already classified `skip` (ambiguous, manual verification, requires auth).
- Failures whose cause is outside the codebase (env, secrets, infra, third-party outage, network).
- Anything where the fix would change the meaning of the test plan item.
- Flake. If a re-run without any code change passes, that's a flake — record `pass` with reason `flaked, retried clean`. Use this only when you made zero edits between the two runs.

**Never block the rest of the run on a failed item.** Continue with the next item even if the current one couldn't be fixed.

## Step 6 — Update the PR body

Build the new body by replacing each `- [ ] ` with `- [x] ` for items whose final status is `pass` or `fixed` (match on the unique trailing text). Leave failed, skipped, and pre-checked items unchanged. Preserve the rest of the body byte-for-byte — including the headings, blank lines, and any non-test-plan content.

```bash
gh pr edit $PR --body "$(cat <<'EOF'
<the new body>
EOF
)"
```

Sanity check the diff before pushing — run `gh pr view $PR --json body --jq .body` after, and confirm only the intended `[ ]` → `[x]` flips happened. If the diff shows anything else changed (e.g. line endings, trailing whitespace), abort and tell the user.

## Step 7 — Post the summary comment

Single comment, terse, no preamble. `🔧` items show the commit SHA(s) of the fix.

```markdown
**Test plan results — N pass / F fixed / M fail / K skip**

- ✅ <item one-liner>
- 🔧 <item one-liner> — fixed in `<sha7>` (<one-line fix summary>)
- ❌ <item one-liner> — <failure reason>
- ⏭️ <item one-liner> — <skip reason>
```

```bash
gh pr comment $PR --body "$(cat <<'EOF'
<the markdown above>
EOF
)"
```

After posting, output the comment URL to the user along with a one-line top-level summary (e.g. `Ran 7 items: 4 pass, 1 fixed, 1 fail, 1 skip. Pushed 1 fix commit. Boxes flipped for 5 items.`).

### Operator-attention banner (auth infra broken)

Some skip reasons aren't a property of the PR — they mean the local QA infra
needs a human to fix it before *any* future auth-gated test plan can run.
Burying them in a `⏭️` line is too easy to miss, so when any of these fire,
prepend a banner block to the summary comment (above the results list) and
include the same banner text as a separate `🚨` line at the top.

Trigger the banner on any of:

- `requires auth: seed failed (...)` — dev DB seed couldn't run
- `requires auth: ghost qa:session script missing`
- `requires auth: ghost dev DB has no OAuthToken (...)` — token expired,
  wiped, or never created
- `requires auth: sign-in failed (user not seeded — run pnpm db:reset)`

Banner format:

```markdown
> 🚨 **QA auth infra needs attention** — auth-gated test plan items were
> skipped because of a local/dev environment problem, not the PR itself.
> Fix the underlying issue, then re-run `/msilvis:pr-test-runner $PR`.
>
> - <repo>: <skip reason verbatim>
> - <repo>: <skip reason verbatim>
>
> Common fixes:
> - **Siltop-Visions seed failed / user not seeded** → `cd ~/Development/siltop-visions && pnpm db:reset`
> - **ghost: no OAuthToken** → open the ghost dev app in a real browser and complete a Bungie OAuth login once; the next run will pick up the new token automatically
> - **ghost: qa:session script missing** → `cd ~/Development/ghost && pnpm install`

```

The banner is informational only — it does **not** change the pass/fail/skip
counts. If no banner triggers fire, omit the block entirely.

## Safety

- Editing source code is allowed **only** inside the fix loop in step 5, with the fix budget and scope rules above. No edits outside that loop, ever.
- Never close/merge the PR. Allowed write operations: `gh pr edit --body`, `gh pr comment`, `git commit`, and `git push` to the PR's head branch only.
- Never push to `main`/`master` or any branch that isn't the PR's head. Never force-push. If `git push` is rejected (e.g. branch moved upstream), stop attempting fixes and record the affected items as `fail — push rejected`.
- Never bypass safety checks to make a fix land: no `--no-verify`, no `--force`, no editing CI/lint config to silence a check, no commenting out assertions or tests. If a pre-commit hook fails, fix the underlying issue or abandon the fix attempt.
- If the working tree is dirty before the run, stop in step 1. Don't stash or discard.
- If the PR body has been edited concurrently while you were running, your `gh pr edit` will overwrite their changes. Before writing, re-fetch the body and confirm the test plan section still matches the version you parsed; if it doesn't, abort the body update and tell the user the body changed under you (the comment + commits still post).
- Cap total runtime at 15 minutes. If a single browser flow hangs >2 min, kill it and mark `fail — timeout`.
- If `gh` isn't authenticated, stop immediately and tell the user to run `gh auth login`.

## Per-repo login config

Used by the auth-redirect handler in step 5. Each row documents the sign-in
flow for one watched repo and which env vars hold its test-account creds. If a
repo isn't listed here, auth-gated items will skip with
`requires auth: no login config for <repo>` until a row is added. Update this
table when a login UI changes (selectors going stale is the #1 cause of
silently-skipped test plan items).

Credentials live in `~/.botenv` (per `configs/bot/env.template`); they are
never read from the PR diff, the repo, or hardcoded here. Look them up via
`echo "${VAR:-}"` in a shell tool — never log the value.

### Prerequisite for all repos: seed the dev DB before the first auth attempt

Auth-gated test plan items assume a test account exists in the dev database.
On a fresh checkout — or any time `pnpm db:reset` has been run since the last
QA pass — the seed must be applied before login will work. Run the documented
seed command for the repo below (idempotent; safe to re-run). If the seed
command itself fails (DB not running, migrations out of date), mark the
auth-gated items `skip` with reason `requires auth: seed failed (<one-line
error>)` rather than retrying — fixing local infra is out of scope for the
test runner.

Run the seed once at the start of any run that has at least one browser-flow
item against an auth-gated repo, *before* the first navigation that could hit
a login redirect. Don't re-seed per item.

### MikeSilvis/Siltop-Visions

- **Login URL:** `/login` on the dev URL detected in step 4
- **Email env var:** `SILTOP_VISIONS_TEST_EMAIL` (default seed user: `mikesilvis@gmail.com`)
- **Password env var:** `SILTOP_VISIONS_TEST_PASSWORD` (default seed password: `password`)
- **Seed command:** `pnpm --filter db db:seed` (or `pnpm db:reset` for a full
  reset; the seed creates `mikesilvis@gmail.com` / `password` plus other test
  users — see `packages/db/prisma/seed/fixtures.ts`)
- **Sign-in flow (two-step form — entry, then password):**
  1. Navigate to `<dev-url>/login`.
  2. Step 1 of the form is a single text input `id="login-entry"`
     (`type="text"`, accepts email *or* phone, labeled "emailOrPhone" via
     i18n). Fill it with `$SILTOP_VISIONS_TEST_EMAIL`.
  3. Click the primary submit button ("Sign In") to advance to the password
     step. The URL stays on `/login`; the form swaps in a password field.
  4. Fill `id="login-password"` (`type="password"`) with
     `$SILTOP_VISIONS_TEST_PASSWORD`.
  5. Click the primary submit button ("Sign In") again.
  6. Wait for redirect off `/login` (success goes to the member's pass page,
     `/members/<passId>`). If the URL still contains `/login` after 5s,
     snapshot the visible error text and treat as `sign-in failed`. If the
     error suggests the user doesn't exist, surface
     `sign-in failed (user not seeded — run pnpm db:reset)`.
- **Maintainer note:** the form is two-step (entry → password), not one
  combined form. If Siltop adds SSO/magic-link or collapses the two steps,
  update this section before the next run.

### MikeSilvis/ghost

Ghost has **no email/password form**. Authentication is OAuth-only via
Bungie.net, which can't be automated headlessly. Instead, the dev app
exposes a `qa:session` script that mints a session cookie from an
existing OAuthToken row in the dev DB.

- **Login URL:** generated dynamically by `pnpm run qa:session` (not a fixed
  path; the script prints a URL like `<dev-url>/api/dev/qa-login?...`)
- **Env var:** `GHOST_QA_SESSION_ID` (optional — if set, `qa:session` selects
  the matching OAuthToken; otherwise the script picks the most recent
  non-e2e token automatically)
- **Prerequisite:** the dev DB must contain at least one `OAuthToken` row
  with a `destinyMembershipId`. This is **created by a one-time real Bungie
  OAuth login** through the dev app — there is no seed for it. If the row is
  missing, `qa:session` exits non-zero with a message about no eligible
  tokens.
- **Sign-in steps:**
  1. From the ghost repo root, run `pnpm run qa:session`. If
     `GHOST_QA_SESSION_ID` is set, invoke as
     `SESSION_ID="$GHOST_QA_SESSION_ID" pnpm run qa:session` (the script
     reads bare `SESSION_ID`; the `GHOST_QA_*` prefix is just the
     `~/.botenv` namespace). Optionally `QA_BASE_URL=<dev-url>` to
     override the default. Capture stdout.
  2. Parse the printed URL (it ends with `/api/dev/qa-login`, possibly with
     query params).
  3. Navigate the browser to that URL. The endpoint sets the session cookie
     and 302s to `/guardians` (or another non-login route).
  4. Wait for redirect off `/api/dev/qa-login`. If the response is non-2xx/3xx
     or the URL stays on the qa-login endpoint after 5s, treat as
     `sign-in failed` and surface the page's error text.
- **Skip reasons specific to ghost:**
  - `qa:session` script not present → `requires auth: ghost qa:session script missing`
  - `qa:session` exits non-zero with "no eligible OAuthToken" → `requires auth: ghost dev DB has no OAuthToken (complete a real Bungie OAuth login once in the dev app)`
- **Maintainer note:** the `qa-login` endpoint is gated to dev/localhost and
  returns 403 in prod (see `web/app/api/dev/qa-login/route.ts`). Do not
  attempt this flow against a non-dev URL. Reference doc:
  `ghost/.claude/playwright-qa.md`.

### MikeSilvis/portal

- **Login URL:** `/login` on the dev URL detected in step 4
- **Email env var:** `PORTAL_TEST_EMAIL`
- **Password env var:** `PORTAL_TEST_PASSWORD`
- **Sign-in steps:**
  1. Navigate to `<dev-url>/login`.
  2. Fill the email + password inputs from the env vars.
  3. Click the primary submit button.
  4. Wait for redirect away from `/login`; fail if still there after 5s.
