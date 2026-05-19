# Git

- Write concise commit messages that explain why, not what
- Prefer small, focused commits over large ones
- Never force push to shared branches
- Always rebase, never merge. Use `git pull --rebase` to update branches and `git rebase main` to integrate upstream changes — never `git merge` or `git pull` (which defaults to merge). No merge commits in feature branches. If a rebase hits conflicts, resolve them; do not abort and switch to a merge.
- Always open a PR — never push directly to `main`/`master`. Every change goes on a feature branch (see branch naming below) and ships via `gh pr create`. No direct commits or pushes to the default branch, even for tiny fixes. If a PR is already open for the current branch, push to it; don't open a duplicate.

## Branch naming

Format: `<type>/<kebab-summary>` — optionally suffix with `-<issue>` if there's a tracking ticket (e.g. `fix/login-redirect-loop-1234`).

- Allowed types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `ci`, `revert`
- Summary is lowercase kebab-case, ≤50 chars total branch length, no trailing date or initials
- Don't reuse a branch name after its PR merges; pick a new one
- Exceptions: `main`, `master`, release branches (`release/x.y.z`), and hotfix branches (`hotfix/<summary>`) keep their conventional names

## PR body format

Every `gh pr create` must use this two-section template — pass it via HEREDOC so newlines and markdown render correctly:

```
gh pr create --title "<short title, ≤70 chars>" --body "$(cat <<'EOF'
## Summary
- <1–3 bullets describing the why and what changed>

## Test plan
- [ ] <concrete check a reviewer or automation can run>
- [ ] <another check, one per behavior changed>
EOF
)"
```

- **Title**: ≤70 chars, no trailing period. Details belong in the body.
- **Summary**: 1–3 bullets. Lead with the motivation/intent, not a file-by-file diff recap. Look at every commit on the branch (not just the latest) when drafting it.
- **Test plan**: an actionable markdown checklist (`- [ ]`). Each item is something verifiable — a command to run, a UI flow to click through, an assertion to eyeball. Skip items that are not relevant (pure docs/config changes can say `- [ ] N/A — docs only`), but never omit the section. The `pr-test-runner` skill parses this checklist, so the format must be exact.
- Do not invent test items the change does not warrant. Three real checks beat ten generic ones.
