# Industry Presets

Infer the source site's industry before implementation. Ask one short confirmation question:

`Looks like a <industry> site. I'll use the <preset> preset and include <detected modules>. Confirm or adjust?`

Preset source rules:

- Use the selected base template unless the user provides a specialized template.
- Optional specialized templates can be provided with environment variables such as `SITE_MODERNIZE_FIELD_SERVICE_TEMPLATE`, `SITE_MODERNIZE_HEALTH_TEMPLATE`, or `SITE_MODERNIZE_RETAIL_TEMPLATE`.
- If a specialized template is missing, adapt the selected base template and create only the components needed for the detected modules.

## Field Service / Trades

Use for tree care, HVAC, plumbing, landscaping, electrical, roofing, pest control, and similar service businesses.

Pull or keep:

- `CertificationsGrid`, `CredentialsStrip`, `ServiceCoverageMap`, `EmergencyCTA`, `TrustedClientsStrip`.
- `certifications.ts`, `REGIONS` with emergency phones when present.
- `LocalBusiness` schema.

## Health & Wellness

Use for spas, massage, chiropractors, salt therapy, salons, wellness clinics, and medical practices.

Pull when relevant:

- `src/components/chat/*`: `ChatWidget`, `ChatPanel`, `ChatBubble`, `RecommendationCard`.
- `InstagramFeed` plus `scripts/update-instagram.mjs` for cached static Instagram JSON.
- `VideoSection`, `YouTubeSection`, `TherapistBio`, `BenefitGrid`, `SafetySection`, `GlobalAddOns`, `LocationHours`, `AwardsBar`.
- `src/lib/booking.ts`, generalized for Mangomint, Acuity, Calendly, Square Appointments, or similar providers.
- `src/lib/chat-flow.ts`, `src/lib/pricing.ts`, `src/lib/popup-config.ts`.
- `src/lib/page-data.ts` patterns for specials and first-visit experience.

Schema: `HealthAndBeautyBusiness` with `geo`, `founder`, real `aggregateRating`, `review[]`, and `priceRange` only when scraped or provided. Use `src/lib/seo.ts` in `simply-health` as reference.

## Retail / Auto

Use for car wash, detailing, auto services, retail, memberships, clubs, and multi-location businesses.

Pull when relevant:

- `PricingCard`, `CategoryTabs`, `StickyTabBar`, `ServicePageNav`, `LocationCard`, `GiftCardVisual`, `PremiumDetailingCards`, `ExpressDetailingCards`, `AnimatedLogo`, `StaticLogo`.
- `src/lib/pricing.ts` patterns for single purchase plus monthly/member pricing.
- `/app/locations/` and `LocationCard` for multi-location pages.
- `src/lib/logo-paths.ts` for traced animated logo paths; regenerate with the potrace pipeline, do not hand-edit.
- Square catalog rendering/sync only when the source business uses Square: `src/app/render-item/[type]/*`, `scripts/render-square-assets.mjs`, `scripts/upload-square-assets.mjs`. Requires `SQUARE_ACCESS_TOKEN`; never commit it.

Schema: `LocalBusiness` with branch/location data, plus `Product`/`Offer` for gift cards or memberships when real products exist.

## Optional Modules

Use only when requested or clearly present on the source site:

- Booking integration: provider-agnostic deep-link builder plus env-configured booking base URL.
- Forms backend: default to `mailto:`; upgrade to Formspree, Resend, or Web3Forms only when the source has a working form and the user wants server-side handling.
- Analytics: PostHog, Plausible, GA4, or OpenTelemetry collector. Ask the user; default none.
- Social feeds: Instagram cached JSON, TikTok embeds, YouTube playlist.
- Popup/promo manager: date windows, cooldown, icon support.
- Square Catalog sync: only for source businesses that use Square.
- Multi-location: `redline` `/locations` pattern.
