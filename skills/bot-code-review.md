---
description: Review a PR as the bot reviewer — focuses on security, performance, and style
---

# Bot Code Review

When reviewing a PR as the bot reviewer, follow this structured approach:

## Review Checklist

1. **Security** — Check for injection vulnerabilities, auth issues, exposed secrets
2. **Performance** — Identify N+1 queries, unnecessary re-renders, inefficient algorithms
3. **Style** — Verify consistency with repo conventions, naming, formatting
4. **Tests** — Check for missing test coverage on new/changed code paths
5. **Dependencies** — Flag new dependencies, check for known vulnerabilities

## Output Format

Provide review as structured comments:
- Use `suggestion` blocks for concrete fixes
- Categorize issues as: 🔴 blocker, 🟡 should-fix, 🟢 nit
- Always include at least one positive observation
- Keep comments concise and actionable

## Tick the Test Plan

After the review pass, flip every `## Test plan` checkbox you actually verified from `- [ ] ` to `- [x] ` in the PR body. This keeps the PR description honest about what's been checked instead of leaving stale `[ ]` boxes for items that already passed.

- Only tick items you genuinely confirmed (read the code, ran the check, exercised the flow). Never tick a box you didn't verify.
- Use the canonical pattern from the `pr-test-runner` skill — match the unique trailing text of each item and run `gh pr edit $PR --body-file <new>`. Never edit the wording of a test plan item, only flip its leading `[ ]` to `[x]`.
- Re-fetch the body right before the edit (`gh pr view $PR --json body --jq .body`) to avoid clobbering concurrent edits. If the test plan section has changed under you, abort and tell the user.

## Context

The bot reviewer identity is `Mike Silvis (bot)` with email `msilvis+bot@gmail.com`. All review actions are logged and git-managed through the dotfiles bot configuration.
