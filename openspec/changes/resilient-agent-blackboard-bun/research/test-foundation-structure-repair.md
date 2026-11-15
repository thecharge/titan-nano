# Shared vendor testing foundation repair

## Objective and scope

This continues task 32.2 after the product and verification tooling structure repairs. The draft factors fresh workflow, schema, configuration and protocol values in shared vendor factories and fixtures. It preserves isolated mutable workflow values for every invocation. Event callbacks and duplicate-continuation assertions use shallow local functions. Vendor protocol literals remain independent fixture data that checks the pinned adapters.

The three shared vendor factory modules replace unbounded reads with the existing readFileBytes utility and central IoLimit ceilings. Candidate digest sidecars use HashBytes. Vendor state, call records and the fixture's fixed source and delivered files use DataBytes. Decoding follows the bounded Buffer read. Writes in these modules use Buffer values. The test-factories manifest now declares its workspace dependency on streams. Its matching lockfile entry has been updated and still requires frozen-lock validation. No dependency version changes are intended.

New flat case tables require an actual Codex or Claude stubbed session call record at the byte ceiling to succeed and one byte above it to fail. Each backend has two positive and two negative cases, covering new and resumed sessions. The shared fixture pads the actual recorded call after a native event and retains all existing answer and process-exit assertions. Existing transport, recovery, retry, request-turn, duplicate-continuation and host-protocol suites remain required.

## Current verification

The first static check caught the new streams import before its manifest dependency had been declared. The manifest and matching workspace lock entry were corrected, and the task checkout received its corresponding local workspace link. Repeated Biome and typechecking passed. The shared factory and protocol draft passed the actual sibling reference structure checker. Adding the boundary cases then exposed a pre-existing deep Claude fixture environment object. That environment is now named inside each query callback so it retains per-query environment capture. Expanded static checks remain in progress.

No runtime suite, fault sequence, installed probe or complete hook has run for this draft. The preceding tooling repair is in its complete staged hook. Keep verification serialized and preserve resources and deadlines. No live vendor call or Titan skill invocation is authorized by this record.

The expanded draft passed typechecking, schema ownership and flat-case checks. Reference inspection found zero findings across all eleven touched source files, including the new eight-case boundary registration. Frozen lockfile validation ran in a private manifest-and-patch snapshot with a private cache. Bun install --lockfile-only --frozen-lockfile --ignore-scripts exited zero and retained identical lockfile bytes. The isolated snapshot is /tmp/titan-foundation-lock-jDiJnG. It did not install into or change the shared prepared dependency cache. Runtime acceptance has not run.

## Runtime and fault evidence

The initial selection passed all 178 tests across ten files in 92.17 seconds. The restored selection passed the same 178 tests in 89.18 seconds. Both commands exited one for 230 omitted whole-product coverage gaps. All eight new exact-boundary and over-limit session cases passed, alongside existing native transport, host, recovery, retry and request-turn cases. Evidence is /tmp/titan-test-foundation-first.log and /tmp/titan-test-foundation-restored.log.

Six type-correct faults were caught. Omitting the call-record byte cap failed four cases, replacing the checker recovery task failed eighteen, omitting native retry allowance failed six, discarding the request-turn null boundary failed eight, changing the host answer failed two and omitting cancellation failed three. Source bytes were restored in finally and restored typechecking passed. Evidence is /tmp/titan-test-foundation-mutants.json and /tmp/titan-test-foundation-restored-types.log. Rebuilt installed-package acceptance exited zero with every existing installed table. Evidence is /tmp/titan-test-foundation-installed.log. Task 32.11 remains open until complete ordinary gate evidence passes and publication is confirmed. Full testing-source parity remains open. No live vendor call or Titan skill invocation occurred.
