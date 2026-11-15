# @titan/test-factories

## Responsibilities

Owns reusable case descriptors and the shared parameterized unit suite runner. It enforces the minimum case count per polarity.

## Public contract

`positive`, `negative` and `rejected` describe expected return or throw behavior. `unit` parses the suite and registers flat positive and negative `test.each` cases using the supplied subject. Cases are serial by default. An isolated table can opt into `TestSchedule.Concurrent` as the fourth argument; the offline driver limits concurrent cases to eight. Temporary homes, ports and cleanup must remain fixture-owned. Mixed agent plans and the eight-writer knowledge tests keep serial case registration because they already exercise internal process parallelism. The complete coverage run remains in one process so function counts retain their original meaning.

## Verification

Run offline case-count and parameterized suites. Missing positive or negative cases fail suite construction. Rejection observations distinguish an expected operational outcome from a successful result.

## Limits

Two cases per polarity are a minimum, not sufficient coverage by themselves. Factories must exercise actual behavior and avoid assertions that merely mirror implementation constants.

`agentSpec` supplies a checked invocation for adapter transport contracts. Vendor-specific clients remain in their owning adapter test directories.

`observeVendorSession` and `observeVendorIsolation` share transport assertions across adapter-owned suites. Isolation uses bounded barriers and checks that the survivor process is alive when its peer is cancelled.

`observeVendorContinuation` checks a second message through the same or a new session handle, with missing and mismatched synthetic native state.

`observeVendorRecovery` drives an actual engine through interrupted checker execution and explicit resume. It checks durable recovery accounting, completed worker reuse, native session identity and file publication using adapter-owned SDK clients.

observeVendorRetry and inspectVendorRetry share the retry contract and drive final-attempt workers and checkers through structured native retries. It checks session identity, actual child exit, cumulative usage, file delivery and persisted exhaustion. Separate daemon cases exercise the agent host and restart and are reused by the installed archive probe.

The shared recovery checkpoint assertion checks retained worker and checker phases during long backoff. Integration, daemon and installed cases require unchanged sessions, dates, execution counts and quality attempts through controls. The native backoff cases compare actual CLI, HTTP and stdio MCP snapshots before interruption.
