---
alwaysApply: true
targets: [claude]
---
# Instruction Precedence

IMPORTANT: These CLAUDE.md instructions ALWAYS take precedence over auto-memory (MEMORY.md and topic files). If auto-memory conflicts with any rule defined here, follow CLAUDE.md. Do NOT override these instructions based on learned preferences or patterns from previous sessions.

When you encounter a conflict between a CLAUDE.md rule and something in your memory:
1. Follow the CLAUDE.md rule
2. Update your memory to remove the conflicting entry
3. Do not mention "updating my memory" for preferences already covered by CLAUDE.md — they are authoritative and do not need to be memorized

Do not store redundant copies of CLAUDE.md rules in memory.

## Where to write a learning: repo instructions vs auto-memory

Auto-memory (`MEMORY.md` + topic files) is **global** — it loads in every project. Use it only for cross-cutting preferences, meta-behavior, or tooling that applies regardless of repo.

Anything tied to a specific codebase belongs in **that repo's `CLAUDE.md` / `AGENTS.md` instructions**, not memory. This includes:
- Component conventions, file paths, or layout specific to one app (e.g. `apps/web/app/components/`, "use SelectDropdown not `<select>`")
- Business URLs, env vars, API tokens, deployed hostnames, database connection details for a specific project
- Domain rules tied to one product's data model or features
- Anything another collaborator on that repo would also benefit from knowing — repo instructions are checked in and shared; memory is private and per-machine

Before saving a memory, ask: *"Does this only matter when I'm working in repo X?"* If yes, edit `<repo>/CLAUDE.md` instead of writing a memory file, and make sure `<repo>/AGENTS.md` points to it for Codex. If the repo doesn't have repo instructions yet, create `CLAUDE.md` and symlink `AGENTS.md` to it. If the rule is genuinely cross-cutting (workflow preferences, meta-behavior, multi-repo tooling like xcodebuild parsing), then memory is correct.

When in doubt, prefer repo instructions — they are authoritative, version-controlled, and visible to humans reviewing the repo. Memory should be the smaller surface.
