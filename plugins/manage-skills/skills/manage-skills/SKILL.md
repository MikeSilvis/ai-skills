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

Content is written to `~/.codex/AGENTS.md` and `~/.claude/CLAUDE.md`, and emitted to the dotfiles-managed Cursor local plugin under `rules/`. Use for coding standards, style guides, and rules that should always apply.

```markdown
# Code Style

- Prefer simple, readable code over clever abstractions
- Use descriptive variable and function names
```

### Command skill (YAML frontmatter)

Becomes a native skill in Claude Code, Codex, and Cursor.

```markdown
---
name: my-skill
description: Short description of when to use this skill.
---

# My Skill

Instructions go here...
```

## Workflow

**Command skills** are symlinked from the dotfiles repo into each assistant's native skill directory, using the frontmatter `name` as the directory name:

- `~/.claude/skills/<frontmatter-name>/SKILL.md`
- `~/.agents/skills/<frontmatter-name>/SKILL.md`
- `~/.cursor/plugins/local/dotfiles-ai/skills/<frontmatter-name>/SKILL.md`

After `dotfiles-sync` creates or refreshes these links, edits to the source file take effect immediately in all three assistants.

Command skills can bundle optional resources in `configs/ai/skills/<name>/` (for example `configs/ai/skills/site-modernize/references/*.md`). `dotfiles-sync` symlinks those resources next to `SKILL.md` in all three native skill directories so the skill can keep bulky details behind progressive-disclosure references.

**Always-on skills** are merged into `~/.codex/AGENTS.md` and `~/.claude/CLAUDE.md`, and emitted to `~/.cursor/plugins/local/dotfiles-ai/rules/`. After editing, run `dotfiles-sync` to apply changes.

**Important:** Always edit source files in `~/Development/dotfiles/configs/ai/skills/` for private skills or `~/Development/ai-skills/plugins/` for public plugin skills. Never edit `~/.claude/skills/`, `~/.claude/CLAUDE.md`, `~/.agents/skills/`, `~/.codex/AGENTS.md`, or `~/.cursor/plugins/local/dotfiles-ai/` directly. Those are generated/symlinked outputs.

Private skill frontmatter names are prefixed with `msilvis-` (for example, `msilvis-my-skill`).

## Distributable Codex Plugins

Reusable skills that should be installable outside this dotfiles repo can live under `plugins/<name>/` with a `.codex-plugin/plugin.json` manifest and a `skills/<name>/SKILL.md` file. Add the plugin to `.agents/plugins/marketplace.json` so another Codex install can add this repo as a plugin marketplace.

If the same skill should remain available through dotfiles-sync, keep `configs/ai/skills/<name>.md` in the dotfiles repo as a symlink to `plugins/<name>/skills/<name>/SKILL.md`, and keep `configs/ai/skills/<name>/` as a symlink to the plugin skill directory so bundled references still sync into `~/.agents/skills/msilvis-<name>/`.

## Guidelines

- Keep skill names lowercase and hyphenated (e.g., `my-skill.md`)
- Write clear descriptions in frontmatter so Claude knows when to invoke the command
- Keep always-on skills concise since they consume context in every conversation
- Prefer command skills for task-specific workflows that don't need to be always active
