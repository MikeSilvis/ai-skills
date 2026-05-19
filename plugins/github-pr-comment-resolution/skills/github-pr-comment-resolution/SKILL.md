---
name: github-pr-comment-resolution
description: Help resolve GitHub pull request review comments using the GitHub CLI (`gh`). Use when the user asks to address, resolve, or summarize PR comments, update code accordingly, and optionally draft or post replies back to GitHub.
---

# GitHub PR Comment Resolution

## Quick Start

When helping with GitHub pull request (PR) comments, follow this workflow:

1. **Identify the PR**
   - If the user provides a PR URL, number, or branch, treat that as the source of truth.
   - **Otherwise, always derive the PR from the current Git branch**: run `gh pr list --head $(git rev-parse --abbrev-ref HEAD) --json number,title,headRefName,state --limit 5` in the repo root to find the open PR for the current branch, and use that PR. Do not ask the user which PR to work on unless this lookup returns no PR or the result is ambiguous (e.g. multiple PRs for the same branch).
   - Only if the current-branch lookup fails or is ambiguous, ask the user which repository and PR to work on.

2. **Inspect PR and comments via `gh` CLI**
   - Use the `gh` command-line tool to interact with GitHub.
   - Make sure `gh` is authenticated for the correct GitHub account and has access to the repository.
   - Use `gh` commands to:
     - Fetch PR metadata (title, author, branch, status), for example with `gh pr view <number> --json ...`.
     - List review comments and discussion threads for the PR, for example with `gh pr view <number> --comments` or `gh api` calls to the relevant review/comment endpoints.
   - Prefer small, focused queries (e.g. targeting a single PR) rather than broad organization-wide listings.

3. **Organize comments**
   - Group comments by:
     - **Status**: open/unresolved vs resolved.
     - **Type**: blocking issues, questions, suggestions/nits.
     - **File and location**: filename and line/range.
   - Prioritize comments that **block merge** or clearly request changes to logic, security, or behavior.

4. **Resolve comments iteratively**
   - For each unresolved comment:
     - **Understand the ask**: restate what the reviewer is requesting (change, explanation, or confirmation).
     - **Locate the code**: open the referenced file and surrounding lines in the local workspace.
     - **Propose a change**:
       - Follow existing project conventions, styles, and rules.
       - Prefer small, focused edits that address exactly what the comment raises.
       - When there are multiple valid options, explain trade-offs briefly and choose one.
     - **Apply the change** using the appropriate editing tools (e.g., `ApplyPatch` in Cursor).
   - When a comment calls for **no code change** (e.g., clarification only), prepare a clear explanation that answers the reviewer's concern.

5. **Validate changes locally**
   - After addressing a batch of comments:
     - Run the project's existing validation commands if known (e.g., lint, tests, typechecks).
     - If commands are not specified, recommend running the project's standard validation (without inventing new scripts).
   - If validation fails, fix issues before marking comments as resolved.

6. **Draft replies and mark resolution**
  - **Always** post a reply for every review comment or thread you address (even for trivial fixes):
    - Confirm what you changed (or why no change was needed).
    - Reference relevant files or functions when helpful.
    - Prefer replying **inline on the original GitHub review comment/thread** so the response appears directly in context.
  - Use `gh` commands to help manage reviews and comments when appropriate. Examples:
    - `gh pr comment <number> --body "<reply>"` to post a comment on the PR.
    - `gh api` calls to review/comment endpoints when you need finer-grained control (for example, posting inline replies tied to specific review comments or creating a review with multiple comments).
  - After you've posted your inline reply and you're confident the requested change has been implemented and validated (or the concern is fully addressed with no further action needed), you should **immediately mark that thread as resolved** via the GitHub UI or appropriate `gh api` calls.

## Comment Classification

When reviewing each PR comment, classify it into one of these categories and respond accordingly:

- **Blocking / must-fix**:
  - Impacts correctness, security, performance, or public API behavior.
  - Always propose and implement a concrete fix before considering the comment resolved.

- **Strong suggestion**:
  - Improves readability, maintainability, or consistency with project standards.
  - Prefer implementing these when they are low-risk and aligned with the project's style.
  - If you choose not to implement, explain why (e.g., conflicts with existing pattern, out of scope).

- **Nit / style**:
  - Minor suggestions (naming, formatting, optional refactors).
  - Apply when they're trivial and match existing code style; otherwise, acknowledge and optionally defer.

- **Questions / clarifications**:
  - Answer directly and, if appropriate, improve code comments or structure so the question is less likely to arise again.
  - If the answer reveals a bug or confusion, treat it as a blocking issue and fix the code.

## Reply Templates

Use these templates when drafting replies to PR comments (adapt tone to match the repository's existing reviews):

- **Change implemented**
  - "Good catch — updated this to `[...]` and added `[...]` to cover the edge case."
  - "Addressed: refactored `[...]` into `[...]` for clarity and to avoid the duplicated logic."

- **Clarification with code change**
  - "You're right that this was hard to follow. I've now `[...]` and added `[...]` so the intent is clearer."

- **Clarification without code change**
  - "Thanks for raising this. The reason we `[...]` here is `[...]`. Given `[...]`, I'd prefer to keep the current behavior, but I'm open to adjusting if you'd like."

- **Deferring non-critical suggestions**
  - "This is a good idea, but it's a bit larger than this PR. I've added it as a follow-up task and would like to keep this change focused."

## Using `gh` CLI Safely

When interacting with GitHub via the `gh` CLI:

- Always:
  - Ensure you are operating in the correct local Git repository and branch for the PR you are working on.
  - Scope `gh` commands to the **target PR** and repository the user is working on (for example, `gh pr view <number>`).
  - Prefer JSON output (`--json` flags) when you need structured data for analysis.
- Prefer:
  - `gh pr view`, `gh pr list`, and related commands when you need to discover or inspect PRs.
  - `gh pr view --comments` and `gh api` for fetching existing review context.
  - `gh pr comment` and `gh api` to create or update reviews/comments when posting replies or submitting reviews.
- Never:
  - Force-push branches unless the user explicitly requests it.
  - Close or merge PRs (for example, `gh pr merge`) unless the user explicitly asks you to.

## Example End-to-End Flow

When the user asks to resolve PR comments (e.g. "help me resolve comments" or "address PR feedback"):

1. **Identify the PR**: If no PR number/URL/branch was given, get the current branch (`git rev-parse --abbrev-ref HEAD`) and run `gh pr list --head <branch> --json number,title` to get the PR for that branch; use that PR number.
2. Use `gh` commands to:
   - Fetch the PR details (`gh pr view <number> --json ...`).
   - Fetch all unresolved comments and threads for that PR (via `gh pr view <number> --comments` or `gh api`).
3. Walk through unresolved comments in priority order:
   - For each, open the referenced file and lines locally.
   - Propose and apply the minimal code change that addresses the request.
4. Run project validation/tests if available.
5. Draft replies for each comment, explaining what changed or why no change was needed.
6. Use GitHub MCP tools to post replies (and, if requested, submit a review) and, where appropriate, mark threads as resolved.
