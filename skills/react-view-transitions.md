---
name: react-view-transitions
description: Implement CSS View Transitions API in Next.js App Router using next-view-transitions. Use when building page transitions, route animations, or the user mentions view transitions in a Next.js project.
---

# next-view-transitions

CSS View Transitions API for Next.js App Router. Package: `next-view-transitions` (by Shu Ding).

- **Repo**: github.com/shuding/next-view-transitions
- **Demo**: next-view-transitions.vercel.app
- **Peer deps**: Next.js >=14, React >=18.2 or ^19

## Installation

```bash
pnpm install next-view-transitions
```

## Setup

### 1. Wrap Root Layout with `<ViewTransitions>`

```tsx
import { ViewTransitions } from 'next-view-transitions'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransitions>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ViewTransitions>
  )
}
```

The `<ViewTransitions>` provider must wrap the `<html>` element. It handles:
- Coordinating view transition lifecycle with React rendering
- Automatically intercepting browser back/forward navigation (popstate) with view transitions

### 2. Use `<Link>` for Navigation

Drop-in replacement for `next/link` that triggers view transitions:

```tsx
import { Link } from 'next-view-transitions'

export default function Nav() {
  return <Link href="/about">Go to About</Link>
}
```

Accepts all the same props as `next/link` (`href`, `as`, `replace`, `scroll`, `prefetch`, etc.). Falls back to normal navigation if the browser doesn't support `startViewTransition`.

### 3. Use `useTransitionRouter` for Programmatic Navigation

```tsx
'use client'
import { useTransitionRouter } from 'next-view-transitions'

export default function Component() {
  const router = useTransitionRouter()

  return (
    <button onClick={() => router.push('/about')}>
      Go to About
    </button>
  )
}
```

Returns a `TransitionRouter` that extends Next.js `AppRouterInstance` with transition-aware `push` and `replace`.

## API Reference

### `<ViewTransitions>`

| Prop | Type | Description |
|------|------|-------------|
| `children` | `React.ReactNode` | Must wrap the root `<html>` element |

### `<Link>`

Same props as `next/link` (`React.ComponentProps<typeof NextLink>`). Intercepts clicks to trigger `document.startViewTransition()` before navigating. Respects modifier keys (ctrl/cmd+click opens in new tab as usual).

### `useTransitionRouter()`

Returns `TransitionRouter`:

```ts
type TransitionOptions = {
  onTransitionReady?: () => void
}

type TransitionRouter = AppRouterInstance & {
  push: (href: string, options?: NavigateOptions & TransitionOptions) => void
  replace: (href: string, options?: NavigateOptions & TransitionOptions) => void
}
```

- `router.push(href, options?)` — navigate with view transition
- `router.replace(href, options?)` — replace with view transition
- `router.back()`, `router.forward()`, `router.refresh()`, `router.prefetch()` — inherited from Next.js router
- `onTransitionReady` — callback fired when the transition's `ready` promise resolves (useful for custom animations via the Web Animations API)

## CSS View Transition Styles

Use CSS to control transition animations. The browser creates `::view-transition-*` pseudo-elements:

```css
/* Default crossfade (works out of the box) */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.3s;
}

/* Named transitions for specific elements */
.hero-image {
  view-transition-name: hero;
}

::view-transition-old(hero),
::view-transition-new(hero) {
  animation-duration: 0.5s;
  animation-timing-function: ease-in-out;
}

/* Slide transition example */
@keyframes slide-from-right {
  from { transform: translateX(100%); }
}
@keyframes slide-to-left {
  to { transform: translateX(-100%); }
}

::view-transition-old(root) {
  animation: 0.3s slide-to-left;
}
::view-transition-new(root) {
  animation: 0.3s slide-from-right;
}
```

## Custom Animations with `onTransitionReady`

Use the Web Animations API for JS-driven transitions:

```tsx
router.push('/next-page', {
  onTransitionReady: () => {
    document.documentElement.animate(
      [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.95)' },
      ],
      {
        duration: 300,
        easing: 'ease-in',
        pseudoElement: '::view-transition-old(root)',
      },
    )
    document.documentElement.animate(
      [
        { opacity: 0, transform: 'scale(1.05)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      {
        duration: 300,
        easing: 'ease-out',
        pseudoElement: '::view-transition-new(root)',
      },
    )
  },
})
```

## Important Notes

- All exports are `'use client'` — they run in the browser only
- Browser support: Chrome 111+, Edge 111+, Safari 18+, Firefox 128+. Falls back gracefully (no transition, normal navigation).
- This library targets basic use cases. Complex patterns with concurrent rendering, Suspense boundaries, and streaming may need future React/Next.js core primitives.
- `view-transition-name` values must be unique on the page at transition time — duplicates cause the transition to skip.
- Back/forward browser navigation is automatically intercepted with view transitions (via popstate listener).
