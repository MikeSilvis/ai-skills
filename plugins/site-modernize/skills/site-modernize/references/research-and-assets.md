# Research And Assets

## Preflight

Check in parallel and report one concise summary table. Ask before installs unless the user already authorized installing missing tools.

| Tool | Check | Install on macOS | Purpose |
|---|---|---|---|
| `node` >=22 | `node -v` | `mise install node@22` | runtime |
| `pnpm` | `pnpm -v` | `corepack enable && corepack prepare pnpm@latest --activate` | package manager |
| `mise` | `mise --version` | `brew install mise` | task runner |
| `git` | `git --version` | `brew install git` | VCS |
| `gh` | `gh --version` and `gh auth status` | `brew install gh`; `gh auth login` is interactive | repo/deploy |
| Browser tools | Playwright/browser MCP available | fall back to `curl` + HTML parsing if absent | crawl/screenshots |
| `curl` | `curl --version` | usually preinstalled | downloads |
| `jq` | `jq --version` | `brew install jq` | JSON shell work |
| ImageMagick | `magick -version` or `convert -version` | `brew install imagemagick` | optional optimization |
| Template | check provided path/git URL, then `SITE_MODERNIZE_TEMPLATE` | ask for template path or repo URL if missing | scaffold |

Resilience:

- Missing or unauthenticated `gh`: complete the local modernization and print manual deploy steps.
- Missing browser automation: use `curl`/raw HTML parsing; skip screenshots and tell the user what is missing.
- Missing `pnpm`: install before proceeding because the template blocks npm.
- Never run `sudo`; print the command for the user instead.

## Crawler Outputs

Respect `robots.txt`. Fetch `/sitemap.xml`; if missing, crawl same-origin homepage links.

Write one JSON file per page:

`research/pages/<slug>.json`

```json
{
  "url": "https://example.com/service",
  "slug": "service",
  "title": "",
  "metaDesc": "",
  "ogTitle": "",
  "ogDesc": "",
  "h1s": [],
  "h2s": [],
  "h3s": [],
  "text": "",
  "images": [{ "src": "", "alt": "" }],
  "links": [{ "href": "", "text": "" }],
  "forms": [{ "action": "", "method": "", "fields": [] }],
  "contacts": { "phones": [], "emails": [] }
}
```

When browser automation exists, also save screenshots:

- `research/screenshots/<slug>-desktop.png` at 1440 px width.
- `research/screenshots/<slug>-mobile.png` at 390 px width.

## Content Brief

Maintain `research/content-brief.md` as the cross-worker handoff. Keep it concise:

- Source URL and crawl date.
- Site map.
- Business info: name, phones, email, address, hours, socials.
- Services, regions/locations, testimonials, certifications/licenses.
- Forms/booking/commerce/social modules detected.
- Brand observations: colors, typography, logo, imagery style.
- Defaults or missing data that require user review.
- Asset inventory counts after mirroring.

## Asset Mirroring

Read every unique `images[].src` from `research/pages/*.json`. Download via `curl` with a normal browser user-agent into `public/images/`.

Folder heuristics:

- `logo/`: filename or alt contains `logo`.
- `team/`: `crew`, `team`, `staff`.
- `certifications/`: `cert`, `badge`, `license`.
- `clients/`: `client`, `partner`.
- `hero/`: `hero`, `banner`.
- `services/`: service-specific filenames or pages.
- `about/`: about/location/interior imagery.
- `gallery/`: fallback.

Preserve original filenames after slugifying/lowercasing. Skip tracking pixels, icons under 32 px, and duplicate content hashes. Report counts per folder plus skipped counts.
