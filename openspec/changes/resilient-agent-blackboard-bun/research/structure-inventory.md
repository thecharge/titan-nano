# Reference structure inventory

## Baseline

The read-only inventory inspected all 961 tracked TypeScript and MJS files under apps, packages, tooling and testing at Titan revision 283124680861dbebfa22545cf5b600b38f03ba5a. It passed their 2730740 source bytes to the sibling repository's exported checkSource function. The driver capped files at 2048, source bytes at one MiB per file and thirty-two MiB overall, and findings at 8192. It changed no source or index file. Evidence is /tmp/titan-reference-inventory.ts and /tmp/titan-reference-inventory.json.

The checker reported 229 nesting-depth, 266 object-depth and one synchronous-API candidate. The distribution is 453 in testing, 24 in tooling and 19 in product packages. These are baseline observations, with line numbers bound to that revision. They do not establish complete rule parity or replace the separate literal, schema, boundary, comment and configuration jobs.

The synchronous-API candidate is testing/factories/isolation.ts line 43. That assertion expects the offline guard to reject Bun.spawnSync before a process starts. It must retain that security assertion. This inventory has not classified it as a synchronous operation that actually executes.

## Product contracts

The first repair separates deeply nested unused-policy workspace records, their strict schemas, hook workspace metadata and request-turn JSON schema fields into named values in their existing owning modules. Public exports, field names, defaults, strictness, source patterns and required response fields remain the contract. Existing behavior tests and type-correct faults must prove these properties before publication. These four files had ten object-depth findings in the baseline and have zero findings under the same checker after the draft repair. Typechecking passed. Runtime tests must wait for the separate document-link gate to finish.

The other product findings remain in artifact content, event paging, journal streaming, capped concurrency, credentials and request paging. Their control flow needs focused repairs that retain cancellation, finite buffers, error classification, descriptor closure and paging boundaries. Testing and tooling findings also remain. Tasks 32.1 and 32.2 stay open. The full blocking structure job must cover these owners after their repairs. No baseline allowlist or broad exception has been added.

The draft also adds direct contract cases through the public requestTurnOutputSchema and HookManifestSchema exports. They exercise default and typed results, null results, required request fields, envelope strictness, workspace containment and catalog value types. Existing unused-policy admission cases remain required. After merging the committed link increment, dependency preparation initially failed because the snapshot linker is not idempotent. The four newly pinned external links were added to this task-created checkout from the prepared cache. No hook or shared dependency cache was changed. Typechecking and static policy checks must be observed again before runtime verification.

The reference checkout was at b6fe5be9bd93b11da5a7e05559ec0f9c5b931a0b. Its structure checker, hygiene rules and AST helper were clean tracked files. Their Git object hashes were 005f3cdc949cac86667e924de6bbc592449a007b, 585e927beff9e531faf4101a0251008695e1f96e and aac281bb8256df2c26874a3e0b5825749513afd2. This later inventory uses those actual sources rather than assuming the earlier parity review still describes the sibling checkout.

The repaired selection passed all 150 cases, with a nonzero focused command for omitted whole-product coverage. Five type-correct faults were caught, original bytes were restored and restored typechecking passed. The repeated restored selection passed all 150 cases again. The rebuilt installed-package probe exited zero and retained every existing Codex and Claude acceptance table. Evidence and exact timings are in implementation-state.md. The complete ordinary gates and publication remain required.
