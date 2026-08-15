# Swift concurrency patterns

Use this reference for `async`/`await`, tasks, actors and global actors, `Sendable`, `AsyncSequence`, continuations, callback adaptation, migration, and concurrent tests.

## Contents

- [Inspect the actual concurrency model](#inspect-the-actual-concurrency-model)
- [Build and isolation defaults](#build-and-isolation-defaults)
- [Choose the task shape](#choose-the-task-shape)
- [Cancellation](#cancellation)
- [`Sendable` and value transfer](#sendable-and-value-transfer)
- [Async API design](#async-api-design)
- [Streams and continuations](#streams-and-continuations)
- [SwiftUI and UIKit boundaries](#swiftui-and-uikit-boundaries)
- [Migration](#migration)
- [Exceptions that require evidence](#exceptions-that-require-evidence)
- [Testing concurrency](#testing-concurrency)
- [Reject these patterns](#reject-these-patterns)
- [Primary references](#primary-references)

## Inspect the actual concurrency model

Before changing code, determine:

- the exact Xcode and Swift compiler versions;
- Swift language mode and strict-concurrency checking level for each affected target;
- default actor isolation and any upcoming-feature flags;
- deployment targets and runtime availability;
- whether the target is an app/executable, extension, reusable library, or mixed Swift/Objective-C module;
- the concurrency annotations and language modes of dependencies.

Do not infer behavior from "Xcode 26" or `async` syntax alone. Swift 6.2 and later approachable-concurrency settings materially affect isolation, and targets in one workspace can differ.

Map every change before implementation:

- Who owns each mutable value?
- Which isolation domain protects it?
- Who owns each task and cancels it?
- Who consumes the result and error?
- Which values cross isolation boundaries?
- What can change across each suspension point?

Prefer the least-concurrent correct design. Sequential async code is the default; introduce parallelism only for independent latency, responsiveness, or demonstrated throughput.

## Build and isolation defaults

- New, actively maintained targets use Swift 6 language mode when their dependencies support it; Swift 6 mode enforces complete concurrency checking. Existing Swift 5 targets enable complete checking during incremental migration rather than suppressing warnings.
- New UI-focused app and extension targets can use MainActor default isolation on Swift 6.2+; reusable libraries generally remain nonisolated unless intentionally UI-specific.
- UI-owned models and controller/view mutations are MainActor-isolated unless the module already provides that default.
- Observation and actor isolation are separate contracts. `@Observable` does not make a type thread-safe.
- Use immutable, `Sendable` values to transfer state. Use an actor for shared mutable asynchronous state.
- Use `Synchronization.Mutex` only for a small synchronous critical section when an actor would force an inappropriate async API or substantial complexity. Never suspend while holding a lock.
- Isolation is an execution-safety contract, not a promise of a dedicated thread. Actors are reentrant and do not guarantee FIFO ordering.
- Restore invariants before every `await`; after suspension, revalidate state that may have changed.
- Prefer static isolation annotations to `DispatchQueue.main.async` or runtime assertions. `await MainActor.run` is a safe, statically checked hop for a small localized mutation, but an isolated API is clearer when MainActor ownership is part of the contract.
- Use `@concurrent` only for proven CPU-intensive work that should leave the caller's actor. Async I/O already suspends and normally needs no manual offloading.

Code-size concerns can justify a simpler safe design; they never justify disabling data-race safety.

## Choose the task shape

| Need | Default |
| --- | --- |
| Dependent operation | plain `await` |
| Small fixed set of independent results | `async let` |
| Dynamic, bounded fan-out | throwing or nonthrowing task group |
| Side-effect-only children | discarding task group where available |
| View-lifetime work | SwiftUI `.task` / `.task(id:)` |
| Sync-to-async boundary | owned `Task {}` |
| Deliberately independent lifetime/isolation | exceptional, documented `Task.detached` |

For a task group, bound fan-out: add an initial limited set, then replenish as results complete. Consume results or explicitly wait so errors are not silently discarded.

An unstructured `Task {}` needs a named owner, stored handle when cancellation matters, and an explicit result/error policy. Dropping a task handle does not cancel the work.

`Task.detached` is not a background queue. Prefer a structured call to an appropriately isolated or `@concurrent` function. Use detached work only when deliberately severing inherited actor, task-local, priority, and cancellation relationships is part of the contract.

## Cancellation

Cancellation is cooperative:

- await cancellation-aware APIs where possible;
- call `Task.checkCancellation()` periodically in long synchronous loops;
- install `withTaskCancellationHandler` when cancellation must stop a callback, delegate, stream, or underlying system operation. Its operation still runs when the task was already cancelled, and `onCancel` can run before or concurrently with that operation: keep the handler fast and nonblocking, and synchronize setup/cancellation state so either ordering stops the work;
- use `defer` for cleanup;
- do not swallow cancellation in a broad `catch`, retry it automatically, or present it as an ordinary user-visible failure;
- return partial data only when the API explicitly promises that behavior;
- do not assume canceling one unstructured task cancels another.

Cancellation does not prevent a noncooperative dependency from completing later. For replaceable work such as typeahead search, carry a stable request key or generation and revalidate it, plus cancellation, immediately before publishing the result. Stale success and failure must not overwrite the current request.

Document cancellation at boundaries: what triggers it, what underlying work stops, what cleanup runs, and what the caller observes.

## `Sendable` and value transfer

- Treat `Sendable` as a public thread-safety contract, not a compiler incantation.
- Prefer immutable value snapshots over sharing mutable references.
- Mark concurrently executed closures `@Sendable` and capture only safe values.
- A reference type should conform to checked `Sendable` only when its stored state and synchronization actually satisfy the contract; otherwise isolate it.
- Use `sending` for a disconnected-region transfer contract, primarily when safely transferring a non-`Sendable` value. It is not a blanket move-only rule: `Sendable` values, or an independent copy whose region remains disconnected, may still be reused when the compiler can prove that safe.
- Prefer isolated conformances over runtime `assumeIsolated` workarounds when a conformance is valid only on a global actor.
- Never add `@unchecked Sendable`, `nonisolated(unsafe)`, retroactive sendability, or `@preconcurrency import` merely to make a diagnostic disappear.

An unsafe escape hatch needs a documented invariant covering every mutable access, focused stress/sanitizer tests, and a removal condition where temporary.

## Async API design

- `async` means an operation may suspend; it does not mean parallel or off-main.
- Prefer the SDK's native async API.
- Async functions return values and throw errors normally. Do not retain completion-handler-shaped naming or append `Async` without a compatibility reason.
- When callbacks must remain, keep one canonical implementation and adapt at the boundary rather than duplicating business logic.
- Preserve priority, cancellation, and actor semantics across adapters.
- Avoid blocking semaphores, `DispatchQueue.sync`, or any sync-over-async bridge.

## Streams and continuations

Use `AsyncSequence` for zero-to-many values over time. Every stream contract states:

- single-consumer or multicast behavior;
- normal completion and failure behavior;
- buffering and overflow policy;
- cancellation and producer cleanup.

Choose buffering from the data contract. `AsyncStream`'s bounded policies drop values rather than applying backpressure, so use them only when dropping or coalescing is explicitly acceptable and inspect `yield` results. For lossless delivery, use a producer/consumer boundary that can suspend or acknowledge demand; use an unbounded buffer only when volume is bounded by construction and documented. Always call `finish` and unregister or cancel the producer from `onTermination`.

Use a checked continuation only to adapt exactly-one callback completion. Use a checked throwing continuation when the callback reports failure, and map cancellation distinctly from domain failures:

- resume exactly once on every path;
- handle synchronous callback completion;
- do not assume a continuation cancels legacy work;
- when the adapted API promises cancellation of the underlying work, protect callback-versus-cancellation and pre-cancelled setup races with a one-shot state machine. A synchronous lock-backed state machine is often necessary because callbacks and `onCancel` cannot await; use an actor only when every entry point can cross it safely and the contract does not assume FIFO ordering;
- use `AsyncStream` or another sequence for repeated callbacks/delegates;
- use an unsafe continuation only after measurement proves checked-continuation overhead is significant.

## SwiftUI and UIKit boundaries

- Keep synchronous UI mutations synchronous and MainActor-isolated.
- Use state as the bridge between longer async work and rendering.
- Keep `.task` bodies thin and framework-owned for lifecycle cancellation.
- For `.task(id:)` backed by a noncooperative legacy operation, recheck cancellation and the current request identity before publishing either success or failure.
- Do not perform expensive synchronous CPU work in a MainActor-inheriting task.
- Not every SwiftUI callback is MainActor-isolated. Layout, shape, geometry, and other `@Sendable` closures should capture immutable, `Sendable` snapshots rather than UI models.
- Delegate/coordinator adapters need explicit callback isolation and teardown cancellation. A main-thread convention is not a static guarantee unless the imported API or wrapper expresses it.

## Migration

- Migrate bottom-up, one target or module at a time.
- In Swift 5 mode, enable complete checking and resolve warnings before selecting Swift 6.
- Express existing truths with the smallest annotations; do not redesign the application during diagnostic cleanup.
- Audit public API, protocol-conformance, and ABI effects before changing default isolation.
- Keep `@preconcurrency`, runtime isolation assertions, and unchecked conformances visible and temporary.
- Verify runtime availability for library APIs even when the language feature is compiler-supported.
- Build and test all supported mixed-language and mixed-mode configurations.

## Exceptions that require evidence

Use the main skill's deviation record for:

- `Task.detached`;
- `@unchecked Sendable`, `nonisolated(unsafe)`, or retroactive sendability;
- `@preconcurrency import`;
- `MainActor.assumeIsolated` as a narrowly justified legacy assertion;
- a mutex instead of actor isolation;
- an unbounded task group or stream;
- an unsafe continuation;
- retained callback/GCD implementation where a full async migration is disproportionate;
- non-MainActor default isolation for a new UI-focused target.

The record must identify the exact constraint, safety invariant, verification, and removal condition where applicable.

## Testing concurrency

- Write async tests that directly `await` results.
- Use Swift Testing confirmations or XCTest expectations for true callback/event boundaries, not sleeps. A confirmation does not wait after its closure returns: keep the async closure active until the event occurs, or adapt the callback to an awaited operation/stream. Use an XCTest expectation when that is the appropriate legacy boundary.
- Use fresh fixtures; Swift Testing executes tests and parameterized cases in parallel by default.
- Apply `@MainActor` only when the subject requires it. Do not annotate the entire suite to hide isolation problems.
- Inject a clock, sleeper, or controllable operation. `Task.sleep`, `Thread.sleep`, repeated `Task.yield`, and arbitrary polling are not synchronization.
- Test success, failure, cancellation, owner teardown, stream termination, buffer policy, and continuation single-resume behavior.
- For replaceable requests, force an older request to complete after a newer one and verify that its value or error is discarded.
- For actors, assert invariants under controlled interleaving; never assert scheduler order unless the API guarantees it.
- Run Thread Sanitizer and focused stress/repetition tests for locks, unchecked sendability, and C/Objective-C callback boundaries. TSan supplements compiler checking; it does not prove safety.

See [testing.md](testing.md) for the broader test strategy.

## Reject these patterns

- fire-and-forget tasks with no owner or error policy;
- `Task.detached` as a background queue;
- wrapping an async call in another task merely to await it;
- blocking semaphores or sync-over-async;
- holding a lock across suspension;
- assuming actor state or ordering remains unchanged after `await`;
- sleeps or yields used for correctness;
- unbounded task creation or stream buffering;
- swallowing cancellation;
- blanket MainActor isolation on reusable libraries;
- unsafe annotations used as compiler-error erasers;
- duplicate callback and async business logic;
- serializing a whole test suite to hide shared mutable state.

## Primary references

- [Swift: Concurrency language guide](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/concurrency/)
- [Apple: Adopting Swift 6](https://developer.apple.com/documentation/swift/adoptingswift6)
- [Swift: Concurrency migration strategy](https://www.swift.org/migration/documentation/swift-6-concurrency-migration-guide/migrationstrategy/)
- [Swift: Common concurrency migration problems](https://www.swift.org/migration/documentation/swift-6-concurrency-migration-guide/commonproblems/)
- [Swift Evolution: Structured concurrency](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0304-structured-concurrency.md)
- [Apple: `TaskGroup`](https://developer.apple.com/documentation/swift/taskgroup)
- [Apple: `Task` and cancellation](https://developer.apple.com/documentation/swift/task)
- [Apple: `withTaskCancellationHandler`](https://developer.apple.com/documentation/swift/withtaskcancellationhandler%28operation%3Aoncancel%3Aisolation%3A%29)
- [Swift Evolution: Controlling default actor isolation](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0466-control-default-actor-isolation.md)
- [Swift Evolution: Async function isolation](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0461-async-function-isolation.md)
- [Swift Evolution: `Sendable`](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0302-concurrent-value-and-concurrent-closures.md)
- [Apple: `AsyncStream.Continuation`](https://developer.apple.com/documentation/swift/asyncstream/continuation)
- [Apple: `AsyncStream` buffering policies](https://developer.apple.com/documentation/swift/asyncstream/continuation/bufferingpolicy)
- [Apple: `CheckedContinuation`](https://developer.apple.com/documentation/swift/checkedcontinuation)
- [Apple: Calling Objective-C APIs asynchronously](https://developer.apple.com/documentation/swift/calling-objective-c-apis-asynchronously)
- [WWDC25: Explore concurrency in SwiftUI](https://developer.apple.com/videos/play/wwdc2025/266/)
