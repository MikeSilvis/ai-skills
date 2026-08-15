# SwiftUI patterns

Use this reference for SwiftUI state ownership, view composition, navigation, data loading, accessibility, and performance. Apply [concurrency.md](concurrency.md) and [testing.md](testing.md) when the feature performs asynchronous work or needs tests.

## Contents

- [Choose the smallest useful design](#choose-the-smallest-useful-design)
- [State ownership](#state-ownership)
- [Views and feature models](#views-and-feature-models)
- [Effects and lifecycle](#effects-and-lifecycle)
- [Navigation and presentation](#navigation-and-presentation)
- [Current APIs and availability](#current-apis-and-availability)
- [Identity and collections](#identity-and-collections)
- [Layout, styling, and accessibility](#layout-styling-and-accessibility)
- [Performance](#performance)
- [Previews](#previews)
- [Review checklist](#review-checklist)
- [Primary references](#primary-references)

## Choose the smallest useful design

Start with a view, its local state, and focused dependencies. Add a feature model when there are meaningful state transitions, shared mutable state, async orchestration, or logic worth testing independently. Do not create a view model merely because a view exists.

A practical progression is:

1. Immutable inputs and local `@State` for a simple view.
2. Extract pure calculations when they become substantial or independently valuable.
3. Add an `@Observable` feature model when the feature needs durable identity, orchestration, or independently testable behavior.
4. Introduce a service boundary for networking, persistence, permissions, or another external system.
5. Use a reducer/state machine only when the workflow's number of states and transitions makes that clarity worth the added structure.

Keep production abstractions proportional. A closure can be a better seam than a protocol with one conformer.

## State ownership

For deployment targets that support Observation:

| Need | Default |
| --- | --- |
| Immutable input | `let` |
| View-owned transient value | `@State private` |
| View-owned observable model | `@State private` around an `@Observable` instance |
| Child edits parent-owned value | `@Binding` |
| Bindings to an injected observable model | `@Bindable` |
| Simple scalar user preference with no domain rules | `@AppStorage` with an explicit key and injectable store when tests need isolation |
| Truly hierarchical, cross-cutting dependency | typed `@Environment` |
| Shared persistent/external data | an injected model or service with explicit ownership |

- Mark UI-owned mutable models `@MainActor` unless the module already supplies MainActor default isolation.
- Observation does not itself define actor isolation. Declare isolation based on ownership.
- Keep `@State` properties private so the view remains their clear owner.
- Do not wrap an externally owned model in `@State`; accept it as an input.
- Avoid storing values that can be derived cheaply from authoritative state.
- Avoid mirroring the same mutable property in a view, model, and UIKit adapter.
- Do not wrap a simple preference in a repository or observable model merely because it is persisted. Move beyond `@AppStorage` when validation, migration, multi-value transactions, non-UserDefaults storage, or broader ownership creates real domain behavior.
- Use `ObservableObject`, `@StateObject`, and `@ObservedObject` when deployment targets or a sound existing architecture require Combine-era observation. Do not mix observation systems in one feature without a specific migration boundary.
- Use environment values for genuinely hierarchical concerns, not as a hidden service locator.

## Views and feature models

`body` describes UI from current state. Keep it deterministic and free of networking, persistence, navigation side effects, expensive transformations, and object creation with meaningful identity.

Extract a subview when it has at least one of these:

- a meaningful visual or accessibility unit;
- independent state or ownership;
- reuse;
- a distinct performance invalidation boundary;
- a clearer input/action contract;
- enough logic that the parent no longer reads as a declaration of structure.

Do not extract solely to satisfy an arbitrary line count. Prefer explicit inputs over passing a large parent model to every leaf.

Feature models should expose state and user-intent methods, not SwiftUI implementation details. A useful model generally owns orchestration or transitions such as `idle → loading → loaded/error`; a trivial forwarding object usually adds ceremony without value.

## Effects and lifecycle

- Use `.task` for work owned by a view's mounted lifetime and `.task(id:)` when the work must restart for a changing identity. SwiftUI cancels these tasks when appropriate.
- Keep task bodies thin: call a model or dependency, handle cancellation deliberately, and publish results through isolated state.
- Do not start an unowned `Task` in `body`, an initializer, or an update callback.
- Use `onAppear` for synchronous appearance work, not as a substitute for task ownership.
- Treat cancellation as a normal lifecycle outcome; do not show it as an error or automatically retry it.
- Reset or retain state deliberately when identity changes. Never use `.id(UUID())` to paper over lifecycle problems.

See [concurrency.md](concurrency.md) for isolation, task ownership, and cancellation details.

## Navigation and presentation

- Give each flow one navigation owner.
- Prefer typed navigation values and `navigationDestination(for:)` for data-driven stacks.
- Use `sheet(item:)`, `popover(item:)`, or another identity-based presentation when the presented content has a model. Avoid a Boolean plus a separate optional payload that can drift out of sync.
- A child emits a typed intent; the owner of the stack or presentation performs the transition.
- Keep navigation state in a model only when the product needs restoration, deep linking, coordination across screens, or independent testing. Local presentation can remain local state.
- Avoid nested navigation containers unless the child is an intentionally independent subflow.

## Current APIs and availability

Prefer current, typed APIs when supported by the repository's deployment targets, including:

- Observation over new Combine-based observation code;
- `NavigationStack` over `NavigationView`;
- `foregroundStyle` over `foregroundColor` where semantics fit;
- modern `onChange` overloads over the deprecated single-value closure;
- `contentMargins` over indiscriminate padding for scroll content;
- `containerRelativeFrame`, layout protocols, or visual effects over broad `GeometryReader` use where they express the intent;
- `Button` over tap gestures for semantic actions.

Do not raise a deployment target or add a complex backport for cosmetic API modernization unless the user asks or the benefit justifies it. Availability is a product constraint, not a reason for scattered version checks: isolate fallbacks near the boundary.

## Identity and collections

- `ForEach` identity must represent the domain item and stay stable across updates.
- Prefer `Identifiable` stable IDs or a stable key path. Do not use collection offsets for mutable data, `\.self` for values that can duplicate, or freshly generated UUIDs during rendering.
- Mutate collections by stable identity, not by a stale visible index.
- Keep filtering, sorting, and grouping outside hot view-builder paths when the work is nontrivial.
- Use lazy containers for large scrollable content and profile before adding pagination, caches, or manual diffing.

## Layout, styling, and accessibility

- Let layout flow from parent proposals and intrinsic content. Use fixed frames only when the design requires them.
- Avoid `GeometryReader` when container-relative sizing, alignment guides, layout values, or a custom `Layout` expresses the relationship more directly.
- Keep modifier order intentional; it changes layout, hit testing, rendering, and accessibility.
- Use semantic controls and labels. Provide accessibility labels, values, hints, traits, actions, and grouping only where the default semantics are insufficient.
- Support Dynamic Type, content size changes, localization expansion, right-to-left layout, contrast, Reduce Motion, and Voice Control for relevant screens.
- Keep stable accessibility identifiers on elements used by UI tests; identifiers are not user-facing copy.
- Treat empty, loading, loaded, error, disabled, and offline states as part of the feature rather than preview-only decoration.

## Performance

Optimize from evidence:

1. Reproduce the hitch, excess update, CPU, memory, or launch problem.
2. Use Instruments, SwiftUI diagnostics, or a focused benchmark to identify the cause.
3. Fix unstable identity, excessive observation, repeated work, synchronous main-actor work, or oversized invalidation scope first.
4. Measure again under the same conditions.

Common fixes:

- pass only values a leaf needs;
- split observation boundaries around independently changing state;
- move expensive pure work out of `body` and recompute only when inputs change;
- decode, resize, and process media off the UI actor, then publish a small result;
- preserve stable list identity;
- avoid `AnyView`, blanket `.equatable()`, or caches until measurement shows they solve the actual bottleneck.

## Previews

Provide previews for representative states when they materially help development: loading, empty, populated, error, long text, large Dynamic Type, light/dark appearance, and relevant size classes. Use deterministic fixtures and no live network or personal data.

Previews are visual development tools, not pass/fail tests. Test behavior separately.

## Review checklist

- Is each mutable value owned exactly once?
- Is actor isolation explicit and appropriate?
- Is `body` a declaration rather than an effect runner?
- Are task lifetime and cancellation owned?
- Are collection and presentation identities stable?
- Are navigation and presentation controlled by one owner?
- Is the feature accessible and resilient to text/layout variants?
- Does every abstraction remove real complexity or enable valuable behavior/testing?
- Is performance complexity backed by measurement?
- Are deviations from current APIs tied to deployment or migration constraints?

## Primary references

- [Apple: Model data in SwiftUI](https://developer.apple.com/documentation/swiftui/model-data)
- [Apple: Managing model data](https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app)
- [Apple: Migrating to Observation](https://developer.apple.com/documentation/swiftui/migrating-from-the-observable-object-protocol-to-the-observable-macro)
- [Apple: Understanding navigation stacks](https://developer.apple.com/documentation/swiftui/understanding-the-navigation-stack)
- [Apple: Maintaining state in your apps](https://developer.apple.com/documentation/swift/maintaining-state-in-your-apps)
- [Apple: SwiftUI performance](https://developer.apple.com/documentation/xcode/understanding-and-improving-swiftui-performance)
- [Apple: SwiftUI accessibility fundamentals](https://developer.apple.com/documentation/swiftui/accessibility-fundamentals)
- [Apple: Previewing an app interface](https://developer.apple.com/documentation/xcode/previewing-your-apps-interface-in-xcode)
- [Apple: SwiftUI task lifecycle](https://developer.apple.com/documentation/swiftui/view/task%28id%3Aname%3Apriority%3Afile%3Aline%3A_%3A%29)
