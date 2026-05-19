---
name: code-quality-ship
description: Full code quality pass that auto-merges the PR when CI is green and the change is simple enough. Runs /msilvis:code-quality, then gates a squash-merge on a strict simplicity checklist. Use when the user wants to ship a small PR end-to-end with one command.
---

# Code Quality + Ship

Extends `/msilvis:code-quality`: run the full review + simplify pass, then — only if the change is small and safe — wait for CI and squash-merge the PR. If anything trips the simplicity gate, stop and hand control back to the user instead of merging.

## Step 1: Require an Open PR

This skill is only for shipping an open PR. Before doing anything else:

1. `gh pr view --json number,state,headRefOid,isDraft -q '{num: .number, state: .state, sha: .headRefOid, draft: .isDraft}'`
2. If there is no PR, the PR is closed/merged, or it's a draft — stop and tell the user. Do not proceed.

## Step 2: Run the Full Code Quality Pass

Run `/msilvis:code-quality` against the current branch. Follow that skill exactly: review, fix everything, run all simplify passes for the detected stack, commit, push, and post the reviewed sentinel.

Do not skip any of its steps. If `/msilvis:code-quality` finds issues that require user judgment (it asks a question, hits something ambiguous, or the rerun confirmation in its Step 0), stop and let the user decide — do not auto-merge.

## Step 3: Schema + Complexity Gate

After the quality pass commits and pushes, decide whether the PR is safe to auto-merge. The gate has three pillars: **no unresolved review findings**, **no schema changes**, and **low complexity**. Long PRs are fine — what matters is that the change is mechanical/obvious and has no data-shape implications.

**If anything below trips, stop and hand off. Don't merge.**

Compute the diff against the PR base:

```sh
base=$(gh pr view --json baseRefName -q '.baseRefName')
git fetch origin "$base"
git diff --name-only "origin/$base"...HEAD
git diff "origin/$base"...HEAD
```

### Pillar 0 — Unresolved review findings (highest precedence)

Before evaluating the schema and complexity pillars, read the sentinel comment that Step 2 posted and check for an `unresolved-review-findings` block. These are concerns `/review` surfaced that the model couldn't safely auto-fix; they need human judgment before the PR can ship.

```sh
findings=$(gh pr view --json comments -q '.comments[].body' \
  | awk '/unresolved-review-findings:start/{flag=1;next} /unresolved-review-findings:end/{flag=0} flag')
```

If `$findings` is non-empty, the gate trips on this signal alone — proceed straight to "If the gate trips" below and use the **Pillar 0 template**, which leads with the unresolved findings rather than burying them under a complexity-gate framing. Do not also post a Pillar B comment; the findings are the headline.

If `$findings` is empty, proceed to Pillar A.

### Pillar A — Schema / data-shape changes (any one trips the gate)

- `prisma/schema.prisma` edited
- New files in `prisma/migrations/` or any `migrations/**/*.sql`, `db/migrate/**`
- Edits to ORM model definitions that change columns, types, indexes, or relations (Prisma, ActiveRecord, SQLAlchemy, GORM, etc.)
- New or modified API contract files (`*.proto`, `*.graphql`, OpenAPI specs)
- Changes to serialization formats persisted to disk or DB (e.g. JSON column shapes, enum values stored in the DB)

Schema changes ship behind a human merge. Always.

### Pillar B — Complexity judgment

Read the diff and decide whether a reviewer would call this "obvious" or "needs thinking." A long PR full of mechanical edits (renames, formatting, extracting a helper used in one place, deleting dead code, doc/comment changes, test additions for existing behavior) is fine to merge. A short PR that introduces new behavior or new patterns is not.

**Trips the gate — needs a human:**

- New control flow that changes runtime behavior (new conditionals on user-facing paths, new error handling that swallows or transforms errors, new retry/backoff/caching logic, new auth or permission checks)
- New abstractions: a new class, hook, context, helper module, or interface that didn't exist before
- Concurrency, async ordering, transactions, locking, or race-condition-adjacent code
- Changes to authentication, authorization, session handling, crypto, secret handling, or input validation at trust boundaries
- Dependency adds/upgrades (`package.json`, `pnpm-lock.yaml`, `Podfile`, `Package.swift`, `Gemfile`, `go.mod`, `pyproject.toml`, `requirements*.txt`, `.mise.toml`)
- CI/build/deploy config changes (`.github/workflows/`, `.circleci/`, Dockerfiles, `docker-compose*`, deployment manifests, env files)
- Changes that span unrelated areas (mixed-scope PR — bug fix + refactor + new feature in one)
- Anything where you, after reading the diff, can't summarize what changed and why in one sentence

**Does NOT trip the gate (mechanical, ship it):**

- Renames, dead-code removal, formatting, comment/doc edits
- Pure refactors that move code without changing behavior (and the test suite covers it)
- Adding tests for existing behavior
- Tightening types where inference was already correct
- Inlining/extracting a helper used in one spot

### Pillar C — Process signals

- PR is not labeled `do-not-merge`, `wip`, or `blocked` (`gh pr view --json labels -q '.labels[].name'`)
- `gh pr view --json reviewDecision -q '.reviewDecision'` is not `CHANGES_REQUESTED`
- No open review threads in `CHANGES_REQUESTED` state (`gh pr view --json reviews -q '[.reviews[] | select(.state=="CHANGES_REQUESTED")] | length'` is `0`)

(Unresolved `/review` findings are handled by Pillar 0 above, not here.)

### If the gate trips

Post a single PR comment that **leads with the highest-precedence reason**. Order: Pillar 0 → Pillar A → Pillar B → Pillar C. If multiple pillars tripped, mention each briefly but use the highest-precedence template as the headline. Then stop — don't merge.

**Pillar 0 — unresolved review findings (use this whenever `$findings` from Pillar 0 is non-empty, even if other pillars also tripped):**

```
🛑 **Auto-merge blocked — `/review` flagged concerns that need your judgment.**

The code-quality pass at `<short_sha>` surfaced these issues but did not auto-fix them:

<paste $findings here, verbatim>

Please address them in this PR (or call them out as known/intentional in a reply), then re-run `/msilvis:code-quality-ship`.
```

**Pillar A / B / C — only when there are no unresolved findings:** post a brief PR comment naming which pillar/specific item blocked the merge (e.g. "Skipped auto-merge: introduces a new retry helper in `lib/fetch.ts` — wants a human eye"). Then stop. Don't merge.

## Step 4: Wait for CI to Pass

Only reached if Step 3 passed every check.

1. `gh pr checks <pr-number> --watch` — wait for all required checks. Timeout after 15 minutes.
2. If any check fails:
   - Read the failure: `gh pr checks <pr-number>` and `gh run view <run-id> --log-failed`
   - If the failure is clearly caused by the changes in this PR and the fix is trivial (≤ a few lines, no scope expansion), apply it, commit, push, and re-enter Step 4. Max 2 retry attempts.
   - Otherwise, stop and report the failure to the user. Do not merge a red PR.
3. If checks pass, proceed.

## Step 5: Squash-Merge

1. `gh pr merge <pr-number> --squash --delete-branch`
2. Confirm: `gh pr view <pr-number> --json state -q '.state'` should be `MERGED`.
3. Report a one-line summary to the user: PR number, title, and the merged commit SHA on the base branch.

## Rules

- **Never merge if any simplicity check fails.** The whole point is that this skill only ships obviously-safe PRs. When in doubt, hand off.
- **Never merge a draft PR or a PR with `CHANGES_REQUESTED`.**
- **Never use `--admin` or `--no-verify`** to bypass branch protection or hooks. If the merge is blocked, surface the reason and stop.
- **Never force-push to fix CI.** If CI fails for a non-trivial reason, stop and let the user decide.
- **One round trip only** — don't loop indefinitely chasing flaky CI. Two retries max, then bail.
- **Don't expand scope to make the gate pass** — if the PR is too big, that's a signal the user should split it, not a prompt to keep going.
