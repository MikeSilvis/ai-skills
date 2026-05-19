# Template Contract

The selected template source is the canonical source for the generated site. Use its structure and components before inventing new ones. If the template has different names than the inventory below, map to the closest equivalent and document the mapping in `design.md`.

## Stack

- Next.js App Router with `output: "export"` for static deploys.
- React, TypeScript strict, Tailwind, and reusable section components.
- Prefer existing animation, carousel, icon, and UI libraries already in the template.
- Keep the template's default font system unless the source site has distinctive typography worth carrying forward.

## Scaffold

Create the output repo before crawling so research artifacts land with the generated project:

```bash
template_source="<template-source>"
output_dir="<output-dir>"

if [ -d "$template_source" ]; then
  mkdir -p "$output_dir"
  rsync -a --exclude .git --exclude node_modules --exclude .next --exclude out \
    "$template_source"/ "$output_dir"/
else
  git clone --depth 1 "$template_source" "$output_dir"
fi

cd <output-dir>
rm -rf .git node_modules .next out public/images/* research/*
git init && git checkout -b main
```

Update `package.json` `name`. Reset or create these files with empty typed exports matching the template interfaces:

- `src/lib/constants.ts`
- `src/lib/services-data.ts`
- `src/lib/certifications.ts`
- `src/lib/page-data.ts`
- `src/lib/strings.ts`
- `src/lib/style.ts`
- `src/lib/images.ts`
- `src/lib/jsonld.ts`
- `src/lib/service-images.ts`

## Data Architecture

The site must be data-driven:

- `constants.ts`: `BUSINESS`, `REGIONS`, `NAV_LINKS`, `TESTIMONIALS`, `CREDENTIALS`.
- `services-data.ts`: `SERVICES` entries with slug, title, tagline, description, icon, benefits, FAQs, emergency flag.
- `certifications.ts`: `CERTIFICATIONS`, `CLIENT_LOGOS`, `RECENT_JOB_MAPS`.
- `page-data.ts`: structured page copy such as `HOME_PAGE`.
- `strings.ts`: `UI_STRINGS` for chrome copy, alt text, aria labels, placeholders, empty/error/loading states; export `Strings`.
- `style.ts`: `STYLE` colors, spacing, radii, shadows, gradients, typography, motion; Tailwind reads from it.
- `images.ts`: `IMAGES` manifest for logos, favicon, OG images, heroes, placeholders, decorative assets; re-export `IMAGES.services`.
- `jsonld.ts`: schema builders.
- `service-images.ts`: service slug to hero image.

## Component Inventory

Reusable sections:

| Component | Purpose | Data source |
|---|---|---|
| `HeroSection` | Image/video hero with dual CTA | `HOME_PAGE`, `BUSINESS` |
| `ServiceHero` | Service-page hero with icon | `ServiceData` |
| `PageHero` | Generic page hero | props |
| `ServicesOverview` | Service-card grid | `SERVICES` |
| `FieldGallery` | Photo grid | images prop |
| `CertificationsGrid` | Badge/count grid | `CERTIFICATIONS` |
| `ServiceAreas` | Region cards | `REGIONS` |
| `ServiceCoverageMap` | Static/embedded map | `REGIONS`, `RECENT_JOB_MAPS` |
| `TrustedClientsStrip` | Client logo strip | `CLIENT_LOGOS` |
| `TestimonialsCarousel` | Review carousel | `TESTIMONIALS` |
| `CredentialsStrip` | Credential grid | `CREDENTIALS` |
| `CTASection` | Generic CTA | `UI_STRINGS.cta`, `BUSINESS` |
| `EmergencyCTA` | Urgent CTA | `UI_STRINGS.emergency`, `HOME_PAGE`, emergency phone |
| `ServiceCTA` | Per-service CTA | `UI_STRINGS.cta`, service title |
| `FAQSection` | Accordion FAQ | `UI_STRINGS.faq`, FAQs |
| `ServiceBenefits` | Benefits checklist | service benefits |
| `Header`, `Footer`, `EmergencyBar` | Layout chrome | `UI_STRINGS`, `BUSINESS`, `IMAGES.logo` |
| `AnimatedSection`, `SectionHeading`, `Container`, `ServiceCard`, `TestimonialCard` | Primitives | props plus `STYLE` |

Default routes usually include `/`, `/services/[slug]`, `/about`, `/contact`, `/reviews`, and `/service-areas`. Remove unused routes and reorder homepage sections to match the source site's emphasis.
