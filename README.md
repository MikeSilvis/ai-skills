# AI Skills

A plugin marketplace of reusable AI assistant skills for **Claude Code** and
**Codex**. Each skill is a small package with YAML frontmatter that tells the
assistant when to invoke it and what to do.

Skills cover repo workflows (`bug-bash`, `pr-test-runner`, `code-quality`),
framework references (`prisma-cli`, `prisma-client-api`, `react-view-transitions`),
tooling and ops (`coolify`, `signoz-logs`, `circleci-failing-builds`,
`ios-simulator`), and a couple of multi-file packages (`site-modernize`,
`swiftui-expert-skill`).

## Install

### Claude Code

Add the marketplace once, then install whichever skills you want:

```sh
/plugin marketplace add MikeSilvis/ai-skills
/plugin install bug-bash@msilvis-ai-skills
```

Substitute any name from the [catalog](#catalog). Run
`/plugin marketplace update msilvis-ai-skills` later to pull in new or updated
skills.

### Codex

Add the marketplace once:

```sh
codex plugin marketplace add MikeSilvis/ai-skills
```

Then enable plugins from inside Codex (the `/plugin` UI lists everything the
marketplace publishes), or pin them directly in `~/.codex/config.toml`:

```toml
[plugins."bug-bash@msilvis-ai-skills"]
enabled = true
```

`codex plugin marketplace upgrade msilvis-ai-skills` refreshes installed
plugins.

### Cursor

Cursor doesn't have a plugin marketplace yet, so you copy the skill body into
the project's rules directory:

```sh
skill=bug-bash
mkdir -p .cursor/rules
curl -fsSL "https://raw.githubusercontent.com/MikeSilvis/ai-skills/main/plugins/$skill/skills/$skill/SKILL.md" \
  -o ".cursor/rules/$skill.mdc"
```

## Catalog

### Repo & PR workflows

| Skill | Use when you want to… |
| --- | --- |
| `bug-bash` | Dump a batch of bugs/changes and have them grouped into parallel workstreams. |
| `code-quality` | Run a broad review + simplify + fix pass on a repo. |
| `code-quality-ship` | Run the quality pass and auto-merge when CI is green and the change is simple. |
| `github-pr-comment-resolution` | Triage PR review comments, update code, draft/post replies. |
| `pr-test-runner` | Parse a PR `## Test plan` checklist, execute it, fix failures, update the PR. |
| `qa-run` | Run a visual + functional QA pass on a web app, fix issues, open a PR. |
| `repo-setup` | Bootstrap a cloned or new repo for local development. |
| `manage-skills` | Create, edit, or organize Claude/Codex/Cursor skills. |

### Ops, CI, & performance

| Skill | Use when you want to… |
| --- | --- |
| `circleci-failing-builds` | Investigate and fix broken CircleCI jobs. |
| `perf-audit` | Find slow Next.js routes using bundle size, Web Vitals, and SigNoz signals. |
| `signoz-logs` | Query SigNoz logs, traces, and observability data. |
| `coolify` | Drive a Coolify dashboard via Playwright (deploys, status, logs, settings). |
| `coolify-disk-cleanup` | Free disk space on a Coolify server through its web terminal. |
| `ios-simulator` | Build and run the current repo's iOS app on the simulator. |

### Framework & API references

| Skill | Use when you want to… |
| --- | --- |
| `prisma-cli` | Run Prisma CLI commands (init, generate, migrate, db, studio). |
| `prisma-client-api` | Write Prisma Client queries, relations, transactions, raw SQL. |
| `react-view-transitions` | Add Next.js App Router transitions with `next-view-transitions`. |
| `stripe` | Stripe API + dashboard operations via MCP (payments, subscriptions, webhooks). |
| `swiftui-expert-skill` | Write/review SwiftUI code, including performance and `.trace` analysis. |
| `update-swiftui-apis` | Scan Apple docs for deprecated SwiftUI APIs and update the SwiftUI skill. |

### Site generation

| Skill | Use when you want to… |
| --- | --- |
| `site-modernize` | Rebuild an existing public site as a modern static Next.js site from a template. |

## Skill dependencies

Most skills are plain instructions, but some lean on outside tools:

- **GitHub / PR skills** — expect `gh` CLI installed and logged in.
- **`qa-run`, `coolify`, `site-modernize`** — drive a browser via Playwright.
- **`signoz-logs`, `perf-audit`, `stripe`** — expect the matching MCP server.
- **`ios-simulator`, `swiftui-expert-skill`, `update-swiftui-apis`** — require Xcode
  and a usable simulator runtime. `update-swiftui-apis` also needs the Sosumi MCP.
- **`prisma-cli`, `prisma-client-api`** — assume Prisma is installed in your project.

## Repo layout

```
.claude-plugin/marketplace.json    # Claude Code marketplace index
.agents/plugins/marketplace.json   # Codex marketplace index

plugins/<name>/
  .claude-plugin/plugin.json       # Claude Code plugin manifest
  .codex-plugin/plugin.json        # Codex plugin manifest
  skills/<name>/SKILL.md           # canonical skill body
  skills/<name>/references/        # optional supporting docs
  skills/<name>/scripts/           # optional helper scripts
```

## Contributing

- Plugin names are lowercase and hyphenated. The plugin directory name, the
  skill name in its YAML frontmatter, and the entries in both `marketplace.json`
  files must all match.
- To add a new skill: create `plugins/<name>/` with the four files above, then
  add an entry to **both** `.claude-plugin/marketplace.json` and
  `.agents/plugins/marketplace.json` so Claude Code and Codex can both see it.
- Every `SKILL.md` needs YAML frontmatter with at least `name` and
  `description` — the description is the trigger string the assistant uses to
  decide when to invoke the skill, so write it as a sentence about *when* to
  use the skill, not a tagline.
