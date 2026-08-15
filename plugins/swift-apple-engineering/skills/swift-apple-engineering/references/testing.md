# Testing Apple-platform code

Use this reference to choose test boundaries and frameworks, design deterministic seams, test async behavior, and plan unit, integration, UI, accessibility, performance, preview, or snapshot coverage.

## Contents

- [Choose the smallest reliable boundary](#choose-the-smallest-reliable-boundary)
- [Choose Swift Testing or XCTest](#choose-swift-testing-or-xctest)
- [Test behavior, not implementation](#test-behavior-not-implementation)
- [Determinism with minimal seams](#determinism-with-minimal-seams)
- [Swift Testing patterns](#swift-testing-patterns)
- [Async and concurrency tests](#async-and-concurrency-tests)
- [SwiftUI and UIKit tests](#swiftui-and-uikit-tests)
- [UI tests](#ui-tests)
- [Performance tests](#performance-tests)
- [Previews and snapshots](#previews-and-snapshots)
- [CI feedback](#ci-feedback)
- [Reject these patterns](#reject-these-patterns)
- [Primary references](#primary-references)

## Choose the smallest reliable boundary

Test observable behavior at the lowest layer that can prove it:

| Layer | Default tool | Cover |
| --- | --- | --- |
| Fast unit/model | Swift Testing for new Swift tests | Pure logic, state transitions, parsing, formatting, orchestration, errors, cancellation |
| Focused integration | Swift Testing | Client + stub transport, temporary/in-memory persistence, framework adapters, SwiftUI/UIKit boundary behavior |
| End-to-end UI | XCTest/XCUIAutomation | A small set of critical journeys, navigation/wiring, accessibility, representative configurations |
| Performance | XCTest metrics | Launch, CPU, memory, storage, hangs/hitches, and genuinely critical regions |

Use a pyramid: many fast isolated tests, fewer integration tests, and a small set of high-value UI tests. Performance tests form a separate narrow suite. This is a risk model, not a coverage-percentage quota.

Every bug fix gets a regression test at the lowest layer that reproduces it. If the bug is exclusively framework lifecycle or visual wiring, a focused integration or UI test may be the lowest truthful boundary.

## Choose Swift Testing or XCTest

- Use Swift Testing for new Swift unit and direct-code integration tests on a supported toolchain.
- Continue XCTest for UI automation and performance tests.
- Existing XCTest unit tests can remain and coexist with Swift Testing in the same test bundle. Migrate opportunistically, not wholesale.
- An XCTest-heavy neighboring suite alone is not a reason to write a new direct-code test in XCTest; use Swift Testing unless a concrete compatibility or infrastructure constraint applies.
- Use XCTest where Objective-C compatibility or an existing specialized XCTest infrastructure is a real constraint.
- Do not mix assertions and APIs from Swift Testing and XCTest inside one test function.

## Test behavior, not implementation

Assert observable values, state, errors, side effects, persistence, emitted events, and user outcomes.

Do not assert:

- private method calls;
- incidental collaborator choreography;
- SwiftUI `body` structure or modifier order;
- the private UIKit hierarchy SwiftUI generates;
- scheduler order that the API does not guarantee;
- exact implementation types when behavior is the contract.

A presentational view with no meaningful logic often needs previews and higher-level coverage, not a new view model plus unit test.

## Determinism with minimal seams

Tests must not depend on execution order, real user data, a live external network, wall-clock time, uncontrolled randomness, current locale/time zone, or fixed delays.

Inject the smallest seam that makes the behavior controllable:

1. a value or configuration;
2. a closure such as `now`, `uuid`, `sleep`, or one side effect;
3. a narrow protocol for a meaningful external boundary such as transport, storage, permissions, or a system service;
4. a stateful fake only when the behavior requires it.

Do not create a protocol for every type, a repository for every model, or a dependency-injection container solely for testing. A local closure is often enough. Prefer handwritten stubs, spies, and fakes; a mocking framework needs a concrete maintenance payoff.

Isolate persistent state per test:

- a unique temporary directory;
- a dedicated `UserDefaults` suite;
- an in-memory or temporary SwiftData/Core Data store;
- a stubbed `URLProtocol` or injected transport;
- deterministic locale, calendar, time zone, clock, and random/ID source when relevant.

Clean up owned resources and keep tests parallel-safe by default.

## Swift Testing patterns

- Use `@Test` functions that are `async`, `throws`, or `async throws` when production behavior is asynchronous or throwing.
- Let unexpected errors fail the test naturally.
- Use `#expect(throws:)` when an error is the expected behavior.
- Use `#require` for prerequisites or optional unwrapping that must stop the test; use `#expect` for independent checks that can continue.
- Parameterize boundary tables and repeated input/output cases. Use zipped arguments for paired cases and avoid an accidental Cartesian product.
- Suites express source hierarchy; tags express cross-cutting selection. Keep a small vocabulary such as `integration`, `external`, `slow`, and `critical`.
- Conditional traits are for real platform, availability, or capability constraints—not flaky tests.
- Swift Testing runs tests and parameterized cases in parallel by default. Prefer resource isolation. If `.serialized` is unavoidable, every accessor must be in the same serialized suite or parameterized test; the trait does not serialize unrelated suites. Document the resource and why a true cross-suite isolation mechanism was impractical.
- A disabled or known-issue test needs a reason and a linked bug where available.

## Async and concurrency tests

- Directly `await` the result. Do not wrap an async call in another task unless concurrent behavior itself is under test.
- Use Swift Testing `confirmation` or XCTest expectations only for a genuine callback, delegate, notification, or event boundary. A confirmation does not wait after its closure returns: keep that async closure active until the event occurs, or adapt the callback to an awaited operation/stream.
- Never synchronize with `Task.sleep`, `Thread.sleep`, repeated `Task.yield`, arbitrary polling, or an oversized timeout.
- Inject a controllable clock/sleeper or wait for an observable state transition.
- For cancellation, cancel the owned task, await its completion/result, and assert the promised cleanup or error/outcome.
- For actors, launch a controlled set of child tasks and assert invariants, cancellation, cleanup, or reentrancy behavior—not execution order.
- Test a continuation or stream's success, failure, cancellation, termination cleanup, and single-resume or buffer-overflow contract.
- Annotate a test or suite `@MainActor` only when the system under test requires it. Do not use blanket MainActor isolation to hide unsafe fixtures.
- Treat a timeout as an upper safety bound, never the mechanism that observes success.

See [concurrency.md](concurrency.md) for production contracts.

## SwiftUI and UIKit tests

- Keep business rules and external effects outside `View.body` and presentation code so they can be tested directly.
- Extract a pure function or feature model only when there is meaningful behavior; do not create a model for every view.
- For `UIViewRepresentable`, `UIViewControllerRepresentable`, coordinators, and hosting boundaries, test meaningful input mapping and output events, then add one focused host/UI smoke test when lifecycle or wiring is risky.
- Avoid third-party view-inspection or snapshot infrastructure unless the project already relies on it or the value clearly exceeds dependency and maintenance cost.
- Test critical user workflows and accessibility through the public UI, not SwiftUI's generated hierarchy.

## UI tests

- Give important controls stable, nonlocalized, descriptive accessibility identifiers; derive a stable suffix for repeated data-driven elements.
- Prefer identifier queries over localized display strings and concise queries over hierarchy-coupled queries.
- Seed deterministic state through launch arguments/environment or a test-specific data configuration.
- Wait for observable element state with `waitForExistence`, disappearance waits, or property expectations—never sleep.
- Keep each test focused on one critical journey or regression. Avoid one giant test that depends on the entire app.
- Run representative journeys across relevant device families, orientations, appearances, content sizes, locales, and right-to-left layout through test plans.
- Add accessibility audits on representative screens and fix or explicitly classify findings.
- Save screenshots and attachments as diagnostics on failure; they are not visual assertions by themselves.

## Performance tests

- Use XCTest metrics and a dedicated performance test plan.
- Measure realistic data and only the intended region; keep setup outside the measured block.
- Choose a metric that matches the risk instead of measuring wall time by habit.
- Establish and compare baselines on stable hardware/configuration.
- Use release-like measurement conditions with debugging, coverage, and sanitizers disabled.
- Use Instruments to diagnose regressions; a performance assertion tells you that something changed, not why.

## Previews and snapshots

Previews should cover important visual states such as loading, empty, populated, error, long content, Dynamic Type, appearance, and relevant size classes. They are deterministic development fixtures, not automated tests.

Snapshot testing is optional. Use it only for a deliberate visual contract with existing review and baseline-management infrastructure. Pin device, OS, locale, scale, appearance, and fonts. Do not add a snapshot dependency or baseline every screen by default.

## CI feedback

- Keep the fast deterministic suite on every change.
- Separate slower integration, UI, performance, sanitizer, and external-service suites so their cost and failure semantics are clear.
- Use test plans and tags to select intentional configurations, not to hide flakes.
- Treat a flaky test as a defect: fix its state ownership/synchronization or quarantine it with an owner, reason, and removal condition.
- Code coverage is a discovery signal, not the goal. Prioritize risky behavior, boundaries, failures, and regressions.

## Reject these patterns

- live network calls or personal accounts in ordinary unit tests;
- shared mutable singletons or order-dependent fixtures;
- sleeps, yields, polling loops, or oversized timeouts used for synchronization;
- blanket `@MainActor` or `.serialized`;
- one giant end-to-end test;
- implementation-detail assertions;
- architecture layers introduced solely to increase test count;
- snapshotting every screen;
- `try?`, ignored errors, or force unwraps after a nonfatal expectation;
- disabling a flaky test without a tracked reason;
- treating line coverage as proof of correctness.

## Primary references

- [Apple: Testing strategy and pyramid](https://developer.apple.com/documentation/xcode/testing)
- [Apple: Adding tests and choosing a framework](https://developer.apple.com/documentation/xcode/adding-tests-to-your-xcode-project)
- [Apple: Swift Testing](https://developer.apple.com/documentation/testing)
- [Apple: XCTest](https://developer.apple.com/documentation/xctest)
- [Apple: Migrating from XCTest](https://developer.apple.com/documentation/testing/migratingfromxctest)
- [Apple: Testing asynchronous code](https://developer.apple.com/documentation/testing/testing-asynchronous-code)
- [Apple: Parameterized testing](https://developer.apple.com/documentation/testing/parameterizedtesting)
- [Apple: Parallelization](https://developer.apple.com/documentation/testing/parallelization)
- [Apple: Updating code for unit-test seams](https://developer.apple.com/documentation/xcode/updating-your-existing-codebase-to-accommodate-unit-tests)
- [Apple: Accessibility audits](https://developer.apple.com/documentation/accessibility/performing-accessibility-audits-for-your-app)
- [Apple: Performance tests](https://developer.apple.com/documentation/xctest/performance-tests)
- [Apple: Writing and running performance tests](https://developer.apple.com/documentation/xcode/writing-and-running-performance-tests)
- [Apple: Organizing tests and test plans](https://developer.apple.com/documentation/xcode/organizing-tests-to-improve-feedback)
- [Apple: In-memory SwiftData configuration](https://developer.apple.com/documentation/swiftdata/modelconfiguration)
- [Swift: Testing vision and parallelism](https://github.com/swiftlang/swift-evolution/blob/main/visions/swift-testing.md)
