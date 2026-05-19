# AI Skills

Reusable AI assistant skills for Codex, Claude Code, and Cursor.

This repo is meant to be useful on its own. You can install one skill by copying
a file, install a bundled Codex plugin, or let `dotfiles-sync` manage everything
for Mike's local setup.

## Quick Start

Clone the repo:

```sh
git clone https://github.com/MikeSilvis/ai-skills.git ~/Development/ai-skills
cd ~/Development/ai-skills
```

Pick a skill from the catalog below, then install it for the assistant you use.
These examples install `bug-bash`; replace that name with any command skill.

### Codex

Codex skills live in `~/.codex/skills/<skill-id>/SKILL.md`.

```sh
skill=bug-bash
mkdir -p "$HOME/.codex/skills/msilvis-$skill"
cp "skills/$skill.md" "$HOME/.codex/skills/msilvis-$skill/SKILL.md"
```

Some skills include companion files. Install those as a directory so Codex can
load the extra references progressively:

```sh
mkdir -p "$HOME/.codex/skills/msilvis-site-modernize"
cp -R "plugins/site-modernize/skills/site-modernize/." \
  "$HOME/.codex/skills/msilvis-site-modernize/"
```

### Claude Code

Claude Code command skills live in `~/.claude/commands/`.

```sh
skill=bug-bash
mkdir -p "$HOME/.claude/commands"
cp "skills/$skill.md" "$HOME/.claude/commands/msilvis:$skill.md"
```

Then invoke it as:

```text
/msilvis:bug-bash
```

### Cursor

Cursor rules are project-local. Copy a skill into the repo where you want Cursor
to use it:

```sh
skill=bug-bash
mkdir -p .cursor/rules
cp "$HOME/Development/ai-skills/skills/$skill.md" \
  ".cursor/rules/msilvis-$skill.mdc"
```

## Install More Than One

For Codex command skills, you can install a small set at once:

```sh
for skill in bug-bash code-quality pr-test-runner qa-run repo-setup; do
  mkdir -p "$HOME/.codex/skills/msilvis-$skill"
  cp "skills/$skill.md" "$HOME/.codex/skills/msilvis-$skill/SKILL.md"
done
```

Use the same loop shape for Claude Code by copying into
`~/.claude/commands/msilvis:<name>.md`.

To update an installed skill later, pull the repo and rerun the same copy
command:

```sh
cd ~/Development/ai-skills
git pull --ff-only
```

## Skill Catalog

### Repo and PR Workflows

| Skill | Use it when you want to... |
| --- | --- |
| `bug-bash` | Dump a batch of bugs or changes and have them grouped into parallel workstreams. |
| `code-quality` | Run a broad quality pass that reviews, simplifies, fixes, and validates a repo. |
| `code-quality-ship` | Run the quality pass and, when safe, ship a simple PR end to end. |
| `github-pr-comment-resolution` | Triage GitHub review comments, update code, and draft or post replies. |
| `pr-test-runner` | Parse a PR test-plan checklist, execute it, fix failures, and update the PR. |
| `qa-run` | Run a visual and functional QA pass for a web app, then fix and verify issues. |
| `repo-setup` | Bootstrap a cloned or new repo for local development. |
| `manage-skills` | Create, edit, or organize Claude/Codex/Cursor skills. |

### Performance, CI, and Operations

| Skill | Use it when you want to... |
| --- | --- |
| `circleci-failing-builds` | Investigate and fix broken CircleCI jobs. |
| `perf-audit` | Find slow Next.js routes using bundle, Web Vitals, and SigNoz signals. |
| `signoz-logs` | Query SigNoz logs, traces, and observability data. |
| `coolify` | Manage deployments, services, logs, and settings in Coolify. |
| `coolify-disk-cleanup` | Free space on a Coolify server through the web terminal. |
| `ios-simulator` | Build, install, and run an iOS app in the simulator. |

### Framework and API References

| Skill | Use it when you want to... |
| --- | --- |
| `prisma-cli` | Run Prisma CLI commands for setup, generate, migrate, db, and Studio tasks. |
| `prisma-client-api` | Write Prisma Client queries, filters, relations, transactions, and raw SQL. |
| `react-view-transitions` | Add Next.js App Router transitions with `next-view-transitions`. |
| `stripe` | Work with Stripe payments, customers, subscriptions, invoices, products, and webhooks. |

### Site Generation and Personal Workflows

| Skill | Use it when you want to... |
| --- | --- |
| `site-modernize` | Rebuild an existing public website as a modern static Next.js site from a template. |
| `smart-calendar-assistant` | Scan messages and email for plans, then create calendar events. |
| `tax-summary` | Scan year-organized tax PDFs and generate or update an earnings/taxes CSV. |

## Policy and Always-On Files

Not every file in `skills/` is a command skill. These files are reusable policy
or baseline instructions that you can paste into an assistant instructions file
when you want to adopt the behavior globally:

| File | Purpose |
| --- | --- |
| `00-precedence.md` | Instruction precedence rules for Claude-style agents. |
| `bot-automation.md` | Bot-mode automation rules and daily task references. |
| `bot-code-review.md` | Review posture for bot-authored PR feedback. |
| `code-style.md` | General coding style preferences. |
| `git.md` | Shared git workflow rules. |
| `git-claude.md` | Claude Code-specific worktree and cleanup workflow. |
| `git-codex.md` | Codex-specific worktree, cleanup, PR, and branch workflow. |
| `testing.md` | Testing principles. |
| `tooling.md` | Shared project tooling conventions. |

Install policy files carefully. They are intentionally opinionated and can change
how an assistant behaves in every repo.

## Skill Dependencies

Most skills are plain instructions, but some expect outside tools or accounts:

- GitHub and PR skills usually expect the `gh` CLI to be installed and logged in.
- Browser, QA, Coolify, and site modernization workflows may use Playwright or a
  local browser.
- SigNoz, Stripe, Gmail, calendar, and message-related skills expect the matching
  MCP tool, connector, or account access to be available in your assistant.
- iOS simulator workflows require Xcode and a usable simulator runtime.

## Codex Plugin

This repo also publishes a distributable Codex plugin:

| Plugin | Path | Includes |
| --- | --- | --- |
| `site-modernize` | `plugins/site-modernize` | The `site-modernize` skill plus reference docs for crawling, data modeling, SEO, design, and validation. |

The plugin is listed in `.agents/plugins/marketplace.json` for Codex clients that
support local plugin marketplaces. If you do not use Codex plugins, install the
same skill manually from `plugins/site-modernize/skills/site-modernize/` as shown
in the Codex quick start.

## Using dotfiles-sync

Mike's dotfiles workflow still works, but it is optional.

From the dotfiles repo:

```sh
cd ~/Development/dotfiles
dotfiles-sync --only ai-skills --force
```

That workflow:

- symlinks command skills into Claude Code and Codex;
- bundles Codex companion resources next to `SKILL.md`;
- emits Cursor rules;
- merges always-on policy files into generated assistant instructions.

Everyone else can ignore `dotfiles-sync` and use the manual install steps above.

## Repo Layout

```text
skills/
  *.md                       Command skills and reusable policy files.
  site-modernize             Symlink to the plugin skill directory.
  site-modernize.md          Symlink to the plugin skill entrypoint.

plugins/
  site-modernize/
    .codex-plugin/plugin.json
    skills/site-modernize/
      SKILL.md
      references/*.md

.agents/plugins/marketplace.json
```

## Adding or Updating Skills

- Keep skill sources under `skills/`.
- Keep command skill names lowercase and hyphenated.
- Use YAML frontmatter with `name` and `description` for command skills.
- Keep large supporting material in `skills/<name>/` or a plugin skill directory
  so assistants can load it only when needed.
- Put distributable Codex plugins under `plugins/<name>/` with a
  `.codex-plugin/plugin.json` manifest.
- If a plugin skill should also be available as a normal command skill, mirror it
  from `skills/<name>.md` and `skills/<name>/`.
