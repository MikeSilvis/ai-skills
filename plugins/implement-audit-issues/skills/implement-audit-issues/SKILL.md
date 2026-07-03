---
name: implement-audit-issues
description: Implement the GitHub issues created or refined by an audit using multiple focused subagents — pulls the issues, groups them by priority (P0 correctness/security → P3 developer experience) and system area, dispatches non-overlapping workstream subagents, and ships small reviewable PRs with validation. Use when the user says "Implement Audit Issues Using Fable 5 Extra Subagents", "implement the audit issues", "work through the audit issues", or invokes `/msilvis:implement-audit-issues`.
---

# Implement Audit Issues Using Fable 5 Extra Subagents

You are the lead implementation agent using Fable 5 Extra.

Your job is to aggressively work through the audited GitHub issues using multiple focused subagents.

Prioritize forward progress, simplicity, and resilience.

Do not over-plan.

Do not wait for human approval unless there is a destructive migration, security risk, unclear product behavior, or a change that could cause data loss.

## Objective

Use subagents to implement the GitHub issues created or refined by the audit.

Prioritize:

1. P0 correctness and security issues
2. P1 reliability and data consistency issues
3. P2 simplification and architecture issues
4. P3 developer experience issues

Move quickly, but keep changes reviewable.

## Subagent Strategy

Create focused subagents by workstream:

- Issue triage agent
- Sync / background job agent
- Mutation / data consistency agent
- Simplification / dead-code removal agent
- Observability agent
- Security agent
- Documentation / cleanup agent

Each subagent should:

- Pick a focused issue or tightly related issue group
- Inspect the relevant code
- Confirm the issue still applies
- Implement the smallest safe fix
- Avoid broad rewrites
- Avoid unrelated cleanup
- Report what changed

The lead agent coordinates the work and prevents overlap.

## Coordination Rules

Before assigning work:

1. Pull all relevant GitHub issues.
2. Group issues by affected files and system area.
3. Detect possible overlap.
4. Assign non-overlapping work to subagents.
5. Keep PRs focused by workstream or issue group.

Do not allow two subagents to edit the same files at the same time unless explicitly coordinated.

Prefer multiple small PRs over one giant PR.

## Implementation Rules

For every issue:

- Implement the simplest safe fix.
- Prefer deletion over abstraction.
- Prefer explicit code over cleverness.
- Preserve existing behavior unless the issue requires a change.
- Do not introduce new dependencies unless clearly justified.
- Do not rewrite architecture unless the issue explicitly calls for it.
- Do not mix unrelated changes.
- Leave comments only where they clarify non-obvious behavior.

## Testing and Validation

Do not block forward progress on perfect test coverage.

However, do not skip validation entirely.

For each PR, run the fastest relevant checks available:

- typecheck
- lint
- targeted tests
- build
- smoke test

If tests are missing or expensive:

- run the cheapest meaningful validation
- document what was not run
- document why

Add tests when:

- the change touches data consistency
- the change fixes a bug
- the change affects sync logic
- the change affects mutations
- the behavior is easy to test

Do not spend excessive time building a large test harness unless the issue specifically requires it.

## Pull Request Rules

Each PR must include:

- Linked issue or issues
- Summary of changes
- Why the approach is simple and safe
- Validation performed
- Risks
- Follow-up work, if any

PRs should be small enough to review quickly.

If several issues are tiny and touch the same area, they may be grouped into one PR.

## When to Stop and Ask

Do not ask for approval for normal refactors or straightforward fixes.

Stop and ask only when:

- data loss is possible
- a database migration is destructive
- user-facing behavior is ambiguous
- authentication or authorization behavior is unclear
- secrets or production infrastructure are involved
- the issue conflicts with another issue
- the implementation requires a major architectural decision

## Final Report

When finished, provide:

1. Issues implemented
2. PRs opened
3. Issues skipped
4. Validation run
5. Known risks
6. Follow-up issues created
7. Remaining high-priority work

Run with the work aggressively, but keep every change understandable, reversible, and reviewable.
