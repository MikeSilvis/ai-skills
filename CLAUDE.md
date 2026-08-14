# AI Skills Repo

This repo holds the **public** AI assistant skills, packaged as a plugin
marketplace usable by both **Claude Code** and **Codex**. Personal/private
skills and always-on policy files live elsewhere and are not part of this
checkout.

## Layout

```
.claude-plugin/marketplace.json     # Claude Code marketplace index
.agents/plugins/marketplace.json    # Codex marketplace index

plugins/<name>/
  .claude-plugin/plugin.json        # Claude Code plugin manifest
  .codex-plugin/plugin.json         # Codex plugin manifest
  skills/<name>/SKILL.md            # canonical skill body (YAML frontmatter + markdown)
  skills/<name>/references/         # optional reference files for multi-file skills
  skills/<name>/scripts/            # optional helper scripts
```

## Conventions

- One plugin per skill. Plugin name = skill name = directory name. Lowercase
  hyphenated.
- Every `SKILL.md` must have YAML frontmatter with at least `name` and
  `description`. The description is what the assistant uses to decide when to
  invoke the skill — write it as a trigger sentence, not a tagline.
- When you add or rename a skill, update **both** marketplace files
  (`.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`)
  so the plugin shows up in each assistant's install flow.
- Don't add personal/always-on policy files (`code-style.md`, `git.md`,
  `tooling.md`, etc.) here. They belong in a private dotfiles repo so they
  don't ship to other users.
