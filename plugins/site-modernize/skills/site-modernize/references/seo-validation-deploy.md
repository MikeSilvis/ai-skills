# SEO, Validation, And Deploy

## Metadata

Every page exports complete metadata:

- `title`: 50-60 chars, usually `<Page> | <Business>`.
- `description`: 140-160 chars from real page/service content.
- `alternates.canonical`.
- `openGraph`: type, URL, site name, title, description, 1200x630 image.
- `twitter`: `summary_large_image` and image.
- `robots`: `{ index: true, follow: true }`.

Root layout adds:

- `metadataBase: new URL(BUSINESS.url)`.
- icons from `IMAGES`.
- verification codes only when the user provides them.

Per-service pages use `getServiceImage(slug)` for unique OG images.

## JSON-LD

Implement `src/lib/jsonld.ts` plus a small `<JsonLd>` component.

- Root: organization plus local business schema from real NAP/hours/geo/sameAs data.
- Service pages: service, FAQ, and breadcrumb schema.
- Reviews page: review schema for real testimonials only.
- Health preset: use `HealthAndBeautyBusiness`.
- Retail preset: add `Product`/`Offer` for real gift cards, memberships, or catalog items.

Never fabricate `aggregateRating`, `review`, `priceRange`, or license data.

## Routes And Content SEO

- `sitemap.ts` and `robots.ts` enumerate every route and set `export const dynamic = "force-static"`.
- One h1 per page.
- Heading hierarchy does not skip levels.
- Descriptive image alt text.
- No "click here" anchor text.
- Phones use `tel:` and emails use `mailto:`.

## Grep Gates

Run before declaring wiring done and again before the final commit. Fix hits outside allowed files.

```bash
rg -n --type tsx --type ts -g '!src/lib/{strings,style,images,service-images}.ts' \
  -e '>[A-Z][A-Za-z0-9 ,.!?'\''-]{2,}<' \
  -e 'aria-label="[^"]+"' -e 'alt="[^"]+"' -e 'placeholder="[^"]+"' \
  src/

rg -n --type tsx --type ts -g '!src/lib/style.ts' -g '!tailwind.config.ts' \
  -e '#[0-9a-fA-F]{3,8}\b' -e 'hsl\(' -e 'rgb\(' \
  -e 'class(Name)?=".*\[(#|hsl|rgb)' \
  src/

rg -n --type tsx --type ts -g '!src/lib/{images,service-images}.ts' \
  -e '"/images/[^"]+"' -e "'/images/[^']+'" \
  src/
```

## Build Validation

```bash
pnpm install
pnpm run validate
pnpm run build
```

After build, grep `out/` for `og:title`, `og:image`, `twitter:card`, and `application/ld+json`. Every route should have the expected metadata/schema unless intentionally omitted and documented.

Fix validation/build errors before committing.

## Commit

```bash
git add -A
git commit -m "Initial site modernization from <source-url>"
```

This is a fresh generated repo, so the initial commit on `main` is fine.

## GitHub Pages

Ask before creating a GitHub repo or enabling Pages.

1. Confirm `gh auth status`.
2. Create repo: `gh repo create <owner>/<name> --source=. --remote=origin --<public|private> --push`.
3. Enable Pages:

   ```bash
   gh api -X POST repos/<owner>/<name>/pages -f build_type=workflow \
     || gh api -X PUT repos/<owner>/<name>/pages -f build_type=workflow
   ```

4. Keep `.github/workflows/deploy.yml` from the template.
5. If this is a project page, verify `basePath` in `next.config.ts`; leave unset for custom domains or user/org pages.
6. Push if needed: `git push -u origin main`.
7. Watch deploy: `gh run watch` or `gh run list --limit 1`.
8. Report live URL: `gh api repos/<owner>/<name>/pages --jq .html_url`.

Custom domain: write the domain to `public/CNAME`, commit, and print DNS records for the user. Do not configure DNS yourself.

If `gh` is unavailable or unauthenticated, print manual steps: create repo on github.com, add remote, push `main`, enable Pages with GitHub Actions, then submit the sitemap to Search Console and Bing Webmaster.
