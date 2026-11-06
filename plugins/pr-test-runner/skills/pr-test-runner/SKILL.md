---
name: pr-test-runner
description: Run a GitHub PR's test-plan checklist, fix small regressions, and record verified results. Use for "run the test plan", "verify this PR", or "check off the test cases".
---

# PR Test Runner

Execute unchecked items in a PR's test plan against its current code. Preserve the
user's work and the meaning of every assertion. Follow repository instructions for
setup, checks, authentication, worktree isolation, and publishing changes.

## Select the PR and checkout

1. Resolve the supplied PR URL or number, retaining its repository. With no explicit
   target, inspect the current branch's open PR. Ask only if the target is ambiguous.
2. Read the PR body, state, head repository, head branch, and head SHA. A closed PR
   needs a user decision before continuing. Use an existing task worktree when it
   represents that PR; otherwise create an isolated checkout of the exact PR head.
   Never switch a dirty primary checkout or discard someone else's changes.
3. Check authorization before writing to a PR owned by someone else. Read-only
   verification may continue. Never merge, mark ready, or force-push a PR.
4. Parse `## Test plan` case-insensitively. Preserve each item's exact line,
   indentation, occurrence, and parent context. Already checked items stay checked
   and are not rerun unless requested. If there are no unchecked items, report that
   and stop.

## Choose verification surfaces

Classify each item as a browser flow, iOS flow, Android flow, or CLI/code check.
Resolve visual targets from an explicit `(web)`, `(iOS)`, or `(Android)` prefix,
then the repository's documented default (including a `test-runner: default-platform`
comment), then its actual app layout. A multi-platform repo without a clear target
is ambiguous; do not silently substitute a web rendering for a native test.

Discover available tools and read their current instructions before using them:

- **Browser:** use the host's embedded browser and supported inspection tools.
  Do not start a standalone browser or a Playwright MCP server. If the embedded
  browser is unavailable, leave the web item blocked and unchecked and continue
  independent checks. Do not offer a Playwright fallback or ask the user to switch
  browsers; wait for the required browser to become available.
- **iOS/Android:** use the upstream `agent-device` skill and its platform guidance.
  Prefer the connected tools; otherwise inspect the installed CLI help. Keep a
  named session and explicit device identity throughout the run. Do not reproduce
  old control-server commands or assume a particular simulator app exists.
- **CLI:** use the repository's commands, retaining exit codes and bounded logs.

Read the diff before starting expensive infrastructure. For a component's
appearance, use an existing Storybook or minimal harness with the real component,
providers, and fixtures. Use the full app when the test requires integration or
native behavior. An explicitly requested interaction still needs execution even
when the code change is small. If an item is demonstrably inapplicable, explain
why and leave its box unchecked.

## Prepare the environment

Read the target repository's instructions and task definitions for the build,
app identity, development server, and test account. Do not require a row in a
central repository table or invent credentials, device names, or build paths.

For browser flows, reuse this task's verified server or start one in the PR
checkout on an available port. Use the project's supported port argument or
configuration; do not assume every framework honors `PORT`. Verify that the
served code belongs to the PR checkout. A proxy URL is usable only when its
upstream is verified. Never kill another task's server to free a port.

For native flows, select the task's device/session through agent-device, build
from the PR checkout with the repository's documented command, and verify the
build exit status and resulting artifact. Install and launch on that explicit
device. Confirm the app's foreground state with a fresh snapshot. Record the
built SHA, artifact path, app ID, and device ID so a later fix rebuilds the same
app. Never use an unscoped `booted` selector on a shared host.

Preserve authenticated app state. Follow a documented development login or test
account flow when available; let the user complete sign-in when required. Do not
reset a database, reinstall an authenticated app, or erase a device to bypass an
authentication failure. Keep credentials, session URLs, and tokens out of logs,
screenshots, commits, and reports. A missing credential or tool is a reported
blocker, never evidence that the test passed.

Start long-running commands through the host's managed process facility. Retain
session IDs and logs; stop only processes and device sessions owned by this run.
A failed build or server startup fails dependent items. Continue independent ones.

## Execute and fix

Track each item's exact source location, status (`pass`, `fixed`, `fail`, `skip`),
evidence, reason, fix attempts, and any fix commits.

- Browser flows: perform the stated interactions, verify the visible result and
  relevant runtime errors, and capture evidence on failure. Use only inspection
  APIs supported by the current browser tools.
- Native flows: take a fresh snapshot, act on observed elements, and verify the
  resulting state. Refresh references after navigation, rotation, or folding.
  Capture screenshots and relevant app logs when a step fails.
- CLI checks: run the command and evaluate its assertion and exit status. Process
  liveness, a build-success string, and a successful upload are insufficient when
  the item requires an observable result.
- Skips: record the specific ambiguity, missing tool/credential, inapplicability,
  or required human judgment. Leave every skipped box unchecked. An attempted
  assertion failure or broken setup is a failure, not a skip.

For a failure, inspect the evidence before editing. Retry a likely transient
failure once without changes and report a clean retry as such. Fix only small,
local regressions within the requested scope. Do not weaken assertions, change
CI gates, bypass hooks, or modify the test plan to obtain a pass. Allow at most
two fix attempts per item and five across the run; report larger work without
creating issues unless asked.

Before each edit, retain the exact patch and prior contents of files you will
change. Re-run the failed item after the fix, rebuilding/relaunching native code
when necessary and preserving authenticated state. Also run the repository's
required checks before committing and pushing a successful fix to the authorized
PR branch. `fixed` means the rerun passed and the fix was committed and pushed.
A rejected push is unresolved; do not force-push.

If a fix fails or exhausts its budget, undo only this run's verified edits.
Inspect the current diff first; if ownership is uncertain, leave the work intact
and report it. Never use a hard reset or broad checkout to discard failed work.
Continue with the remaining items.

Cap a run at 15 minutes for browser/CLI checks or 30 minutes when native builds
are required. Bound individual browser interactions to two minutes and native
interactions to three minutes. On timeout, stop only the owned operation and
report unfinished items accurately.

## Record verified results

Re-read the PR head and body before writing. If the head changed, stop publication
of the old results until they have been verified against the new head. If the body
changed, preserve the latest body and remap items only when their identities and
assertions are unambiguous; otherwise report the conflict without overwriting it.

Flip only `pass` and `fixed` items from `[ ]` to `[x]`, matching by section and
occurrence rather than replacing every identical string. Preserve other text and
pre-existing checkmarks. Use a structured API argument or a temporary UTF-8 file
with `gh pr edit --body-file`; re-read afterward to verify the intended changes.

When this skill is explicitly invoked, post one concise results comment unless
the user or calling workflow forbids comments. Include pass/fixed/fail/skip counts,
relevant evidence, fix SHAs, and any environment or authentication blockers. Use a
structured argument or `gh pr comment --body-file`; never interpolate multiline
text into shell code. If a caller owns the report, return its requested result
format instead. Finish with the PR/comment link and a short summary of verified
results and remaining failures.
