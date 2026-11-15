# @titan/testing

## Responsibilities

Owns unit, integration and end-to-end cases, including adapter contracts, shared case tables, product fixtures and test support. Default execution runs inside the offline Podman boundary.

## Public contract

This workspace is a test aggregation package with no product runtime API. Invoke it through `bun run test` at the repository root. Tests use declared product dependencies and the shared framework and factory packages.

## Verification

The default suite resolves its complete test inventory before verifying loopback availability and external network denial, running tests and checking full product source coverage. Focused files and tier directories must each resolve to regular tests. Missing paths, symbolic files or directories, empty selection and exhausted discovery budgets fail before execution. Overlapping selectors run each selected test once. Focused runs retain complete coverage requirements. `testing/e2e/sdk-plan.test.ts` checks two independent eight-step mixed Codex/Claude SDK graphs, live parallel barriers, checked file ancestry and isolated file failures. The installed archive probe repeats its shared case table.

## Limits

Legacy suites are not all migrated to flat tables with two positive and two negative cases. Coverage and installed acceptance are separate required gates; complete reference standards and release acceptance remain open. Live credentials and vendor calls do not belong in default fixtures.

## Layout and dependencies

Register tests only under unit, integration or e2e. Keep case tables in cases, executable helpers in factories and vendor responses in fixtures. Adapter transport contracts and process-scope cases belong to integration. Product packages do not carry test dependencies. The aggregation workspace may exercise public adapter APIs and the actual pinned SDK with stubbed executables. Framework cannot depend on factories; factories cannot depend on aggregation. Required package policy and flat-test checks reject reversed dependencies and misplaced test sources.

Mixed parallel SDK cases prepare the same versioned vendor helper used by the installed probe. Preparation runs the pinned Bun builder in a separate process with bounded diagnostics and a deadline, and bundles the current checkout helper. This avoids repeated source imports in each vendor process. Invalid fixture sources fail preparation. Task, scope, role, search, file, recovery and overlap assertions remain required. Container budgets and test deadlines stay unchanged.

Run `bun run test testing/integration/native-setup-recovery.test.ts testing/e2e/native-setup-process.test.ts` for setup delivery proof. The integration table covers worker and checker refusals, durable dispatch ordering, legacy records, uncertain delivery and retry limits. The process table competes for one real owner binding through both pinned SDKs, includes daemon restart and checks files, completed peers and usage. The installed probe reuses its four cases with the packaged executable. Selected paths still fail omitted whole-product coverage; they do not replace the full gate.

Native audit cases use `bun run test testing/integration/native-audit.test.ts testing/integration/native-tools.test.ts testing/e2e/native-workflow.test.ts` after type checking. Shared tables cover two-entry metadata, acknowledgement timing, writer refusal, safe unknown names and forged execution ownership. Engine cases deliberately ignore a failed tool response and require blocked artifact and private knowledge publication. The existing native workflow table checks committed metadata through event pages for both pinned SDKs over HTTP and stdio, including the installed-package probe. Complete coverage still requires the full suite.

Native event projection cases use `bun run test testing/unit/native-events.test.ts testing/integration/native-phase-guard.test.ts testing/e2e/native-workflow.test.ts` after type checking. Shared fixtures cover both SDK shapes, invalid metadata, bounded block counts and ordinary event preservation. Raw credential fixtures require scanning before projection. Versioned vendor stubs emit full native read responses, and source and installed workflow cases require safe board projections without entry bodies. Selected paths do not replace full coverage.

Source comment cases use `bun run test testing/unit/source-comments.test.ts testing/integration/hook-documentation.test.ts` after type checking. Shared syntax and filesystem fixtures retain original bytes, cover every maintained root and suffix, distinguish strings and JSX text from actual comments, and reject missing or excessive inventory. Hook cases require comment failures to block source and documentation scopes. The standalone read-only command is `bun run check:source-comments`.
