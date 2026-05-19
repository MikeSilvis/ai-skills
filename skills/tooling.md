# Shared Tooling

These conventions apply across all projects in this workspace:

## Task Runner
- mise is the universal task runner across all projects — always prefer `mise run <task>` over `pnpm run <task>`
- Standard tasks available in every project: `dev`, `build`, `lint`, `lint:fix`, `format`, `typecheck`, `test`, `validate`, `record`
- mise tasks are thin wrappers around pnpm scripts — the underlying implementation varies per project but the interface is consistent
- Project-specific tasks (e.g. `ios:build`, `ios:ship`) are also available via mise in relevant projects

## Package Manager
- pnpm is the package manager, enforced via `npx only-allow pnpm` in preinstall
- pnpm version is pinned in both `package.json` (packageManager field) and `.mise.toml`

## Tool Versioning
- mise manages tool versions (node, pnpm, ruby, etc.)
- Node version is always 22
- Run `mise install` after cloning any project

## Code Formatting
- Prettier with: semi, singleQuote, tabWidth: 2, trailingComma: all, printWidth: 100
- These settings are identical across all projects — do not deviate

## Linting
- ESLint with flat config format (eslint.config.mjs)
- TypeScript ESLint with strict rules: no-explicit-any: error
- Prettier integration via eslint-plugin-prettier
- no-unused-vars: warn with ^_ ignore pattern

## Type Checking
- TypeScript strict mode is always enabled
- All projects use strict: true in tsconfig.json

## Code Quality
- Knip detects unused exports (rules: exports: error, types: error)
- Lefthook runs pre-commit hooks (prettier + validate)

## Standard Scripts
Every JS/TS project root should have these npm scripts:
- `dev` — start development
- `build` — production build
- `lint` / `lint:fix` — run/fix linting
- `format` / `format:check` — run/check formatting
- `typecheck` — run TypeScript type checking
- `test` / `test:watch` — run tests
- `find-unused` — run knip
- `validate` — full validation (lint + typecheck + find-unused)
- `prepare` — install lefthook
