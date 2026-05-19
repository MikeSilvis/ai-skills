# Data, Brand, And Design Contract

## Data Files

Generate from `research/content-brief.md` and relevant page JSON. Omit unverifiable business claims.

- `src/lib/constants.ts`: `BUSINESS` name, phones, email, address, hours, social URLs, canonical URL; `REGIONS`; `NAV_LINKS`; `TESTIMONIALS` from real reviews only; `CREDENTIALS`.
- `src/lib/services-data.ts`: one `SERVICES` entry per real service with slug, title, tagline, description, lucide icon, hero gradient token, emergency flag, six benefits when supported, and 3-4 FAQs from source or neutral service facts.
- `src/lib/certifications.ts`: `CERTIFICATIONS`, `CLIENT_LOGOS`, `RECENT_JOB_MAPS`; omit empty sections.
- `src/lib/page-data.ts`: structured page copy such as `HOME_PAGE`, emergency copy, specials, and first-visit content.
- `src/lib/strings.ts`: `UI_STRINGS` for every non-data literal in components. Namespace by section/component. Keep values plain strings; export `Strings`. Default locale is `en-US`; structure should support `strings.<locale>.ts`.
- `src/lib/style.ts`: `STYLE` tokens for colors, spacing, radii, shadows, gradients, font families, motion. Use HSL triplets and sampled brand colors; Tailwind reads from this file.
- `src/lib/images.ts`: `IMAGES` logo, favicon, default OG, hero images, placeholders, decorative paths, and `IMAGES.services` re-export.
- `src/lib/service-images.ts`: service slug to hero image path.

Rules:

- If the source lacks an emergency number, set the emergency flag false or omit the section.
- Never invent reviews, ratings, certifications, licenses, prices, memberships, locations, or guarantees.
- Neutral UI labels are allowed when the source lacks chrome copy; flag defaults in the handoff.

## Constants Over Literals

This is non-negotiable:

- Strings: no user-facing text literal lives in a `.tsx` component. Alt text, aria labels, placeholders, headings, buttons, errors, and empty/loading states all resolve through `UI_STRINGS` or structured data.
- Style: no raw hex, raw HSL/RGB, arbitrary color utilities, or inline spacing/radii/shadow values in components. Change `STYLE` and let Tailwind/CSS variables consume it.
- Images: no literal `/images/...` in components or metadata. Raster references go through `IMAGES` or `IMAGES.services`.

Use direct `UI_STRINGS` reads or a tiny typed `t()` helper consistently. Do not add a runtime i18n library unless the user asks.

## Brand Application

Brand flows through `src/lib/style.ts` to Tailwind config and a thin `src/app/globals.css` emitting CSS variables. Keep Fraunces + Inter unless the source has distinctive typography; if it does, swap tokens in `STYLE.fontFamily`, not individual components.

## `design.md`

Every modernization ships `design.md` at repo root. Generate it from populated source-of-truth files; do not hand-write values that disagree with code. Keep it under about 250 lines.

```markdown
# <Business Name> - Design System

## Brand
- **Voice & tone** - 2-3 sentences extracted from source copy.
- **Palette** - table of every STYLE.colors entry: token, HSL, swatch usage.
- **Typography** - display/body families, scale, and where defined.
- **Spacing & radii** - token to px values.
- **Motion** - STYLE.motion durations/easings and usage.
- **Shadows & gradients** - token and usage notes.

## Constants & Localization
- **`src/lib/strings.ts`** - every UI string. Add a locale by copying to `strings.<locale>.ts`.
- **`src/lib/style.ts`** - every visual token. Rebrand by editing this file.
- **`src/lib/images.ts`** - every image path. Asset swap by editing this manifest.
- **`src/lib/constants.ts` / `services-data.ts` / `certifications.ts` / `page-data.ts`** - structured business data.

## Components in use
List every template/preset component used and the sections/routes using it.

## Page map
Route -> primary sections -> data sources.

## Accessibility
- Heading hierarchy rules followed.
- Alt text sources from UI_STRINGS or IMAGES alt fields.
- Color contrast verified for primary text on every background token.

## Source provenance
- Source URL crawled: `<url>`
- Crawl date: `<date>`
- Pages extracted: `<n>`
- Brand colors sampled from: `<selectors>`
- Defaults chosen because source data was missing.
```

If `style.ts`, `strings.ts`, or `images.ts` changes after generation, regenerate `design.md`.
