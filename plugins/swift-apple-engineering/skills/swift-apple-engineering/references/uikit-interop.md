# SwiftUI and UIKit interoperability

Use this reference when a feature crosses SwiftUI and UIKit, including incremental migration, representables, hosting controllers, hosted cells, delegate callbacks, sizing, navigation, and shared state.

## Contents

- [Decide whether to bridge](#decide-whether-to-bridge)
- [Ownership contract](#ownership-contract)
- [Representables](#representables)
- [Hosting SwiftUI in UIKit](#hosting-swiftui-in-uikit)
- [Navigation and presentation](#navigation-and-presentation)
- [Traits, environment, animation, and accessibility](#traits-environment-animation-and-accessibility)
- [Performance and reuse](#performance-and-reuse)
- [Testing the boundary](#testing-the-boundary)
- [Reject these patterns](#reject-these-patterns)
- [Primary references](#primary-references)

## Decide whether to bridge

Prefer a native SwiftUI implementation for new or substantially reworked UI when it completely meets the product and platform requirements. Keep mature UIKit when rewriting it adds risk or materially expands the codebase without commensurate value.

Choose the narrowest boundary:

| Requirement | Default bridge |
| --- | --- |
| One UIKit view inside SwiftUI | `UIViewRepresentable` |
| UIKit behavior depends on a controller lifecycle | `UIViewControllerRepresentable` |
| Only a UIKit gesture recognizer is missing | `UIGestureRecognizerRepresentable` when available |
| SwiftUI content inside a UIKit controller hierarchy | `UIHostingController` |
| SwiftUI content in a table/collection cell | `UIHostingConfiguration` |
| A platform API already has a complete SwiftUI equivalent | No bridge |

Avoid a generic interop framework for one adapter. A bridge should isolate the framework difference, not become a parallel application architecture.

## Ownership contract

Before writing the adapter, identify:

- the single owner of mutable state;
- the single owner of push, presentation, and dismissal transitions;
- which inputs flow into the bridge;
- which typed events flow out;
- who owns the bridged object's lifetime, delegates, observers, subscriptions, and tasks;
- how size, traits, safe areas, focus, and accessibility cross the boundary.

Pass values and bindings down and typed events upward. Never keep independently mutable UIKit and SwiftUI copies of the same domain state.

For frequent cross-framework changes, a shared `@Observable`, appropriately isolated model can be a good source of truth. For a small, infrequent hosted view update, replacing a hosting controller's `rootView` can be simpler. Choose based on actual lifecycle and update frequency.

UIKit automatic Observation tracking is available on iOS/iPadOS 18 and later. On iOS/iPadOS 18, the app must opt in with `UIObservationTrackingEnabled`; on iOS/iPadOS 26 and later, the key is unnecessary. UIKit tracks `@Observable` properties read from documented update, layout, draw, and cell-configuration hooks. Use those hooks instead of adding a parallel observer layer, but gate newer hooks such as `updateProperties()`, test every supported OS, and keep explicit update wiring when it is simpler or required.

## Representables

Treat a representable as a replaceable value description of an externally managed UIKit object:

- `makeCoordinator()` creates optional persistent glue before the UIKit object is made.
- `makeUIView` or `makeUIViewController` creates and wires the object for a mounted identity.
- `updateUIView` or `updateUIViewController` applies the complete current configuration. Make it idempotent, cheap, and safe to call repeatedly.
- `sizeThatFits` calculates size without mutating state.
- `dismantleUIView` or `dismantleUIViewController` removes adapter-owned delegates, observers, targets, subscriptions, and tasks.

SwiftUI owns a represented root view's `center`, `bounds`, `frame`, and `transform`; do not set them directly.

### Coordinator rules

- Use a coordinator for delegate, data-source, target-action, and callback traffic—not as a second model layer.
- A coordinator persists while the representable value changes. Refresh cached bindings, callbacks, and configuration during every update; do not permanently retain the initial representable value.
- Prefer weak captures where a callback can create a cycle.
- Compare before assigning and distinguish programmatic changes from delegate-originated changes to prevent feedback loops.
- Do not mutate a SwiftUI binding synchronously from an update pass merely to suppress a warning later with `DispatchQueue.main.async`. Fix the direction and ownership of data flow.
- Any task owned by the coordinator needs a stored handle and teardown cancellation. Apply [concurrency.md](concurrency.md).

For a legacy Objective-C delegate, inspect the imported protocol isolation and the framework's documented callback queue before choosing annotations:

- If the callback is MainActor-isolated, isolate the coordinator/conformance and access UIKit there.
- If the callback has no actor guarantee, keep the adapter free of UI-state access, convert the result to a compiler-checked `Sendable` value snapshot, and then cross to the owning actor.
- If Apple documents a main-executor guarantee that older annotations cannot express, use an isolated conformance where supported. A narrow `@preconcurrency` conformance or runtime isolation assertion is migration debt and needs the main skill's deviation record.
- Never pass a non-`Sendable` framework reference across isolation or add unchecked sendability merely to silence the compiler.

Framework-specific permissions, interruption handling, and session lifecycles remain part of the wrapped API's contract; apply that framework's primary documentation in addition to this generic bridge guidance.

### Minimal shape

```swift
struct SearchField: UIViewRepresentable {
    @Binding var text: String

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text)
    }

    func makeUIView(context: Context) -> UISearchTextField {
        let field = UISearchTextField()
        field.addTarget(
            context.coordinator,
            action: #selector(Coordinator.changed(_:)),
            for: .editingChanged
        )
        return field
    }

    func updateUIView(_ field: UISearchTextField, context: Context) {
        context.coordinator.text = $text
        if field.text != text { field.text = text }
    }

    static func dismantleUIView(_ field: UISearchTextField, coordinator: Coordinator) {
        field.removeTarget(coordinator, action: nil, for: .allEvents)
    }

    @MainActor
    final class Coordinator: NSObject {
        var text: Binding<String>

        init(text: Binding<String>) { self.text = text }

        @objc func changed(_ sender: UISearchTextField) {
            if text.wrappedValue != sender.text {
                text.wrappedValue = sender.text ?? ""
            }
        }
    }
}
```

Adapt isolation to the project's Swift mode and imported framework annotations. UIKit access in this example is MainActor-isolated. The important contract is one source of truth, refreshed coordinator inputs, idempotent updates, and explicit teardown.

## Hosting SwiftUI in UIKit

When manually embedding a `UIHostingController` in another controller's view hierarchy, treat it as a real child view controller:

1. Retain it.
2. Call `addChild` before adding its view.
3. Add the view and constraints or frame.
4. Call `didMove(toParent:)`.
5. On removal, reverse containment with `willMove(toParent: nil)`, remove the view, and call `removeFromParent()`.

Never attach only `hostingController.view`. Missing containment breaks lifecycle, traits, appearance forwarding, and retention.

When pushing or presenting a hosting controller normally, use the navigation or presentation APIs; their UIKit container owns containment and retention.

Choose sizing deliberately:

- default/empty `sizingOptions` for a host filled by external constraints;
- `.intrinsicContentSize` for Auto Layout self-sizing;
- `.preferredContentSize` for popovers or custom containers that consume it.

Dynamic sizing has measurement cost. Do not enable every option by habit. Preserve safe areas unless the surrounding container intentionally owns them.

For table and collection cells, prefer `UIHostingConfiguration`. Do not create and retain one hosting controller per reusable cell unless real controller semantics are required.

## Navigation and presentation

- A UIKit shell should own UIKit pushes/presentations; embedded SwiftUI emits typed intent.
- A SwiftUI shell should own `NavigationStack`, sheets, and popovers; wrapped UIKit leaves emit typed intent.
- Nested navigation is acceptable for an intentionally independent subflow, not as an accidental second owner.
- Do not use global "top view controller" searches, responder-chain presentation hacks, or private SwiftUI introspection.
- Define dismissal ownership explicitly so UIKit and SwiftUI cannot both dismiss the same transition.

## Traits, environment, animation, and accessibility

- Re-read environment-dependent configuration during updates, not only during creation.
- Bridge a custom trait/environment value only when it is genuinely hierarchical; use ordinary parameters for local configuration.
- When a UIKit change must follow a SwiftUI transaction, use the context's animation facilities where available rather than inventing a separate animation timeline.
- Preserve safe areas, layout direction, Dynamic Type, contrast, Reduce Motion, focus, and accessibility semantics.
- Avoid duplicate accessibility elements caused by labeling the same control in both frameworks. The exposed element should have one coherent label, value, traits, and actions.
- Availability-gate newer interop APIs and test the fallback. Beta APIs require an explicit user or repository opt-in.

Useful minimums to check before recommending an API include:

- SwiftUI Observation: iOS/iPadOS 17, macOS 14, tvOS 17, and watchOS 10;
- `UIHostingConfiguration`, `UIHostingController.sizingOptions`, and representable `sizeThatFits`: iOS/tvOS 16 where applicable;
- `UIGestureRecognizerRepresentable` and representable-context animation helpers: iOS 18 where available.

These are starting points, not substitutes for checking the exact declaration in the repository's installed SDK and every target platform.

## Performance and reuse

- Keep `update` narrowly scoped; do not call `reloadData()` or rebuild a hierarchy for a small value change.
- Do not perform blocking subsystem work such as camera/session startup or shutdown inside `update`; send an idempotent intent to the established lifecycle owner.
- Create constraints, formatters, delegates, and expensive UIKit resources once when their lifetime matches the represented object.
- Do not force refresh with `.id(UUID())`; fix identity or update behavior.
- Keep sizing pure and inexpensive because it may run repeatedly with different proposals.
- Profile repeated updates, cell reuse, layout, image work, and animation before adding caches or custom hosting pools.

## Testing the boundary

Test meaningful behavior, not adapter mechanics:

- unit-test pure input mapping and typed output events;
- integration-test delegate/coordinator behavior when it contains meaningful translation;
- add one focused host or UI smoke test when containment, lifecycle, navigation wiring, or accessibility is risky;
- select from mount, repeated update, remount/reuse, teardown, rotation/size-class changes, Dynamic Type, and representative VoiceOver behavior according to the boundary actually changed and its risks; do not turn this list into a mandatory matrix for an unchanged host;
- verify tasks, delegates, observers, and subscriptions stop at teardown;
- avoid asserting the incidental UIKit hierarchy SwiftUI generates.

See [testing.md](testing.md) for framework and determinism choices.

## Reject these patterns

- `parent.view.addSubview(UIHostingController(rootView: content).view)`
- a hosting controller that is not retained and contained;
- `@State` around an externally owned model;
- a coordinator that permanently stores the initial representable as `parent`;
- duplicate mutable state on both sides of the bridge;
- recreating delegates, constraints, observers, or expensive objects in every update;
- unowned tasks started from make/update methods;
- UIKit and SwiftUI both presenting or rendering navigation for one flow;
- `UIViewControllerRepresentable` inside `UIHostingConfiguration`;
- blanket safe-area disabling or sizing options;
- a broad bridge abstraction whose only consumer is one small adapter.

## Primary references

- [Apple: UIKit integration with SwiftUI](https://developer.apple.com/documentation/swiftui/uikit-integration)
- [Apple: `UIViewRepresentable`](https://developer.apple.com/documentation/swiftui/uiviewrepresentable)
- [Apple: `UIViewControllerRepresentable`](https://developer.apple.com/documentation/swiftui/uiviewcontrollerrepresentable)
- [Apple: Interfacing with UIKit tutorial](https://developer.apple.com/tutorials/swiftui/interfacing-with-uikit)
- [Apple: `UIHostingController`](https://developer.apple.com/documentation/swiftui/uihostingcontroller)
- [Apple: Hosting controller sizing options](https://developer.apple.com/documentation/swiftui/uihostingcontrollersizingoptions)
- [Apple: `UIHostingConfiguration`](https://developer.apple.com/documentation/swiftui/uihostingconfiguration)
- [Apple: Custom view-controller containment](https://developer.apple.com/documentation/uikit/creating-a-custom-container-view-controller)
- [Apple: Updating UIKit views with Observation](https://developer.apple.com/documentation/uikit/updating-views-automatically-with-observation-tracking-in-uikit)
- [Apple: `UIObservationTrackingEnabled`](https://developer.apple.com/documentation/bundleresources/information-property-list/uiobservationtrackingenabled)
- [Apple: `UIGestureRecognizerRepresentable`](https://developer.apple.com/documentation/swiftui/uigesturerecognizerrepresentable)
- [Apple: Accessibility fundamentals](https://developer.apple.com/documentation/swiftui/accessibility-fundamentals)
- [WWDC22: Use SwiftUI with UIKit](https://developer.apple.com/videos/play/wwdc2022/10072/)
- [WWDC26: Use SwiftUI with AppKit and UIKit](https://developer.apple.com/videos/play/wwdc2026/272/)
