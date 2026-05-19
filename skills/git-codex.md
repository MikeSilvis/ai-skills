---
alwaysApply: true
targets: [codex]
---
# Git Workflow (Codex)

## Worktrees (default workflow)

- Do all code work in a git worktree. Before the first edit in any task that will modify files in a repo, create and switch into a worktree under `.claude/worktrees/`. Skip the worktree for read-only exploration, questions about the codebase, shell-only operations, and edits outside any git repo.
- Use the same `<type>/<kebab-summary>` string for both the branch name and the worktree directory so they match (e.g. branch `feat/login-redirect`, worktree dir `.claude/worktrees/feat+login-redirect` — `/` becomes `+` in the path).
- Create the worktree with:

  ```sh
  git worktree add .claude/worktrees/<type>+<summary> -b <type>/<summary>
  cd .claude/worktrees/<type>+<summary>
  ```

  Run every subsequent shell command from inside that directory (use absolute paths or persist the `cd` in your shell session). Never edit files in the main checkout once a worktree exists for the task.
- If already inside a worktree (path is under `.claude/worktrees/`), don't nest — keep working there.
- When the task is done and committed/pushed, leave the worktree in place. Do not run `git worktree remove` unless the user asks; the first-touch cleanup below handles merged-branch worktrees.

## First-touch repo cleanup

The first time you do work in a repo this session — before creating a worktree, before any edits — run a one-shot cleanup of merged state. Do this once per repo per session, not before every task. Skip it entirely if the repo has no GitHub remote or `gh` is not authenticated.

1. `git fetch --prune` and `git worktree prune` to drop dead refs and stale worktree entries.
2. List candidate local branches: `git for-each-ref --format='%(refname:short)' refs/heads/` minus `main`/`master` and the currently checked-out branch.
3. For each candidate, confirm its PR is merged via `gh pr list --state merged --head <branch> --json number --jq 'length'` (non-zero = merged). Do NOT rely on `git branch --merged` alone — it misses squash-merged branches.
4. For each confirmed-merged branch:
   - If a worktree is checked out on it (`git worktree list`), `git worktree remove <path>` (refuse with `--force` only if the user asks).
   - Then `git branch -D <branch>`.
5. Skip — and surface to the user in one line — any branch with uncommitted changes, unpushed commits not in the merged PR, or no associated PR. Never delete a branch you couldn't verify.

Report the cleanup as a single terse line (e.g. `Cleaned 3 merged branches: fix-a, fix-b, feat-c`) and move on. If nothing was eligible, say nothing.

## Creating pull requests

When the user asks you to open a PR — or when you're shipping the change yourself — follow this recipe. The shared Git skill defines the *template*; this section defines the *workflow*. The template is mandatory, even for one-line PRs.

### 1. Analyze the whole branch (not just the last commit)

Before drafting anything, run these in parallel and read the output:

```sh
git status                              # uncommitted work you still need to handle
git diff origin/main...HEAD --stat      # files changed overall
git log origin/main..HEAD --oneline     # every commit on the branch
git diff origin/main...HEAD             # the actual cumulative diff
```

A reviewer sees the cumulative diff, not the commit history. If the branch has multiple commits, the Summary MUST cover all of them — not just the latest. Skipping this step is the #1 reason PR bodies come out shallow.

### 2. Draft the body — two sections, both required

Do NOT write a free-form paragraph and call it a PR body. The `## Summary` and `## Test plan` headings are mandatory. A short paragraph with no headings is the most common Codex failure mode and will be rejected.

**Summary** — 2–4 bullets, not 1:

- Lead bullet: the *why* — what was broken, missing, or motivating the change. Frame it as a problem statement, not a label. "Refactor X" is a label. "X was doing Y under load, which caused Z; replace it with W so Z stops happening" is a Summary bullet.
- Middle bullets: the substantive *what* — the key behavior changes, the approach, any non-obvious trade-off. One bullet per distinct change.
- Optional final bullet: caveats, intentional non-coverage, or follow-up work the reviewer should know about.

If the PR touches more than one file in a meaningful way, the Summary should have more than one bullet. Single-bullet Summaries for multi-file PRs are a smell.

**Test plan** — 3–6 items in `- [ ]` checklist format:

- One item per behavior changed. A PR that touches 3 things needs ~3 checks, not 1.
- Each item is verifiable: a command to run, a UI flow to click, a log line to grep, an assertion to eyeball. "Code compiles" / "tests pass" do not count — CI already does those.
- For pure docs/config changes with nothing to test, write `- [ ] N/A — docs only` and stop. Never omit the section entirely.
- The `pr-test-runner` skill parses this list and executes each item via Playwright or Bash, so the format must be exact: `- [ ] <verb> <thing>`.

### 3. Submit

```sh
gh pr create --title "<type>(<scope>): <≤70 char description>" --body "$(cat <<'EOF'
## Summary
- <why>
- <what 1>
- <what 2>

## Test plan
- [ ] <check 1>
- [ ] <check 2>
- [ ] <check 3>
EOF
)"
```

Title: `<type>(<scope>): <description>` matching the branch's type (`feat`, `fix`, `chore`, etc.). ≤70 chars, no trailing period.

### Anti-patterns — reject your own draft if it matches any of these

- ❌ A free-form body with no `## Summary` / `## Test plan` headings
- ❌ A Summary that just restates the commit subject in different words
- ❌ A single-bullet Summary on a multi-file PR
- ❌ A Test plan with one generic item like "works as expected"
- ❌ Drafting from only the latest commit message instead of reading the full branch diff
