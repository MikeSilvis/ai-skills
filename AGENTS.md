# AI Skills Repo

This repo holds the **public** AI assistant skills. Personal/private skills and
always-on policy files live elsewhere and are not part of this checkout.

- Keep skill sources under `skills/`.
- Keep command skill names lowercase and hyphenated.
- Single-file skills: `skills/<name>.md`. Multi-file packages: directory
  `skills/<name>/` next to the entrypoint at `skills/<name>.md`.
- Every skill must have YAML frontmatter with at least `name` and
  `description`.
- Distributable Codex plugins go under `plugins/<name>/` with a
  `.codex-plugin/plugin.json` manifest.
- Don't add personal/always-on policy files (`code-style.md`, `git.md`,
  `tooling.md`, etc.) here. They belong in a private dotfiles repo so they
  don't ship to other users.
