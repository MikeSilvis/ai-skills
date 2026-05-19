# AI Skills

A small library of reusable AI assistant skills for **Codex**, **Claude Code**, and
**Cursor**. Each skill is a single Markdown file with YAML frontmatter that tells
the assistant when to invoke it and what to do.

Skills cover repo workflows (`bug-bash`, `pr-test-runner`, `code-quality`),
framework references (`prisma-cli`, `prisma-client-api`, `react-view-transitions`),
tooling and ops (`coolify`, `signoz-logs`, `circleci-failing-builds`,
`ios-simulator`), and a handful of multi-file packages (`site-modernize`,
`swiftui-expert-skill`).

## Install

Clone the repo somewhere local:

```sh
git clone https://github.com/MikeSilvis/ai-skills.git ~/Development/ai-skills
cd ~/Development/ai-skills
```

Then install whichever skills you want, for whichever assistant you use. The
examples below use `bug-bash`; substitute any name from the [catalog](#catalog).

### Codex

Codex skills live at `~/.codex/skills/<id>/SKILL.md`.

```sh
skill=bug-bash
mkdir -p "$HOME/.codex/skills/$skill"
cp "skills/$skill.md" "$HOME/.codex/skills/$skill/SKILL.md"
```

Some skills ship with companion reference files (e.g. `site-modernize`,
`swiftui-expert-skill`). Install the whole directory so Codex can load the
references progressively:

```sh
skill=site-modernize
mkdir -p "$HOME/.codex/skills/$skill"
cp "skills/$skill.md" "$HOME/.codex/skills/$skill/SKILL.md"
cp -R "skills/$skill/." "$HOME/.codex/skills/$skill/"
```

### Claude Code

Claude Code command skills live in `~/.claude/commands/`.

```sh
skill=bug-bash
mkdir -p "$HOME/.claude/commands"
cp "skills/$skill.md" "$HOME/.claude/commands/$skill.md"
```

Invoke with `/<skill-name>`, e.g. `/bug-bash`.

### Cursor

Cursor rules are project-local. From inside the repo where you want the skill
available:

```sh
skill=bug-bash
mkdir -p .cursor/rules
cp "$HOME/Development/ai-skills/skills/$skill.md" ".cursor/rules/$skill.mdc"
```

### Update later

`git pull` and re-run the same copy command to refresh.

```sh
cd ~/Development/ai-skills && git pull --ff-only
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

## Contributing

- Skill sources live under `skills/`. Names are lowercase and hyphenated.
- Single-file skills are `skills/<name>.md`. Multi-file packages live in
  `skills/<name>/` alongside the entrypoint at `skills/<name>.md`.
- Every command skill must have YAML frontmatter with at least `name` and
  `description` — assistants use the description to decide when to invoke.
- Distributable Codex plugins go under `plugins/<name>/` with a
  `.codex-plugin/plugin.json` manifest. See `plugins/site-modernize/` for the
  shape.
