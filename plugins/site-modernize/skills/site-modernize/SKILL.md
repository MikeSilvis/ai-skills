---
name: site-modernize
description: Modernize an existing public website into a new static Next.js site from a user-provided template or starter. Crawls the source URL, downloads assets, extracts content, scaffolds the project, and coordinates parallel subagents for generalized modernization tasks. Use when the user says "modernize this site", "rebuild this site", "refresh <url>", "clone <url> as a new site", or provides a website URL and asks for a rewrite.
---

# Site Modernize

Given an existing website URL, produce a modernized static Next.js site using a selected template or starter project. You are the orchestrator: keep the main context small, dispatch generalized worker tasks, and integrate their artifacts.

If subagents are unavailable, run the same task graph yourself and still write the same research/data/design artifacts.

## Inputs

Ask only for missing values:

1. Source URL: the current live website.
2. Output directory: default `<projects-dir>/<slug>` inferred from the URL. Use the user's obvious projects directory when one exists; otherwise use `./<slug>`.
3. Template source: a local path or git URL for the starter project. If missing, first check `SITE_MODERNIZE_TEMPLATE`; otherwise ask for a path or repo URL.
4. Brand preference: default `keep their brand`; alternative `modern refresh`.

Confirm the inferred values in 1-2 sentences. Do not ask for details already discoverable from the site.

## Progressive References

Load these only when the phase needs them:

- `references/template-contract.md`: template stack, scaffold contract, canonical data files, component inventory.
- `references/industry-presets.md`: field-service, health/wellness, retail/auto, and optional module patterns.
- `references/research-and-assets.md`: preflight checks, crawler schema, screenshots, content brief, asset mirroring.
- `references/data-brand-and-design.md`: data-file contracts, localization/style/image rules, `design.md` template.
- `references/seo-validation-deploy.md`: metadata, JSON-LD, grep gates, build validation, GitHub Pages deploy.

Resolve references relative to this `SKILL.md`. If this skill was installed from a Codex plugin, the references are bundled under `skills/site-modernize/references/` inside the plugin.

## Phase Graph

1. Preflight: read `research-and-assets.md`; verify tools and template. Missing `gh` or Playwright does not block the local modernization; use the documented fallback.
2. Scaffold: read `template-contract.md`; copy or clone the selected template source into the output repo, reset generated artifacts, initialize `main`, and create empty stubs for the required data files.
3. Preset decision: read `industry-presets.md`; infer the industry/modules from the source and ask one short confirmation question.
4. Research: discover sitemap/robots, then fan out page crawl batches.
5. Assets/data/brand: run independent workers against the research artifacts.
6. Composition/SEO/design: wire the site, generate `design.md`, and add metadata/schema.
7. QA/deploy: run validation/build, commit, and deploy or print manual deploy steps.

## Generalized Worker Tasks

Spawn workers by generalized task, not by tiny file. Each worker owns a disjoint output surface and writes durable artifacts so the orchestrator reads summaries and paths instead of full scraped content.

| Task | Runs After | Owns | Reads |
|---|---|---|---|
| `research-sitemap` | scaffold | `research/sitemap.json`, `research/robots.txt`, initial `research/content-brief.md` | `research-and-assets.md` |
| `research-crawl:<batch>` | sitemap | `research/pages/*.json`, `research/screenshots/*` for assigned URLs only | `research-and-assets.md` |
| `asset-mirror` | crawl batches | `public/images/**`, asset inventory section in `research/content-brief.md` | `research-and-assets.md` |
| `content-model` | crawl batches | `src/lib/constants.ts`, `src/lib/services-data.ts`, `src/lib/certifications.ts`, `src/lib/page-data.ts` | `data-brand-and-design.md` |
| `brand-system` | crawl batches, asset-mirror | `src/lib/strings.ts`, `src/lib/style.ts`, `src/lib/images.ts`, `src/lib/service-images.ts`, `tailwind.config.ts`, CSS variables | `template-contract.md`, `data-brand-and-design.md` |
| `module:<name>` | preset decision, crawl batches | module-specific files only | `industry-presets.md` plus relevant template project files |
| `ui-composition` | content-model, brand-system, asset-mirror | `src/app/**`, `src/components/**` route/section wiring | `template-contract.md`, `industry-presets.md` |
| `seo-schema` | content-model, brand-system | `metadata`, `src/lib/jsonld.ts`, sitemap/robots, schema components | `seo-validation-deploy.md` |
| `design-doc` | content-model, brand-system, ui-composition | `design.md` | `data-brand-and-design.md`, changed source files |
| `qa-validation` | all implementation tasks | fixes for validation/build/visual QA only | `seo-validation-deploy.md`, project scripts |

Batch crawl URLs in groups of about five pages. Merge or skip tasks when the site is tiny. Serialize workers that need the same dev server, shared generated directories, or the same files.

## Worker Prompt Contract

Every worker prompt must be self-contained and short. Include only paths and task-local facts, not pasted page bodies.

```text
You are one worker in a website modernization. Fix only your task and do not touch unrelated files.

Task: <task-id>
Source URL: <url>
Template source: <absolute path or git URL>
Output repo: <absolute path>
Selected preset/modules: <preset>, <modules or none>
References to read: <relative or absolute reference paths>
Inputs: <artifact paths, assigned URLs, or source files>
Owned files/directories: <write allowlist>
Forbidden files/directories: <write denylist>

Rules:
- Respect robots.txt and do not copy source HTML/CSS.
- Extract real business content. Do not fabricate reviews, certifications, licenses, ratings, prices, addresses, or emergency services.
- Route strings through UI_STRINGS, visual tokens through STYLE, and raster paths through IMAGES.
- Keep outputs terse. Write artifacts/files; do not paste full file contents back.

Acceptance:
- <task-specific checks>

Final response markers:
STATUS=<done|blocked>
CHANGED_FILES=<comma-separated paths or none>
EVIDENCE=<commands, artifact paths, or counts>
BLOCKED=<only when blocked; one sentence>
```

The orchestrator should wait only when the next phase is blocked. While workers run, continue with non-overlapping setup or review artifacts from completed workers.

## Core Rules

- The selected template is the kit. Prefer existing sections/components from the template or selected preset project before creating new UI.
- Every user-facing string, brand token, and raster image path must live in the data/brand files defined in `data-brand-and-design.md`.
- No copied source-site HTML/CSS. Recompose by extracting content and composing template components.
- Respect `robots.txt` and avoid disallowed paths.
- Missing data stays missing: omit it, set feature flags false, or mark it for user review in the handoff.
- Run the grep gates from `seo-validation-deploy.md` before the final commit.
- `pnpm run validate` and `pnpm run build` must pass before any deploy.

## Completion

After validation, commit the generated site in its new repo. Ask before creating a GitHub repo or enabling Pages because those are external side effects. If `gh` is missing or unauthenticated, stop after the successful local build and print the manual deploy steps from `seo-validation-deploy.md`.
