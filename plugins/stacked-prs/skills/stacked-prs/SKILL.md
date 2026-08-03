---
name: stacked-prs
description: Break a large change into a stack of dependent pull requests using the gh-stack extension, so each layer stays small and independently reviewable. Use when the user says "stack this PR", "split this into stacked PRs", "use stacked PRs", "gh stack", or wants to build a big feature as an ordered chain of small, dependent PRs.
---

# Stacked Pull Requests

A **stack** is a series of pull requests in the same repository where each PR
targets the branch of the PR below it, forming an ordered chain that lands on a
single base branch (`main`). Stacking breaks a large change into small,
independently reviewable layers: the bottom PR holds the foundation, and each
layer above depends only on the layers beneath it.

Use this when a feature is too big for one reviewable PR. Do **not** use it for
small, self-contained changes — a single PR is simpler.

## Prerequisites

Check these before starting; install what's missing:

- **GitHub CLI** ≥ 2.90.0 and **Git** ≥ 2.20, with `gh auth login` done.
- The **gh-stack extension** and its Copilot skill:

  ```shell
  gh extension install github/gh-stack
  gh skill install github/gh-stack
  ```

Verify with `gh stack --help`. If `gh` isn't authenticated or the repo has no
writable GitHub remote, stop and surface that first.

## The gh stack commands

| Command | What it does |
| --- | --- |
| `gh stack init BRANCH-NAME-1` | Create the foundation (bottom) branch of a new stack. |
| `gh stack add BRANCH-NAME-NEXT` | Add a new branch stacked on top of the current one. |
| `gh stack submit` | Open/update the PRs for every branch in the stack, each targeting the branch below. |
| `gh stack rebase --upstack` | Propagate a fix on the current branch upward to every branch above it. |
| `gh stack checkout BRANCH-NAME` | Switch to a branch in the stack. |
| `gh stack up` / `gh stack down` | Move one branch up or down the stack. |

## Workflow

Follow these steps in order. Do the design work **before** writing code — an
error in a low layer propagates through the whole stack.

### 1. Design the layers first

Plan the feature as dependent layers, foundation first. Each layer must be a
single coherent change, small enough to review quickly, and depend only on
layers below it — never above.

Example (auth feature): data model + migration → CRUD endpoints → middleware →
tests.

Copilot prompts that help here:
- `"Propose a layered approach to add user authentication to this app. Order the layers by dependency, keeping each layer independently reviewable."`
- `"Review my planned layers and flag any that are too large or that depend on a branch above them."`

### 2. Build the foundation layer

Create the bottom branch (`gh stack init BRANCH-NAME-1`) and build **only** that
layer. Review it thoroughly — everything above inherits its mistakes.

- `"Start the pr-stack and build only the first layer: the user data model and migration."`
- `"Conduct a review of the generated code and confirm this branch contains only the data model and migration, and nothing that belongs in a later layer."`

### 3. Stack additional layers

Add each subsequent layer on its own branch with `gh stack add BRANCH-NAME-NEXT`,
building one focused layer at a time. If a branch grows too big, split it.

- `"Add the next layer in a new branch on top: the CRUD endpoints that use the user model from the branch below."`
- `"This branch is getting large. Suggest how it could be split into two independently reviewable layers."`

### 4. Self-review every layer

On each branch, run tests, linters, and code scanning before asking teammates to
review. Every layer must meet project standards on its own.

### 5. Submit and request reviews bottom-up

Run `gh stack submit` to open/update all the PRs. Request reviews starting at the
foundation — independent layers can be reviewed in parallel, tightly coupled
ones sequentially.

### 6. Iterate on feedback in the right layer

Fix each review comment on the layer it belongs to, then push the fix upward:

```shell
gh stack rebase --upstack
```

- `"A reviewer flagged that the auth service doesn't handle expired tokens. Fix that on BRANCH-NAME and test the changes."`
- `"I've rebased the layers above onto this fix. Check that the branch with endpoints still works with the change and flag anything that needs updating."`

### 7. Merge bottom-up

Merge from the foundation upward, or enable auto-merge so each PR lands as it's
approved. GitHub automatically re-targets each subsequent PR to `main` as the one
below it merges.

## Guardrails

- Keep each change in its proper layer. A fix that belongs in layer 1 must not be
  smuggled into layer 3.
- Never let a lower layer depend on a higher one — that breaks the chain.
- Rebase to integrate upstream changes (`gh stack rebase --upstack`); don't merge
  `main` into stack branches.
