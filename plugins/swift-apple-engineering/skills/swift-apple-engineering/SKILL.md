---
name: swift-apple-engineering
description: Use whenever writing, reviewing, refactoring, or testing Swift code for Apple platforms, including SwiftUI state and view design, UIKit and SwiftUI interoperability, async/await and actor isolation, and Swift Testing or XCTest strategy.
---

# Swift Apple Engineering

Apply current Apple-platform defaults without turning every feature into an architecture project. Prefer the simplest design that is correct, testable, and compatible with the repository's actual toolchain and deployment targets.

## Start with the repository

Before proposing or editing code:

1. Read repository instructions and inspect the existing architecture, nearby patterns, and tests.
2. Determine the exact Xcode and Swift versions, Swift language mode, strict-concurrency settings, deployment targets, and supported platforms. Do not infer these from the current SDK alone.
3. Preserve a sound existing pattern unless the task or a demonstrated problem justifies changing it. Avoid mixing an architectural migration into an unrelated fix.
4. Identify the source of truth, ownership boundaries, task lifetimes, external side effects, and the behaviors that need verification.
5. Read every reference relevant to the task before implementing:
   - SwiftUI state, composition, navigation, accessibility, or performance: [swiftui.md](references/swiftui.md)
   - SwiftUI and UIKit integration or migration: [uikit-interop.md](references/uikit-interop.md)
   - `async`/`await`, tasks, actors, `Sendable`, streams, or callbacks: [concurrency.md](references/concurrency.md)
   - Unit, integration, UI, performance, snapshot, or async tests: [testing.md](references/testing.md)

When a task crosses domains, apply the references together. Interop does not waive concurrency rules, and testability does not justify unnecessary production abstractions.

## Engineering defaults

- Use native Swift and platform APIs before adding a dependency or bridge.
- Use the newest suitable API that the declared deployment targets support. Add availability handling only where the product actually supports older systems.
- Keep one authoritative source of mutable state. Derive display state instead of synchronizing duplicate copies.
- Keep UI declarations focused on rendering and user intent; keep substantial business rules, orchestration, persistence, and networking outside view construction.
- Prefer value types and explicit inputs. Introduce reference identity, protocols, wrappers, or coordinators only where ownership or a real boundary requires them.
- Prefer structured concurrency, explicit isolation, cooperative cancellation, and compiler-checked `Sendable` values.
- Test observable behavior at the lowest reliable boundary. Use a small seam at nondeterministic or external boundaries instead of a framework-wide dependency layer.
- Preserve accessibility, localization, Dynamic Type, state restoration, and platform conventions as functional requirements.
- Measure before applying performance complexity. Fix identity, invalidation scope, algorithmic work, or lifecycle mistakes before adding caches or custom infrastructure.
- Keep the build free of new warnings. Never silence a concurrency or safety diagnostic without proving the replacement invariant.

## Architecture threshold

Do not require MVVM, reducers, coordinators, repositories, use-case layers, a dependency-injection container, or a protocol for every type.

Start with the platform's direct model:

- A simple view can own local state and call a focused dependency.
- Add an observable feature model when state transitions, async orchestration, reuse, or independent tests make it useful.
- Add a protocol or closure at a meaningful external or nondeterministic boundary.
- Add a coordinator when a framework lifecycle or navigation owner actually needs one.
- Add another layer only when it removes demonstrated duplication, clarifies ownership, or enables valuable testing.

The number of files or layers is not a quality metric. Avoid both massive views/controllers and ceremonial one-method abstractions.

## Deviations

Follow the defaults unless at least one strong constraint applies:

- the platform or framework cannot satisfy a product requirement;
- the repository's supported OS, ABI, dependency, or migration boundary requires an older pattern;
- measured correctness, performance, memory, or lifecycle evidence supports an exception;
- a sound existing architecture makes migration riskier than the benefit;
- the default would materially increase code, concepts, or maintenance for little practical value.

Familiarity, speculative future reuse, avoiding compiler diagnostics, or "we have always done it this way" are not sufficient reasons.

For a meaningful deviation, record this compactly in the implementation note, code comment, or handoff:

```text
Default: <the normal pattern>
Constraint: <specific evidence that prevents or outweighs it>
Exception: <the smallest safe deviation>
Verification: <tests, measurements, or supported configurations>
Removal: <condition for deleting a temporary workaround, if applicable>
```

Temporary compatibility workarounds also need a removal condition. Keep the explanation next to the decision; do not create a formal architecture document for a trivial local exception.

## Implementation workflow

1. State the relevant default and any constraint before choosing a design.
2. Make the smallest coherent change that preserves ownership and public behavior.
3. Keep unsafe or legacy interop isolated behind a narrow boundary.
4. Add or update tests for behavior, failure, and cancellation where applicable. A bug fix needs a regression test at the lowest layer that reproduces it.
5. Build and test the affected targets with the repository's task runner. For visible UI changes, also inspect representative states in previews or a simulator/device; previews do not replace tests.
6. Report the pattern used, any deviation, and the evidence from validation. Distinguish verified behavior from assumptions about unavailable devices, OS versions, or services.

## Review priorities

Review in this order:

1. Correctness, data races, ownership, cancellation, lifecycle, and data loss.
2. Accessibility, privacy, security, and user-visible failure behavior.
3. State flow, API contracts, test coverage, and compatibility.
4. Performance supported by evidence.
5. Naming, organization, and stylistic consistency.

Do not churn correct code solely to match a preference. When two options are equally safe and clear, choose the one already used nearby or the one with less code and fewer concepts.
