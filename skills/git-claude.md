---
alwaysApply: true
targets: [claude]
---
# Git Workflow (Claude Code)

- Use the same `<type>/<kebab-summary>` string as the worktree `name` in `EnterWorktree` so the worktree dir and branch name match (the first-touch cleanup will have already deleted any merged branch by that name).

## Worktrees (default workflow)

Treat this section as the explicit project instruction that authorizes the `EnterWorktree` tool — its own contract requires CLAUDE.md to opt in.

- Do all code work in a git worktree. Call `EnterWorktree` at the start of any task that will modify files in a repo. Skip the worktree for read-only exploration, questions about the codebase, shell-only operations, and edits outside any git repo.
- Pass a short descriptive `name` (e.g. `fix-login-redirect`) instead of letting it auto-generate, so the worktree dir is greppable later.
- If already inside a worktree (the path is under `.claude/worktrees/`), don't nest — just keep working there.
- When the task is done and committed/pushed, leave the worktree in place; the session-exit prompt will handle keep-vs-remove. Only call `ExitWorktree` if the user asks.

## First-touch repo cleanup

The first time you do work in a repo this session — before `EnterWorktree`, before any edits — run a one-shot cleanup of merged state. Do this once per repo per session, not before every task. Skip it entirely if the repo has no GitHub remote or `gh` is not authenticated.

1. `git fetch --prune` and `git worktree prune` to drop dead refs and stale worktree entries.
2. List candidate local branches: `git for-each-ref --format='%(refname:short)' refs/heads/` minus `main`/`master` and the currently checked-out branch.
3. For each candidate, confirm its PR is merged via `gh pr list --state merged --head <branch> --json number --jq 'length'` (non-zero = merged). Do NOT rely on `git branch --merged` alone — it misses squash-merged branches.
4. For each confirmed-merged branch:
   - If a worktree is checked out on it (`git worktree list`), `git worktree remove <path>` (refuse with `--force` only if the user asks).
   - Then `git branch -D <branch>`.
5. Skip — and surface to the user in one line — any branch with uncommitted changes, unpushed commits not in the merged PR, or no associated PR. Never delete a branch you couldn't verify.

Report the cleanup as a single terse line (e.g. `Cleaned 3 merged branches: fix-a, fix-b, feat-c`) and move on. If nothing was eligible, say nothing.
