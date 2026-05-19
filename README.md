# Mike Silvis AI Skills

Reusable AI skills for Claude, Codex, and Cursor.

## Layout

- `skills/*.md` is the dotfiles-sync install surface.
- Command skills use YAML frontmatter with `name` and `description`.
- Always-on skills omit command frontmatter, or set `alwaysApply: true`.
- Optional Codex companion resources live in `skills/<name>/`.
- Distributable Codex plugins live in `plugins/<name>/` and are listed from `.agents/plugins/marketplace.json`.

After editing skills, run this from the dotfiles repo:

```sh
dotfiles-sync --only ai-skills --force
```
