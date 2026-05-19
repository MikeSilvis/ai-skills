---
name: bug-bash
description: Collect a batch of bugs / issues / changes from the user, then categorize them and dispatch parallel subagents — one per category — each working in its own git worktree to fix that category's items. Use when the user invokes `/msilvis:bug-bash` or says "bug bash", "let's bug bash", "queue up some fixes", or otherwise signals they want to dump a list of issues and have them worked in parallel.
---

# Bug Bash — Collect, Categorize, Dispatch

You orchestrate a parallel bug-fix session. The user dumps a series of bugs / issues / small changes; you collect them silently, then on the "go" signal you group them by area and spin up one subagent per group, each in its own git worktree, to fix them in parallel.

You do **not** fix bugs yourself in this skill. You are the conductor — collecting input, organizing it, and dispatching workers.

## Phase 1 — Collect (the intake loop)

When this skill is invoked, immediately enter intake mode and tell the user (one short message):

> Bug bash started. Drop bugs / issues / changes one per message or as a list. Say **go** when you're done. Say **show** to see the running list, **drop N** to remove an item, or **stop** to cancel.

Then wait. Each subsequent user message is intake input until they signal completion.

**Track the running list in your conversation context** — number each item as it comes in. Do NOT write a scratch file, do NOT create a plan, do NOT spawn anything yet. Just collect.

Treat every user message in this phase as a new bug entry unless it matches a control verb:

| User says | You do |
|---|---|
| `go`, `ship it`, `let's go`, `done`, `that's all`, `dispatch` | Move to Phase 2 |
| `show`, `list`, `what do we have` | Echo the numbered list back, then keep waiting |
| `drop 3`, `remove 3`, `nix 3` | Delete item 3, echo the new list, keep waiting |
| `edit 3 <new text>`, `replace 3 <new text>` | Replace item 3, echo it back, keep waiting |
| `stop`, `cancel`, `nevermind` | Abort the bug bash with one line: "Cancelled — no agents dispatched." |

If a single user message contains multiple bugs (numbered list, bullets, multiple sentences separated by newlines), split them into separate items. If you're unsure whether a message is one item or several, ask in one short sentence — don't guess.

After each non-control message, acknowledge with a single line: `Got it — N items queued.` No commentary, no sub-bullets, no "is there anything else." Just the count. Stay quiet otherwise.

## Phase 2 — Categorize (after "go")

When the user signals completion:

1. **Show the final list** numbered, then your proposed groupings.
2. **Group by area**, not by severity. Pick categories from the actual items — don't force a fixed taxonomy. Examples of natural groupings: `ui` (visual / styling / layout), `frontend-logic` (React state, hooks, client behavior), `backend` (API routes, server actions, db queries), `infra` (CI, deploy, env, dotfiles), `docs`, `tests`, `tooling` (lint, build, types), `copy` (text/strings only).
3. **One category per worktree.** Aim for 2–5 categories total. If you'd end up with one category holding 1 item and another holding 12, rebalance — split the big one by sub-area or merge a singleton into the closest neighbor.
4. **Skip empty categories.** If everything is UI, that's fine — one worktree, one agent.
5. **Flag ambiguous items.** If an item could plausibly belong to two categories, pick the one whose agent has the most context to fix it (e.g. a "button doesn't submit" bug goes to frontend-logic, not ui).

Present the plan like this:

```
Final list (N items):
  1. <item>
  2. <item>
  ...

Proposed groups:
  • ui (3): #1, #4, #7
  • backend (2): #2, #5
  • docs (1): #3

Dispatching 3 agents in parallel. Reply "tweak" to adjust groupings, anything else to proceed.
```

Wait one beat for a `tweak` / adjustment. If they reply with anything else (including silence-then-confirmation like "yes" / "go" / "do it"), proceed to dispatch. If they say `tweak` or describe changes, apply them and re-confirm once.

## Phase 3 — Dispatch (parallel agents in worktrees)

For each category, spawn one `general-purpose` Agent **in parallel** (single message, multiple Agent tool uses) with `isolation: "worktree"` so each gets its own git worktree.

Use a worktree name shaped like `bug-bash-<category>-<YYYYMMDD>` (e.g. `bug-bash-ui-20260429`). The branch name will match.

Each agent's prompt must be self-contained — it has none of this conversation's context. Include:

- **What this is**: "You are one worker in a bug-bash session. Your category is `<category>`. Fix only the items below."
- **The exact items** verbatim from the user, numbered as they were in the master list (so the user can cross-reference).
- **Repo conventions reminder**: respect `CLAUDE.md` / `AGENTS.md` in the repo, run the project's validate command before finishing, follow the project's PR template.
- **What to deliver**: a commit (or commits) on the worktree's branch, push the branch, open a PR with a `## Summary` and `## Test plan` checklist (one checklist item per fixed bug, referencing the original number — e.g. `- [ ] #4: hover state on nav links is no longer cut off`). If a bug turns out to be wrong, infeasible, or out of scope, leave it unchecked and explain in the PR body — don't silently drop it.
- **Reporting back**: a short summary (under 150 words) listing which items were fixed, which were skipped (with reason), and the PR URL.

Dispatch every agent in **a single message with multiple Agent tool uses** so they run truly in parallel. Do not await one before starting the next.

## Phase 4 — Final summary

After all agents return, post a single consolidated report:

```
Bug bash complete — N items across M categories.

✅ ui — #1, #4, #7 fixed → <PR url>
✅ backend — #2 fixed, #5 deferred (needs design input) → <PR url>
✅ docs — #3 fixed → <PR url>

Deferred (1): #5 — needs design input on the empty state copy.
```

Keep it terse. Don't rehash agent prose; just the outcome per category, the PR links, and any deferred items grouped at the bottom.

## Rules

- **Don't fix anything yourself.** You are the conductor. Even if a bug looks trivial, it belongs to a worker agent.
- **Don't write planning files.** Track state in conversation context, not on disk.
- **Don't create a worktree yourself for the conductor role.** You stay in the main checkout (or wherever the user invoked you). Each *worker* gets its own worktree via `isolation: "worktree"`.
- **Don't proceed past Phase 1 without an explicit "go"-style signal.** Silence is not consent — keep waiting.
- **Don't dispatch with zero items.** If the user says "go" but the list is empty, tell them so and stay in intake.
- **Don't over-categorize.** One agent per area. If two areas have one item each and they're related, merge them.
- **Don't run agents serially.** All Agent tool uses for dispatch go in one message.
