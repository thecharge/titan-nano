## ADDED Requirements

### Requirement: One command runs the complete offline check

The root `package.json` SHALL have the script `check`. `bun run check` MUST verify the staged Git snapshot, which is the snapshot that the commit hook verifies. It MUST first check the hook policy and scan the snapshot files for secrets. It MUST then run these 19 commands in this order, and stop at the first that fails:

1. `biome ci --error-on-warnings .`: format and lint;
2. `bun run typecheck`: the type check;
3. `check:typescript-policy`: strict settings in every package;
4. `check:lint-policy`: lint rules and source ownership scopes;
5. `check:schemas`: data shapes belong to schemas;
6. `check:flat-tests`: tests only register cases;
7. `check:source-comments`: no comments in owned source;
8. `check:format:docs`: Markdown and configuration format;
9. `check:spelling`: spelling;
10. `check:promises`: no direct `Promise.all` or `Promise.allSettled`;
11. `check:async-fs`: asynchronous file access;
12. `check:unused`: no unused files or exports;
13. `check:boundaries`: package boundaries;
14. `check:package-policy`: package manifests;
15. `check:specs`: specification structure and the acceptance map;
16. `check:docs`: plain language in the specifications and documents;
17. `check:links`: document links;
18. `check:readmes`: package README files;
19. `bun run test`: the default suite inside the offline boundary, with the guard and coverage bar.

When every changed file is documentation, `bun run check` MUST skip command 19 and report that it used the documentation scope. The dependency rule is a test in command 19, as in spec backend-plugins. The command `check:scenarios` reports pending scenarios and is part of the release gate, not of this command. The local commit and push hooks MUST run this same command on the staged snapshot and on each outgoing snapshot. GitHub Actions stays disabled, so this command MUST NOT depend on continuous integration. Each command MUST print its exit code and its duration.

#### Scenario: All steps pass

- **WHEN** `bun run check` runs on a clean staged snapshot of `main`
- **THEN** it exits with code 0, and prints the exit code 0 and duration of each of the 19 commands

#### Scenario: A failing step stops the check

- **WHEN** a file has a type error and `bun run check` runs
- **THEN** it exits with a code other than 0 after command 2
- **AND** it does not start command 3

#### Scenario: Documentation-only change skips the suite

- **WHEN** every changed file in the snapshot is documentation
- **THEN** `bun run check` reports the documentation scope and runs commands 1 to 18
- **AND** it does not start command 19

### Requirement: Specification-only commits have a runnable check

Before the root Bun workspace exists, each specification commit SHALL pass `python3 -I tooling/scripts/check-specs.py` and strict OpenSpec validation. Once `package.json` exists, commits and pushes MUST pass their scoped gates below. The complete `bun run check` MUST pass in CI before merge or release. Historical quote verification MUST be reported separately when the source corpus is missing. A structural pass MUST NOT be reported as a product test pass.

#### Scenario: Check on a specification-only checkout

- **WHEN** the checkout has OpenSpec files and no root `package.json`
- **THEN** the specification check runs without installing a product or calling a model
- **AND** its output says that no product tests ran

### Requirement: A release proves installation and use

A full release SHALL pass a clean-install test from its packed package outside the repository. That test MUST run `titan --help`, `titan doctor` and one complete example with fake backends. It MUST verify that the guide, schema, examples and helper files are in the package. Every claimed platform and backend MUST have recorded test evidence. The support matrix MUST list each claimed combination, versions, evidence paths and limitations. Pending scenarios MUST block full release, not a correctly labeled stage preview. An unverified backend MUST be listed as experimental and MUST NOT be `ready` by default. No delivery date MUST be claimed from the task count alone.

#### Scenario: Packed package misses a helper

- **WHEN** the packed package lacks the Python helper needed by a claimed Antigravity backend
- **THEN** the release check fails before publishing

### Requirement: TypeScript runs in strict mode

The root `tsconfig.json` SHALL set `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` to `true`. Every package MUST extend it. A package MUST NOT turn one of these off. Bun runs TypeScript without checking its types, so `tsc --noEmit` MUST check them.

#### Scenario: Unchecked index

- **WHEN** a file reads `steps[0].id` from an array `steps` with no check that the element exists
- **THEN** `tsc --noEmit` fails and names the file and line

#### Scenario: A package turns strict off

- **WHEN** `packages/board/tsconfig.json` sets `"strict": false`
- **THEN** a test of the configuration fails and names `packages/board/tsconfig.json`

### Requirement: Biome formats and lints the code

The root `biome.json` SHALL turn on the recommended rules, the rules of the `project` domain, and the rule `noFloatingPromises` as an error. `biome ci` MUST run with `--error-on-warnings`. In the probe, `biome ci` without it exited with code 0 on a file with 20 warnings. Required ownership, project, promise and import-cycle checks SHALL retain error severity. Any exception SHALL require a reviewed policy change; inline suppression comments are forbidden by the development rules.

#### Scenario: A promise with no await

- **WHEN** a function calls an async function and neither awaits nor returns its promise
- **THEN** `biome ci --error-on-warnings .` fails with `lint/nursery/noFloatingPromises` for that line

#### Scenario: An import cycle

- **WHEN** `a.ts` imports `b.ts` and `b.ts` imports `a.ts`
- **THEN** `biome ci --error-on-warnings .` fails with `lint/suspicious/noImportCycles`

### Requirement: Work goes to main in small, checked commits

Developers SHALL commit to `main` in small, checked increments. Each commit MUST pass its applicable local gates before it is pushed. Before the workspace exists, use the specification check above. Afterward, use the scoped commit and push gates. A failed required local check MUST block publication. GitHub Actions MUST remain disabled unless the user explicitly requests it. General permission to commit or push does not authorize Actions. The repository MUST contain no runnable Actions workflow. Local policy fixtures MUST reject injected workflows. Before each push, verify that repository Actions is disabled. If this cannot be established, publication MUST stop.

#### Scenario: A push that breaks a test

- **WHEN** a local outgoing-revision fixture fails one required test
- **THEN** the push gate refuses publication and names the failing test

#### Scenario: GitHub Actions requires explicit authorization

- **WHEN** a workflow is injected into the repository without explicit user authorization
- **THEN** the local policy gate refuses it, including a manually triggered workflow
- **AND** publication requires an observed disabled repository Actions setting

### Requirement: Commit subjects follow Conventional Commits

Each new commit subject SHALL have the form `<type>(<scope>): <description>`, as in Conventional Commits 1.0.0. The scope is optional. The type MUST be one of `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, `revert` or `style`. A change that breaks the backend port or the HTTP API MUST have `!` before the colon. The script `tooling/scripts/check-commits.ts` MUST check every commit pushed after this rule. Commits already on `main` keep their subjects.

#### Scenario: Subject in the old form

- **WHEN** `tooling/scripts/check-commits.ts` checks the subject `Add hive and approvals`
- **THEN** it exits with code 1 and prints `FAIL Add hive and approvals`

#### Scenario: Subject in the new form

- **WHEN** `tooling/scripts/check-commits.ts` checks the subject `docs(openspec): add test strategy`
- **THEN** it exits with code 0

### Requirement: Versions follow SemVer

Each package of `titan` SHALL have a version in the form MAJOR.MINOR.PATCH, as in SemVer 2.0.0. A change that breaks the backend port MUST raise the major version of `@titan/core`, and the port's `specificationVersion` with it. The version check of plug-ins is in spec backend-plugins.

#### Scenario: A breaking port change

- **WHEN** a commit with the subject `feat(core)!: rename start to open` is released
- **THEN** the major version of `@titan/core` is one higher than in the release before

### Requirement: Each design decision is written down

Each decision that changes the structure, a dependency, an interface or how `titan` is built SHALL be a numbered decision in `design.md`. Each decision MUST say what was chosen, why, and what else was considered. A decision MUST NOT be changed in silence: a later decision replaces it and names it.

#### Scenario: A new dependency

- **WHEN** a commit adds a new package to the catalog in the root `package.json`
- **THEN** the same commit adds or changes a decision in `design.md` that names that package

### Requirement: No key is ever written to the repository or the record

Keys SHALL come only from environment variables. After each live test, a check MUST read every file in the run record, the board, `TITAN_HOME` and the repository. It MUST fail when a file holds the value of a key variable that was set. The check MUST print only the file name and the variable name, never the value.

#### Scenario: Key value in a record file

- **WHEN** a live test writes the value of `ANTHROPIC_API_KEY` into a run record file
- **THEN** the check fails and prints the file name and `ANTHROPIC_API_KEY`
- **AND** the output does not hold the key's value

### Requirement: Delivery stages have separate evidence gates

The delivery stages in design decision 36 SHALL preserve every capability of this change. A stage preview MUST state its implemented subset and MUST NOT claim the full change is released. The full release MUST require every task complete, all required scenarios executed, the packed-package checks and live evidence for every claimed backend and platform. Missing historical sources MUST block reliance on those historical claims. They MUST NOT be represented as reproduced evidence.

#### Scenario: Preview presented as a full release

- **WHEN** a package implements only the first local delivery stage
- **THEN** its release report lists the missing stages and refuses full-release status

### Requirement: Effectiveness claims need a fixed comparison

Before a claim that the policy or improve loop improves outcomes, the project SHALL save a benchmark protocol before running it. It MUST compare one agent, a fixed Titan workflow and adaptive Titan on the same tasks, models, tools and total allowances. Scoring MUST use an independent rubric and checks unavailable to the improver. The report MUST include correctness, wall time, waiting time, tokens, complete or partial cost, failures and repeated-run variation. A claim MUST be limited to measured tasks and uncertainty. Failed safety or correctness gates MUST block promotion regardless of reward.

#### Scenario: Reward rises but correctness falls

- **WHEN** adaptive Titan has higher reward but fails a correctness gate that the fixed workflow passes
- **THEN** the comparison rejects promotion and makes no improvement claim

### Requirement: Local hooks run bounded checks without rebuilding the product

The repository SHALL use one pinned Lefthook configuration and existing scripts. Pre-commit MUST check staged formatting, lint, secrets, affected package rules and changed specifications or documentation. Commit-message checks MUST enforce the existing subject rule. Pre-push MUST run `bun run check:affected` for the pushed changes. Product changes MUST include affected types, unit and integration tests, isolation checks and a small CLI, HTTP and MCP smoke set. These smoke tests MUST use stubbed vendors. Hooks MUST NOT install dependencies, download models, build documentation, run live services or run mutation testing. Missing required local tools MUST fail with setup instructions. Hooks MUST NOT rewrite or restage files automatically.

#### Scenario: Ordinary push does not run the full pipeline

- **WHEN** one workflow package changes and pre-push runs
- **THEN** the selected checks and smoke set run without a package rebuild, site build, live call or full coverage pass

#### Scenario: Staged content differs from the working file

- **WHEN** a staged file contains a secret but its unstaged working copy removes it
- **THEN** pre-commit checks the staged snapshot and refuses the commit without printing the secret

#### Scenario: Local checker is missing

- **WHEN** the pinned lint executable is absent when a commit runs
- **THEN** the hook fails with the install command and performs no automatic network access

### Requirement: Affected checks include downstream users and uncertain changes

`check:affected` SHALL select changed packages and all transitive consumers in both the base and proposed dependency graphs. It MUST include declared dependencies, source imports and test dependencies. Pre-push MUST inspect every updated ref and its complete outgoing commit range. It MUST verify the outgoing revision rather than unrelated working-tree content. Secret checks MUST include all outgoing commit changes, including content later removed. Added, deleted, renamed and untracked local input files MUST be accounted for when checking a working tree. File discovery MUST preserve spaces and use Git's zero-byte filename separators. A missing base, unknown path owner or invalid graph MUST select the full relevant offline checks. Changes to the lockfile, shared types, root configuration, test guard or selector MUST select all product packages. A docs-only change MUST run documentation and specification checks without product end-to-end tests.

#### Scenario: Shared contract changes downstream behavior

- **WHEN** a core output type changes while only a downstream adapter test exposes the failure
- **THEN** the selector includes the adapter and fails on that test

#### Scenario: Earlier outgoing commit is missed by a head-only diff

- **WHEN** two commits are pushed and only the earlier one changes the runner
- **THEN** the selector includes runner checks from the complete outgoing range

#### Scenario: Deleted dependency edge hides a consumer

- **WHEN** the proposed manifest removes an edge that existed in the base graph
- **THEN** the former consumer remains selected for verification

#### Scenario: New branch has no usable comparison base

- **WHEN** pre-push cannot resolve a trustworthy base for a new branch
- **THEN** it runs the full relevant offline checks and reports the fallback

#### Scenario: Documentation edit stays small

- **WHEN** only a guide paragraph changes
- **THEN** documentation, link and specification checks run without product tests or builds

#### Scenario: Known acceptance evidence stays small

- **WHEN** an exported snapshot changes only the exact registered acceptance map and permitted documentation, with regular or absent file modes
- **THEN** every documentation-scope command and secret check runs without product tests or builds
- **AND** staged and outgoing evidence is selected from its own comparison rather than unstaged source

#### Scenario: Unknown evidence stays full

- **WHEN** a tabular file is not the registered acceptance map, the map has executable or symbolic mode, or source changes accompany it
- **THEN** the hook keeps full scope
- **AND** an unresolved comparison cannot classify the map as documentation

#### Scenario: Invalid acceptance evidence blocks delivery

- **WHEN** the registered map contains invalid ownership or status, omits a scenario, or includes a credential
- **THEN** specification validation or secret scanning refuses the snapshot
- **AND** choosing documentation scope does not turn that refusal into success

#### Scenario: Unstaged fix cannot certify a pushed commit

- **WHEN** an outgoing commit has a type error but an unstaged working-tree edit fixes it
- **THEN** pre-push checks the outgoing revision and fails on that type error

### Requirement: Reused check results match their complete inputs

Any reused local result SHALL match the checked content, base revision, selected files, test fixtures, command, tool versions, lockfile and configuration. Only successful results MAY be reused. Dirty and staged snapshots MUST have distinct identities. A missing or mismatched receipt MUST rerun the check. CI MUST independently run the complete checks without trusting a local receipt. A timeout or interrupted job MUST fail, never become a cached success. Reuse is optional; correctness MUST NOT depend on it.

#### Scenario: Fixture changes after a passing check

- **WHEN** a vendor response fixture changes after the affected tests pass
- **THEN** the old receipt is rejected and those tests run again

#### Scenario: Working copy passes but staged snapshot fails

- **WHEN** a passing receipt describes unstaged content that differs from the index
- **THEN** the commit cannot reuse it for staged verification

#### Scenario: Interrupted test leaves an old receipt

- **WHEN** a test times out after a prior successful run
- **THEN** the timeout fails the current gate and cannot refresh its receipt

### Requirement: Check speed is measured without dropping required work

Each check SHALL report selected scope, duration, outcome and reused results. Record tool versions, host details, cold or warm state, total elapsed time and the slowest checks. Initial targets are 5 seconds for pre-commit, 15 seconds for an ordinary affected push and 60 seconds for the complete offline CI run. These are guesses to measure, excluding dependency installation. Measure documentation, one-package, shared-contract and guard-change cases separately. A missed target MUST report a performance regression and keep every correctness check enabled. The benchmark task MUST remain open until repeated measurements exist. Unknown-base full fallbacks MUST be reported separately from ordinary pushes.

#### Scenario: Fast push omits a required check

- **WHEN** a hook reports under 15 seconds but leaves out a selected integration test
- **THEN** verification fails for missing coverage of the selected scope

#### Scenario: A slow check is visible

- **WHEN** an ordinary affected push takes 24 seconds
- **THEN** its report names the slow checks and missed target without skipping work or claiming the target was met

### Requirement: Engineering rules match the reference project

Product code, tooling and tests SHALL follow the applicable engineering rules of the sibling `scratch-pad` repository. Closed values MUST be enums in constants. Data shapes MUST be Zod schemas in types, and behavior contracts MUST be defined there. User-facing text MUST belong to messages. Only config MUST read environment values and own addresses, defaults and limits. I/O MUST be asynchronous in product code, tooling and tests. File data MUST use buffers; streams MUST be used where they avoid whole-file, output or history accumulation. Heavy initialization MUST be lazy, shared state bounded and parallel work capped. Parallel batches MUST use the shared capped utility with lazy tasks. Direct Promise.all and Promise.allSettled use MUST fail the blocking source check. Functions MUST stay shallow. Tests MUST use the reference tiers, shared general and testing utilities, factories and reusable case builders. Every test subject MUST have at least two positive and two negative cases executed through `.each`. Tests MUST remain flat; setup and cleanup MUST be asynchronous and owned by shared fixtures. Formatting, lint, spelling, secrets, schemas, package boundaries, unused code, rule ownership, documentation and skill freshness MUST have blocking checks. Exceptions MUST be explicit, reviewed and bounded; a new ignore MUST NOT hide an unfinished repair. E2E verification MUST retain the reference granularity and measure its faster execution. The reference standard for complete product line and function coverage MUST apply.

#### Scenario: Malformed vendor data enters a typed path

- **WHEN** a stub returns an object whose required usage field has the wrong type
- **THEN** the owning adapter rejects it with a typed error before it reaches run accounting

#### Scenario: Uncapped promise aggregation

- **WHEN** owned product, tooling or test source calls or references Promise.all or Promise.allSettled directly or by a computed member
- **THEN** staged commit and outgoing revision verification fail
- **AND** dependency and generated output files are not treated as owned source

#### Scenario: Capped tasks retain parallel execution

- **WHEN** tasks are submitted through the shared utility with a cap of two
- **THEN** two tasks overlap without exceeding the cap and results retain input order
- **AND** ordinary failure drains started work while settlement retains each failure and continues queued work

#### Scenario: Structured reads stop at their byte budget

- **WHEN** a valid configuration document, server address document or HTTP response exceeds its central byte limit
- **THEN** the reader rejects it before parsing and closes the active stream
- **AND** exact-boundary binary input and reused input buffers retain every byte

#### Scenario: A pure calculation has a rationale comment

- **WHEN** a helper has an inline rationale comment under the reference no-comment rule
- **THEN** the structure check rejects the comment and the rationale moves to the relevant technical document

#### Scenario: Synchronous filesystem import is rejected

- **WHEN** owned product, tooling or test source imports or reexports a synchronous filesystem function, including an alias
- **THEN** staged and outgoing revision verification fail with its path and line
- **AND** default, namespace and opaque direct module access cannot hide those functions
- **AND** oversized source fails its byte budget before parsing

#### Scenario: Explicit asynchronous filesystem access remains available

- **WHEN** owned source uses promise filesystem APIs or named stream APIs
- **THEN** the filesystem rule accepts it
- **AND** negative source strings remain reference data and dependency files remain outside owned source

#### Scenario: Shallow product contracts retain their validation

- **WHEN** unused-policy records, hook workspace schemas and request-turn envelope fields are factored into named values in their owning product modules
- **THEN** public exports retain their source patterns, defaults, strictness, required fields, typed results and request count ceiling
- **AND** direct positive and negative contract cases and the existing behavioral suites preserve those contracts without adding source exceptions

#### Scenario: Shallow stream readers retain limits and cleanup

- **WHEN** journal framing, credential reads, artifact ranges, event pages and request pages use shallow control flow in their owning modules
- **THEN** the same byte limits, digest checks, request identity checks and continuation cursors apply
- **AND** journal records at the byte ceiling are accepted, records above it are refused and owned descriptors close after completion or refusal

#### Scenario: Competing capped failures retain the first reason

- **WHEN** two started tasks reject while later tasks remain queued in the shared capped utility
- **THEN** the first rejection remains the outcome even when its reason is zero, null or undefined
- **AND** queued tasks do not start and the utility waits for every already-started task to finish

#### Scenario: Shallow verification tooling retains refusals

- **WHEN** inventory, package, hook, source discovery, bounded output and installed request checks use shallow control flow in their owning tooling modules
- **THEN** aggregate allowances, dependency directions, public exports, revision checks, cleanup and request decision assertions remain enforced
- **AND** malformed coverage records cannot replace an unfinished record or end without an active source

#### Scenario: Shared vendor fixture records have finite reads

- **WHEN** a new or resumed Codex or Claude stubbed session records its native call at the shared byte ceiling
- **THEN** the existing answer and process-exit checks pass
- **AND** a record one byte above the ceiling fails the bounded read before decoding
- **AND** fresh workflow and protocol fixtures retain existing recovery, retry, cancellation and request-turn behavior

#### Scenario: Shallow request fixtures retain their acceptance assertions

- **WHEN** request page and MCP acceptance factories use named local functions for setup and refusal checks
- **THEN** every existing pagination, byte, identity, authority, decision, restart and cleanup assertion remains enforced
- **AND** omitted foreign identities, damaged cursor positions, byte pressure, forged authority and repeated decisions make their existing cases fail

### Requirement: Unused source verification is a blocking command

Staged commits and outgoing revisions SHALL run the pinned unused-source checker without installation, caching, Git-ignore filtering or writes. The admitted policy SHALL cover maintained application, package, tooling, test-helper and vendor-fixture sources. Unused internal files and exports, unused dependencies, unresolved imports and duplicate exports SHALL fail. Public manifest exports SHALL identify intended package entry points. Root dependencies loaded through central tool settings MAY have exact documented bindings; missing bindings, added exemptions, broader exclusions or omitted workspaces SHALL fail policy admission. Product package dependencies SHALL have no exemptions. The check SHALL fail on stale configuration hints.

#### Scenario: Maintained unused code cannot be ignored

- **WHEN** an internal file or export, unused dependency, duplicate export or unresolved import is added to a maintained workspace
- **THEN** the read-only checker fails and original source bytes remain unchanged
- **AND** a Git-ignore entry cannot hide an unused file

#### Scenario: Used workspace source remains valid

- **WHEN** a declared workspace imports its internal source and has no unused dependencies or duplicate exports
- **THEN** the same pinned checker passes without rewriting source

#### Scenario: Unused policy cannot gain silent exemptions

- **WHEN** the checker policy adds a dependency exemption, suppresses export checks, omits a workspace or exceeds its input budget
- **THEN** admission fails before executing the checker
- **AND** a missing dynamic tool binding also fails before execution

#### Scenario: A failed unused check blocks the shared gate

- **WHEN** the unused checker returns a failed status during staged or outgoing verification
- **THEN** the shared snapshot gate remains unsuccessful
- **AND** removing its registered command fails the negative hook fixture

### Requirement: Packages expose one checked dependency direction

Each workspace SHALL declare its dependencies and public exports. The root MUST pin Bun, TypeScript, Biome and hook versions and commit its lockfile. CI installation MUST use the frozen lockfile and fail on drift. Runtime dependencies MUST not rely on undeclared root development tools. Cross-package imports MUST use those exports, not another package's source path. The package graph check MUST reject cycles, undeclared workspace imports, vendor imports outside their adapters and product imports from test fixtures. Tests MAY depend on product packages. The core MUST remain independent of product packages. New packages MUST have a clear owner and public contract. The design layout MUST describe ownership without requiring empty packages before their delivery stage. Native Bun workspaces MUST remain the default; another build scheduler MUST require measured need.

#### Scenario: Deep import bypasses a public contract

- **WHEN** runner imports `../backend-codex/src/session.ts` directly
- **THEN** the boundary check fails with both packages and the offending import

#### Scenario: Manifest cycle spans packages

- **WHEN** workflow and board declare dependencies on each other
- **THEN** the graph check fails and prints the cycle

#### Scenario: Product code imports a test fixture

- **WHEN** server imports a fake vendor response from `testing/fixtures`
- **THEN** the boundary check refuses that import

#### Scenario: Later-stage package is not created yet

- **WHEN** the foundation stage has not implemented a later adapter
- **THEN** the ownership map permits its absence and acceptance cases remain explicitly pending

### Requirement: Documentation formatting is a required local gate

Markdown, TOML, YAML and Containerfiles SHALL use pinned local Wasm formatters. Both staged and outgoing snapshot gates MUST check their formatting without rewriting files. The central policy MUST reject remote or extra plugins, missing grammars and expanded exclusions before starting the formatter. Nested configuration discovery and Git-ignore filtering MUST NOT hide maintained files.

#### Scenario: All documentation grammars are checked without writes

- **WHEN** two valid and two malformed examples per grammar pass through the actual formatter
- **THEN** valid examples pass, malformed examples fail and every original byte remains unchanged

#### Scenario: Formatting policy cannot bypass the gate

- **WHEN** configuration adds a remote plugin, extra plugin, missing grammar or documentation exclusion, or the formatting job fails
- **THEN** configuration is refused before process execution or the complete snapshot gate fails

### Requirement: Spelling is a required local gate

Maintained product source, tooling, fixtures, package documentation, guides, examples and OpenSpec artifacts SHALL pass the pinned local spelling check. Both staged and outgoing snapshot gates MUST run it without rewriting source or downloading tools. Configuration MUST match the central reviewed scope and dictionary. Git-ignore rules, user-global dictionaries, child configurations, inline directives, expanded exclusions and silently skipped oversized files MUST NOT hide errors. Historical quoted misspellings and deliberate invalid-field examples MAY use exact file-specific dictionary entries; those words MUST remain errors elsewhere. Each checker invocation MUST contain at most 1024 files and 16 MiB of source, with each source limited to 1 MiB. Discovery MUST stream the complete maintained scope through sequential bounded batches without retaining an inventory-wide collection. Repository growth beyond one batch MUST NOT omit source. Every source MUST pass admission before the first checker starts. Reduced test budgets MAY be supplied through a strict schema and MUST NOT exceed these ceilings.

#### Scenario: Maintained spelling errors fail without writes

- **WHEN** valid and misspelled guides and nested source files pass through the actual checker
- **THEN** valid files pass, misspelled files fail and original bytes remain unchanged
- **AND** Git-ignore files, user-global dictionaries and child configuration cannot conceal the misspelled source

#### Scenario: Spelling policy cannot bypass the gate

- **WHEN** the policy adds exclusions, dictionary entries or remote imports, changes scope, exceeds a source budget, uses inline directives or the spelling job fails
- **THEN** policy admission or the complete snapshot gate fails
- **AND** dependency and generated output files remain outside maintained ownership

#### Scenario: Spelling batches preserve complete scope

- **WHEN** the maintained inventory exceeds one admitted batch by file count or byte size
- **THEN** every maintained file is checked exactly once through bounded sequential invocations
- **AND** an unsuccessful first or later batch fails the gate without running further batches
- **AND** oversized sources, enlarged or unknown budget inputs and forbidden directives fail admission before the checker starts

### Requirement: Package boundary inventory has explicit read budgets

The blocking package-boundary command SHALL read each manifest and source through a byte-limited stream before parsing. Individual files SHALL be limited to 1 MiB, aggregate retained manifest and source input to 64 MiB, product workspaces to 256 and source files to 16384. Central schemas SHALL own these ceilings and refuse enlarged, zero or unknown limit inputs. Directory entries SHALL be consumed asynchronously. Invalid manifest data and any exhausted budget SHALL fail verification without altering repository files or silently omitting required work. Source text may remain buffered within these limits for syntax inspection.

#### Scenario: Bounded inventory remains valid and unchanged

- **WHEN** valid packages contain ordinary or UTF-8 source within their exact byte and entry allowances
- **THEN** all selected sources are retained for the existing graph checks and the maintained tree remains unchanged

#### Scenario: Oversized files and aggregate input fail closed

- **WHEN** a source, manifest or combined input exceeds its byte allowance, including across packages
- **THEN** the reader refuses it instead of accumulating more bytes or returning an incomplete successful inventory

#### Scenario: Entry limits and invalid schemas cannot hide source

- **WHEN** workspace or source counts exceed their allowances, manifest data is malformed, or limit inputs are zero, unknown or above owner ceilings
- **THEN** inventory fails before an incomplete graph can be accepted and preserves existing files

### Requirement: Hook workspace discovery and setup reads have explicit limits

Hook workspace discovery SHALL include the root, admit relative workspace patterns and deduplicate selected manifest paths. It SHALL limit each manifest to 1 MiB, combined manifest bytes to 64 MiB, patterns to 256 and selected workspaces including the root to 256. Smaller fixture limits SHALL be strict and cannot enlarge owner ceilings. Prepared lock comparisons SHALL limit each lock to 8 MiB. Cached dependency manifests and package READMEs SHALL each be limited to 1 MiB before parsing. Exhaustion SHALL fail verification rather than report an incomplete success. These read limits SHALL preserve existing version, lock and README checks.

#### Scenario: Overlapping workspace selection preserves exact budgets

- **WHEN** a valid root and member fit the byte and entry allowances and two workspace patterns select the same member
- **THEN** discovery returns the root and member once, including when their count exactly fills the allowance
- **AND** original fixture files remain unchanged

#### Scenario: Workspace discovery refuses excessive or invalid input

- **WHEN** root or member bytes, combined bytes, workspace count or pattern count exceed a limit, or a pattern or limit input is invalid
- **THEN** discovery fails instead of omitting work or accepting an enlarged allowance

#### Scenario: Setup metadata and README reads refuse oversized input

- **WHEN** a prepared or snapshot lock exceeds 8 MiB, or a cached manifest or package README exceeds 1 MiB
- **THEN** the corresponding setup or documentation check fails
- **AND** ordinary matching locks, pinned dependencies and valid package documentation remain accepted

### Requirement: Shared JSON encoding bounds expanded data

The streams package SHALL provide an asynchronous JSON byte encoder for plain or null-prototype objects and arrays, finite numbers, strings, booleans and null. It SHALL escape string segments of at most 8192 characters without splitting surrogate pairs. Its collector SHALL refuse expanded UTF-8 output above the caller's positive byte allowance before retaining that output. The encoder SHALL reject unsupported values, accessors, sparse arrays, custom prototypes, cycles and more than 128 nested containers. Shared references SHALL remain valid. Transport owners SHALL separately admit enclosing frames. Existing serialization paths remain subject to migration and verification.

#### Scenario: Supported JSON preserves exact bytes

- **WHEN** supported data includes escaped controls, UTF-8 text, a surrogate pair across a segment boundary, null prototypes, shared references or the maximum allowed depth
- **THEN** bounded encoding returns the same bytes as native JSON serialization within the caller's allowance

#### Scenario: Expanded JSON exceeds its byte allowance

- **WHEN** delimiters, UTF-8 text, escape expansion or repeated dependency references exceed the caller's byte allowance
- **THEN** encoding fails before retaining output beyond that allowance
- **AND** zero or fractional allowances fail before traversal

#### Scenario: Unsupported JSON data fails explicitly

- **WHEN** data contains an accessor, sparse array, custom prototype, cycle, excessive nesting, undefined, symbol, function, big integer or non-finite number
- **THEN** encoding fails rather than executing a custom serializer or silently substituting data

### Requirement: Lint policy cannot silently drop guardrails

Central constants and a strict schema SHALL define the pinned Biome policy and ownership plugin scopes. A read-only bounded command SHALL refuse missing, malformed, oversized or unrecognized policy. Required source roots, plugin paths, project analysis, recommended rules, promise checks and import-cycle errors SHALL remain present. Full and documentation snapshot gates SHALL run this command. Real pinned Biome CI fixtures SHALL prove allowed ownership and rejected violations without changing checked source bytes. Test setup MAY format its isolated generated source before the read-only proving command.

#### Scenario: Invalid lint policy fails closed

- **WHEN** policy disables required rules, drops a plugin, excludes owned source, adds unknown overrides or exceeds its read allowance
- **THEN** the policy check fails and preserves its input

#### Scenario: Ownership plugins reject actual source violations

- **WHEN** isolated source puts strings, templates, interfaces, aliases, object types or string-literal types outside their permitted ownership
- **THEN** the pinned Biome CI command fails with the corresponding diagnostic
- **AND** valid owner files pass and checked source bytes remain unchanged

#### Scenario: Lint guardrails remain in both hook scopes

- **WHEN** the lint policy command fails during either source or documentation snapshot verification
- **THEN** that gate fails even when its other commands succeed

#### Scenario: Promise and cycle diagnostics are exercised

- **WHEN** source leaves a promise unhandled or creates a two-module or three-module import cycle
- **THEN** pinned Biome CI fails with the corresponding error diagnostic
- **AND** awaited promises, promises marked with void and directed chains pass without rewriting source

### Requirement: Schema ownership rejects unchecked data shapes

Every data-only interface and object type literal in packages/types SHALL come from a Zod schema. Callable behavior contracts MAY remain explicit interfaces or aliases. A read-only command SHALL inspect TS, TSX, MTS, CTS and declaration sources, including nested object literals. Scoped aliases, imported local contracts, inheritance and tuples SHALL distinguish data from executable behavior. Unknown references, recursion, excessive depth and shadowed executable builtin names SHALL NOT excuse unchecked data. Source reads SHALL be bounded to 1 MiB each, 64 MiB combined and 256 files, with 8192 declarations and 128 reference levels. Smaller strict fixture limits MAY apply. Full and documentation snapshot gates SHALL require this command.

#### Scenario: Callable contracts remain valid

- **WHEN** schema-inferred data and direct, inherited, imported, merged or tuple-based callable contracts are inspected
- **THEN** the ownership command accepts them without rewriting their source

#### Scenario: Unchecked data shapes fail the command

- **WHEN** source declares raw data interfaces, union branches, nested object literals, recursive data or data hidden behind a shadowed executable builtin name
- **THEN** the command fails with source locations and preserves the checked bytes

#### Scenario: Schema inspection is bounded and read only

- **WHEN** source is missing, malformed or exceeds a file, byte, declaration or reference allowance, or supplied limits are invalid
- **THEN** verification fails rather than silently omitting unchecked data
- **AND** ordinary input within exact permitted allowances remains valid and unchanged

#### Scenario: Schema ownership remains mandatory in both hook scopes

- **WHEN** the schema ownership command fails during source or documentation snapshot verification
- **THEN** the gate fails even when every other command succeeds

### Requirement: Test files keep control flow in shared factories

Test registration sources SHALL contain no if, for, for-in, for-of, while, do, switch or try statements, including nested helpers and callbacks. Shared factories SHALL own executable control flow. A bounded read-only command SHALL inspect all dot and underscore test/spec discovery names across the supported Bun source extensions. Each source SHALL remain within the existing one-MiB source allowance; strict central limits SHALL cap the test inventory at 256 files and 64 MiB combined. Smaller fixture limits MAY apply. Missing inventory, invalid syntax and exhausted or invalid limits SHALL fail. Full and documentation snapshot gates SHALL require this command. Separate subject-case inventory, nesting and comment rules remain applicable.

#### Scenario: Flat registration files remain valid

- **WHEN** flat registration, case tables, strings and comments containing control-flow words are inspected
- **THEN** the command accepts the files and preserves their bytes

#### Scenario: Nested executable control flow fails

- **WHEN** a discovered test source contains a conditional, loop, switch or try statement, including inside a named helper or callback
- **THEN** the command fails with file and line locations

#### Scenario: All supported Bun test names are inspected

- **WHEN** test files use dot or underscore test and spec names with JS, JSX, TS, TSX, MJS, CJS, MTS or CTS extensions
- **THEN** every matching source is inspected and ordinary helper files remain outside this test-only rule

#### Scenario: Test inspection fails closed within bounded input

- **WHEN** test source is missing, malformed or exceeds a file or combined byte allowance, or limit overrides are invalid
- **THEN** verification fails without rewriting source or accepting an incomplete inventory

#### Scenario: Flat test enforcement remains mandatory in both hook scopes

- **WHEN** the flat-test command fails during source or documentation snapshot verification
- **THEN** the gate fails even when its other commands succeed

### Requirement: Supported TypeScript sources cannot disappear from verification

Root and workspace compiler scopes SHALL include TS, TSX, MTS and CTS sources. Each ordinary workspace SHALL select its src tree. The root testing workspace SHALL select its complete tree. A package SHALL NOT substitute unrelated, duplicate or narrower include patterns. Product coverage, boundary inventory and unused-code verification SHALL inspect all four TypeScript source suffixes. Existing byte limits, strict compiler settings and coverage thresholds SHALL remain required. Actual pinned compiler and command fixtures SHALL prove accepted input and detected omissions.

#### Scenario: Every TypeScript suffix reaches the compiler

- **WHEN** valid and ill-typed TS, TSX, MTS and CTS files are compiled through root and package projects
- **THEN** valid files pass and ill-typed files fail with their file name and type diagnostic

#### Scenario: Workspace include cannot hide its source

- **WHEN** a workspace selects a missing directory, a document, duplicate patterns, a narrower suffix or the wrong testing layout
- **THEN** configuration verification fails before accepting that scope
- **AND** the complete ordinary and testing scopes remain valid

#### Scenario: Product coverage inventories every TypeScript suffix

- **WHEN** a product source of any supported suffix has a missing or uncovered coverage record
- **THEN** the actual coverage command fails and names that source
- **AND** complete covered records pass with the full source count

#### Scenario: Boundary source suffixes retain their read limits

- **WHEN** product source uses any supported TypeScript suffix
- **THEN** boundary inventory includes it and retains the source byte allowance
- **AND** an oversized source fails rather than being skipped

#### Scenario: Unused TypeScript sources cannot hide by suffix

- **WHEN** an internal source uses any supported TypeScript suffix
- **THEN** unused-code verification accepts an imported file and rejects an unreferenced file
- **AND** it preserves the checked source bytes

### Requirement: Package direction follows explicit ownership

A bounded read-only command SHALL inspect the root manifest and every declared workspace, including both dependencies and development dependencies. Canonical workspace patterns SHALL retain apps, packages, the testing root and testing packages. Package names SHALL identify their actual owning directories. Product packages SHALL NOT depend on test packages. Test support SHALL depend only downward through framework, factories and aggregation. Concrete adapters and vendor SDKs SHALL remain within their declared owners, with explicit test dependencies permitted. Missing workspace dependencies, malformed metadata and exhausted or invalid inventory limits SHALL fail verification. Full and documentation snapshot gates SHALL require the package policy command.

#### Scenario: Valid package directions retain their owners

- **WHEN** foundation-only core dependencies, an adapter's own SDK, runtime adapter composition and downward test support dependencies are inspected
- **THEN** package verification passes without changing the manifests

#### Scenario: Runtime and development dependencies share direction checks

- **WHEN** an ordinary product library declares an adapter or test support dependency in either dependency scope
- **THEN** package verification fails and names both packages

#### Scenario: Workspace names cannot grant another owner's role

- **WHEN** an ordinary library is renamed as runtime, an adapter or test support while remaining in its original directory
- **THEN** package verification rejects that identity

#### Scenario: Test support cannot depend upward

- **WHEN** framework depends on factories, or factories depend on aggregation
- **THEN** package verification rejects the dependency and preserves all checked manifests

#### Scenario: Package inventory cannot silently narrow

- **WHEN** root workspace patterns omit or replace a required tree, a workspace dependency is absent, or metadata or inventory limits are invalid or exhausted
- **THEN** verification fails without accepting an incomplete inventory

#### Scenario: Package policy remains mandatory in both hook scopes

- **WHEN** the package policy command fails during source or documentation snapshot verification
- **THEN** that gate fails even when every other command succeeds

### Requirement: Tests use the declared discovery tiers

Current test registration files SHALL live under testing/unit, testing/integration or testing/e2e. Contract cases SHALL use one of those tiers; adapter process contracts SHALL live in integration. Test-only support directories SHALL remain under testing rather than apps, packages or tooling. The bounded flat-test command SHALL reject misplaced discovery names and test-only support directories, including nested product support. Product contracts whose ordinary file name contains testing SHALL NOT become test fixtures merely because of that name. Existing syntax, file and byte checks SHALL remain required.

#### Scenario: Declared tiers and central helpers remain valid

- **WHEN** tests use any declared tier and shared helpers remain under testing
- **THEN** verification accepts them and preserves the checked source

#### Scenario: Undiscovered test files fail verification

- **WHEN** a test registration file exists under a product, tooling, a fourth tier or a similarly named sibling of a declared tier
- **THEN** verification fails and names the misplaced file

#### Scenario: Product test support cannot remain beside runtime code

- **WHEN** test, fixture, factory, harness or stub directories exist under product packages or tooling, including inside a source tree
- **THEN** verification fails and names their checked source

### Requirement: Owned source comments fail the local hooks

Both staged-content and outgoing-revision verification SHALL run a read-only comment check over every maintained JavaScript and TypeScript source discovered by the shared owned-source inventory. This includes all supported source suffixes in applications, packages, tooling, test helpers and vendor fixtures. Actual line, block and documentation comments MUST fail with a file and line. Comment-like content in strings, template text and regular expressions MUST remain valid. Executable shebangs MUST remain valid. Source bytes, inventory size and diagnostic count MUST have central bounded limits; malformed limit input, an empty inventory or exceeded limits MUST fail before acknowledging verification. No comment suppression or source ignore SHALL be added for existing repair debt. Documentation SHALL hold the rationale removed from source. This guard does not establish acceptance of the remaining nesting, object-depth, lazy-state or other-language rules.

#### Scenario: Comments cannot enter an outgoing source snapshot

- **WHEN** a maintained application, package, tooling or test source contains a line, block or documentation comment
- **THEN** both hook scopes refuse it with the source path and line
- **AND** the source bytes remain unchanged

#### Scenario: Comment text is reference data

- **WHEN** valid source contains a URL, comment-like string or template text, a regular expression or an executable shebang
- **THEN** the comment check accepts it
- **AND** an actual comment inside a template expression or JSX expression is still refused

#### Scenario: Comment discovery cannot omit source variants

- **WHEN** a comment appears in any JavaScript or TypeScript source suffix admitted by the owned-source inventory
- **THEN** the check reports that file
- **AND** missing inventory, exceeded source budgets and diagnostic overflow fail safely

### Requirement: Failed hook prerequisites stop later commands

Within one exported snapshot, local verification SHALL run the required command registry in order and return failure immediately after the first failed command. Commands after that refusal, including product tests, SHALL not start. The report SHALL identify the attempted failed command and its duration. A successful snapshot SHALL still execute every command required by its source or documentation scope. The change SHALL not introduce a cached success receipt or skip any required command on a passing path. This rule does not establish the complete verification timing target.

#### Scenario: Source prerequisite fails before product tests

- **WHEN** source formatting, types or another prerequisite command fails
- **THEN** the snapshot gate refuses delivery without running later commands or product tests
- **AND** the failed command is reported

#### Scenario: Documentation prerequisite fails before later commands

- **WHEN** a documentation-scope prerequisite fails
- **THEN** the snapshot gate refuses delivery without running later commands

#### Scenario: A successful hook retains its complete scope

- **WHEN** every command in a source or documentation snapshot succeeds
- **THEN** the gate executes the complete registry for that scope before acknowledging success

### Requirement: CLI command metadata has canonical owners

The CLI SHALL compose request, knowledge and artifact definitions from their domain modules alongside the corresponding handlers. Shared positional argument declarations SHALL belong to constants. The root catalog SHALL be checked exhaustively against the existing command enum, so a registered command cannot silently lack a definition. Help and parsing SHALL continue to use the same definitions. Internal reorganization SHALL preserve every existing command's options, required selectors, choices, nested commands, protocol markers and handler and validator presence. Unknown and prototype property names SHALL not resolve to definitions. Shared query validation SHALL remain identical before service access and within handlers. Pending features SHALL remain explicitly pending.

#### Scenario: Registered CLI commands have complete definitions

- **WHEN** a registered root command has no catalog definition
- **THEN** type checking fails before delivery
- **AND** every defined command remains in the public command inventory

#### Scenario: CLI reorganization preserves companion arguments

- **WHEN** command metadata moves to its domain owner
- **THEN** the fixed pre-change contract for all existing commands remains equal
- **AND** nested artifact, knowledge and request commands retain their accepted arguments and validation before service access

#### Scenario: Prototype names cannot become CLI commands

- **WHEN** a caller asks for a constructor or prototype property name
- **THEN** it resolves to no command definition and cannot select a handler

### Requirement: Owned Markdown links have bounded snapshot verification

The repository SHALL provide `bun run check:links` in both full and documentation snapshot checks. It MUST inspect owned Markdown links, images, reference definitions and heading fragments through a Markdown parser. Missing files or headings, invalid paths and exhausted finite traversal, read, byte, parsing or finding budgets MUST fail. Link targets MUST resolve inside the repository. Verification MUST preserve source and index bytes and MUST NOT require vendor calls or network requests. External HTTP, HTTPS and mail links receive scheme validation only. This requirement does not establish protection against concurrent hostile filesystem replacement.

#### Scenario: Broken staged link survives an unstaged repair

- **WHEN** a staged owned document has a missing target or heading and its working file repairs that link
- **THEN** the actual exported staged snapshot fails link verification
- **AND** the working file and index retain their bytes

#### Scenario: Earlier outgoing broken link survives a later repair

- **WHEN** an outgoing document revision has a broken link and a later outgoing revision repairs it
- **THEN** link verification checks both exported revisions and refuses the earlier defect

#### Scenario: Finite document inventory refuses incomplete success

- **WHEN** document traversal, source bytes, reads, parsed nodes or findings exceed their configured central ceilings
- **THEN** link verification fails without certifying an incomplete scope
- **AND** valid documents within those ceilings pass without changing their bytes
