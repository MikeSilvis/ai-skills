---
name: manage-skills
description: Create, edit, or manage Claude/Codex/Cursor AI skills. Use when the user wants to add, update, or remove skills or agent instructions.
---

# Managing AI Skills

Skills live in two places:

- Public, distributable skills live in `~/Development/ai-skills/plugins/<name>/`.
- Personal/private always-on and command skills live in `~/Development/dotfiles/configs/ai/skills/`.

## Two Formats

### Always-on (no frontmatter)

Content is injected into `~/.codex/AGENTS.md`, referenced by `~/.claude/CLAUDE.md`, and emitted to Cursor rules. Use for coding standards, style guides, and rules that should always apply.

```markdown
# Code Style

- Prefer simple, readable code over clever abstractions
- Use descriptive variable and function names
```

### Command skill (YAML frontmatter)

Becomes an invokable `/msilvis:<name>` command in Claude Code, a discoverable Codex skill, and a manual rule in Cursor.

```markdown
---
name: my-skill
description: Short description of when to use this skill.
---

# My Skill

Instructions go here...
```

## Workflow

**Command skills** are symlinked from the dotfiles repo into `~/.claude/commands/msilvis:<name>.md` and `~/.agents/skills/msilvis-<name>/SKILL.md`, and copied into `~/.cursor/rules/<name>.mdc`. Edits to the source file take effect immediately for Claude and Codex after `dotfiles-sync` refreshes the generated links and copies.

Command skills can bundle optional Codex resources in `configs/ai/skills/<name>/` (for example `configs/ai/skills/site-modernize/references/*.md`). `dotfiles-sync` symlinks those resources next to `~/.agents/skills/msilvis-<name>/SKILL.md` so the skill can keep bulky details behind progressive-disclosure references.

**Always-on skills** are merged into `~/.codex/AGENTS.md`, included from `~/.claude/CLAUDE.md`, and emitted to Cursor. After editing, run `dotfiles-sync` to apply changes.

**Important:** Always edit source files in `~/Development/dotfiles/configs/ai/skills/` for private skills or `~/Development/ai-skills/plugins/` for public plugin skills. Never edit `~/.claude/commands/`, `~/.claude/CLAUDE.md`, `~/.agents/skills/`, or `~/.codex/AGENTS.md` directly. Those are generated/symlinked outputs.

All custom skills are prefixed with `msilvis:` (e.g., `/msilvis:my-skill`).

## Distributable Codex Plugins

Reusable skills that should be installable outside this dotfiles repo can live under `plugins/<name>/` with a `.codex-plugin/plugin.json` manifest and a `skills/<name>/SKILL.md` file. Add the plugin to `.agents/plugins/marketplace.json` so another Codex install can add this repo as a plugin marketplace.

If the same skill should remain available through dotfiles-sync, keep `configs/ai/skills/<name>.md` in the dotfiles repo as a symlink to `plugins/<name>/skills/<name>/SKILL.md`, and keep `configs/ai/skills/<name>/` as a symlink to the plugin skill directory so bundled references still sync into `~/.agents/skills/msilvis-<name>/`.

## Guidelines

- Keep skill names lowercase and hyphenated (e.g., `my-skill.md`)
- Write clear descriptions in frontmatter so Claude knows when to invoke the command
- Keep always-on skills concise since they consume context in every conversation
- Prefer command skills for task-specific workflows that don't need to be always active
