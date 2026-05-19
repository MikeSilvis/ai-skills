---
name: code-quality
description: Full code quality pass — runs /review to find and fix all issues, then runs /simplify with framework-aware focus areas. Use when asked to improve code quality, clean up a repo, or run a full quality pass.
---

# Code Quality Pass

Run a full, automated code quality pass on all changed code. This chains /review and /simplify together, fixing everything along the way. Do not ask for confirmation between steps — fix all issues as you go.

## Step 0: Check Existing Review Marker

Before doing any work, check whether this PR has already been reviewed by a prior `/code-quality` run at the current HEAD commit.

1. Resolve the current PR (if any): `gh pr view --json number,headRefOid -q '{num: .number, sha: .headRefOid}'`. If there's no PR, skip this step entirely.
2. Look for a sentinel comment posted by a previous run:
   ```sh
   gh pr view --json comments -q '.comments[].body' | grep -E '^<!-- code-quality-pass:reviewed:[a-f0-9]+ -->'
   ```
3. Interpret the result:
   - **Sentinel matches current HEAD SHA** — announce in one line that the PR is already marked reviewed at this commit, then ask the user whether to skip or rerun. Do not auto-rerun; this is the only confirmation prompt in the whole skill.
   - **Sentinel exists but for an older commit** — note that the PR was previously reviewed at `<old_sha>` and proceed; you'll refresh the marker at the end.
   - **No sentinel** — proceed silently. You'll add the marker at the end.

## Step 1: Detect the Stack

Before starting, detect what kind of project this is:

1. **Read the project config** — `package.json`, `Podfile`, `Package.swift`, `Gemfile`, `go.mod`, `pyproject.toml`, `CLAUDE.md`
2. **Classify the repo** — a repo can match multiple categories. Apply all that fit:
   - **React** — has `react` in dependencies (includes React Native, Remix, etc.)
   - **Next.js** — has `next` in dependencies (always also React)
   - **Prisma** — has `prisma` or `@prisma/client` in dependencies
   - **SwiftUI** — has `.swift` files importing `SwiftUI`
   - **Other** — anything that doesn't match the above
3. Note all matching classifications — you'll run the passes for each in Step 3.

## Step 2: Review and Fix

Run `/review` on the changed code. **Attempt a best-effort fix for every issue it surfaces — including logic and policy concerns that look like "needs human judgment."** This skill often runs in a background agent where there's no human to defer to; a wrong-but-recorded fix that a human can revert is strictly better than a silent skip that re-emerges as an FYI later. Do not ask which issues to fix — fix them all.

The only fixes you should skip are ones where applying *any* mechanical change would clearly make things worse (e.g. the concern is architectural and a real fix would require rewriting unrelated files). Those are rare. When in doubt, fix.

After fixing, re-read the changed files to make sure your fixes didn't introduce new problems.

### Recording unresolved findings

If a concern is one of those rare cases you genuinely cannot attempt to fix, record it for surfacing in Step 6's sentinel comment. Keep the list as plain bullets; one short line per finding, including `file:line` when known:

```
- Description of concern (path/to/file.ts:42)
```

If every concern was fixed, the unresolved list is empty and Step 6 posts the normal ✅ sentinel. Do not move on to Step 3 with a non-empty unresolved list and a ✅ — `/msilvis:code-quality-ship` reads this list at its gate, and stuffing unfixed concerns into a ✅ comment hides them.

## Step 3: Simplify (Multiple Passes)

Run `/simplify` multiple times, each pass focused on a specific area. Fix all issues from each pass before moving to the next.

### All Repos (always run these)

**Pass 1 — Reuse and duplication:**
Run `/simplify` with focus on code reuse, DRY violations, and duplicated logic that should be extracted.

**Pass 2 — Efficiency and correctness:**
Run `/simplify` with focus on unnecessary computations, redundant checks, overly defensive code, and logic that can be streamlined.

### React Repos (run these additional passes)

**Pass 3 — Component structure:**
Run `/simplify` with focus on: component decomposition, props drilling that should use context, inline styles that should be extracted, components doing too many things.

**Pass 4 — Hooks and rendering:**
Run `/simplify` with focus on: unnecessary re-renders, missing or incorrect memoization (`useMemo`, `useCallback`, `React.memo`), hook dependencies, derived state that should be computed instead of stored, effects that should be event handlers.

**Pass 5 — State management:**
Run `/simplify` with focus on: state that lives too high or too low in the tree, redundant state, state that can be derived from other state, unnecessary context providers, overly complex reducers.

### Next.js Repos (run these additional passes)

**Pass — Server vs client boundaries:**
Run `/simplify` with focus on: components that are `"use client"` but don't need to be, server components doing work that belongs in a route handler, data fetching in client components that should be server-side, unnecessary `"use server"` directives.

**Pass — Data fetching and caching:**
Run `/simplify` with focus on: redundant `fetch` calls that should be deduplicated, missing or incorrect `revalidate` / `cache` options, waterfalls that could be parallel (`Promise.all`), data fetched at the layout level that should be at the page level or vice versa, improper use of `generateStaticParams`.

**Pass — Routing and middleware:**
Run `/simplify` with focus on: logic in middleware that belongs in a route handler, overly complex dynamic routes, redirect/rewrite logic that could be simplified, missing or misused `loading.tsx` / `error.tsx` / `not-found.tsx` boundaries.

### Prisma Repos (run these additional passes)

**Pass — Schema design:**
Run `/simplify` with focus on: missing indexes on fields used in `where` / `orderBy` clauses, relations that should be cascading but aren't, overly permissive `String` fields that should be enums, missing `@@unique` constraints, `@default` values that should exist.

**Pass — Query efficiency:**
Run `/simplify` with focus on: N+1 queries (multiple `findMany` in a loop instead of a single query with `include` or `in`), over-fetching with `include` when `select` would suffice, missing `take` / `skip` on unbounded queries, raw queries that could be Prisma Client calls, transactions that are too broad or too narrow.

**Pass — Type safety and client usage:**
Run `/simplify` with focus on: generated types not being used (hand-written interfaces duplicating Prisma types), `any` casts on Prisma results, missing error handling on unique constraint violations, `findFirst` used where `findUnique` is correct, stale generated client (schema changed but `prisma generate` not reflected).

### SwiftUI Repos (run these additional passes)

**Pass 3 — View composition:**
Run `/simplify` with focus on: views that are too large and should be broken into subviews, extracted view modifiers, reusable view components, proper use of `ViewBuilder`.

**Pass 4 — State and data flow:**
Run `/simplify` with focus on: incorrect use of `@State` vs `@Binding` vs `@ObservedObject` vs `@StateObject` vs `@EnvironmentObject`, unnecessary state, state owned at the wrong level, observable objects that should be environment objects.

**Pass 5 — Performance:**
Run `/simplify` with focus on: unnecessary view redraws, lazy stacks where appropriate, expensive computations in view bodies, `task` vs `onAppear` usage, image loading and caching.

## Step 4: Final Check

After all passes are complete:

1. Re-read all changed files one final time
2. Make sure the code still compiles / passes lint (run the project's lint or type-check command if one exists)
3. Summarize what was changed in a short bulleted list

## Step 5: Commit if PR is Open

After the final check, check if the current branch has an open PR (`gh pr view --json state -q '.state'`). If a PR is open, commit all changes with a descriptive message and push immediately. Do not ask for confirmation — just commit and push.

## Step 6: Mark PR as Reviewed

After the commit/push (or immediately, if there were no changes to commit), post an idempotent review marker on the PR so future runs and human reviewers can see the pass completed.

1. Skip entirely if there's no open PR.
2. Get the post-push HEAD SHA: `git rev-parse HEAD`.
3. Check for an existing sentinel for *this* SHA:
   ```sh
   gh pr view --json comments -q '.comments[].body' | grep -F "<!-- code-quality-pass:reviewed:$(git rev-parse HEAD) -->"
   ```
   If found, do nothing — already marked.
4. Otherwise post a comment with the hidden sentinel + a short human summary. The shape of the comment depends on whether Step 2 left any unresolved review findings:

   **No unresolved findings:**
   ```sh
   gh pr comment --body "$(cat <<EOF
   <!-- code-quality-pass:reviewed:$(git rev-parse HEAD) -->
   ✅ **Code quality pass completed** at \`$(git rev-parse --short HEAD)\`

   Ran \`/msilvis:code-quality\` — review + simplify passes for this stack.
   EOF
   )"
   ```

   **With unresolved findings from Step 2:** lead with a ⚠️ headline and wrap the bullets in the `unresolved-review-findings` markers so `/msilvis:code-quality-ship` (and humans skimming the PR) can see them at a glance instead of buried as an FYI.
   ```sh
   gh pr comment --body "$(cat <<EOF
   <!-- code-quality-pass:reviewed:$(git rev-parse HEAD) -->
   ⚠️ **Code quality pass completed with unresolved review findings** at \`$(git rev-parse --short HEAD)\`

   The \`/review\` step surfaced concerns that need a human judgment call. They were not auto-fixed:

   <!-- unresolved-review-findings:start -->
   - <finding 1>
   - <finding 2>
   <!-- unresolved-review-findings:end -->

   All other review and simplify passes are complete.
   EOF
   )"
   ```
5. Do **not** edit or delete prior sentinel comments from older commits — leaving them creates a cheap audit trail of when each commit was reviewed.

## Rules

- **Fix everything you reasonably can** — do not skip issues because they seem minor or because they touch logic that needs judgment. Best-effort fix anything `/review` surfaces; a human can revert what's wrong. The whole point is to catch what humans skip.
- **Don't ask, just fix** — this is a fully automated pass. Fix all issues without prompting.
- **Surface what you couldn't fix** — if you genuinely couldn't attempt a fix, the Step 6 sentinel comment must be the ⚠️ variant with an `unresolved-review-findings` block. Never post the ✅ sentinel while leaving review concerns silently undone — that's the failure mode this skill exists to prevent.
- **Respect existing conventions** — match the patterns already in the codebase.
- **Don't over-abstract** — three similar lines are still better than a premature helper. Only extract when there are clear, repeated patterns.
- **Don't add noise** — no unnecessary comments, no docstrings on obvious functions, no type annotations where inference is clear.
- **Each simplify pass is focused** — don't try to fix everything in one pass. Each pass targets a specific concern so nothing gets missed.
- **Commit when a PR is open** — if the branch has an open PR, always commit and push changes at the end. No confirmation needed.
- **Mark the PR as reviewed** — always end an open-PR run by posting (or confirming the presence of) the `<!-- code-quality-pass:reviewed:<sha> -->` sentinel comment. The only time you skip the work itself is if Step 0 finds the sentinel already exists for the current HEAD *and* the user opts out of rerunning.
- **Tick the test plan boxes you verified** — after the review pass on an open PR, flip every `## Test plan` checkbox you actually confirmed during `/review` from `- [ ] ` to `- [x] ` in the PR body. Use the canonical pattern from the `pr-test-runner` skill: match each item by its unique trailing text, re-fetch the body via `gh pr view $PR --json body --jq .body` right before writing, and never alter the wording of a test plan item — only flip its leading `[ ]`. If a box's behavior wasn't actually exercised in this pass, leave it unchecked.
