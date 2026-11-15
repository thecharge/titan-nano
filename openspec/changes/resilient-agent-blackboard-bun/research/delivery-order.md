# Required Codex and Claude delivery

## Acceptance boundary

The person rejected fragmented preview delivery and requested a production-ready product for Codex and Claude Code. This record controls implementation order; it does not replace any accepted requirement or mark unimplemented work complete. The fake backend and vendor stubs are verification tools. Limiting vendor support does not remove configuration, permissions, artifacts, knowledge, personas, proof checks, hive behavior, observability, installation, guides or self-development from the applicable scope. Other backend implementations retain their existing deferred status. No additional requirement is waived here.

GitHub Actions is forbidden without explicit user authorization. Keep it disabled, use normal local verification and independently confirm the disabled setting before and after each push. Earlier CI records below are historical evidence.

Use the existing tasks and acceptance map as the completion records. A completed task needs all its mapped applicable cases and observed proving commands. Partial implementation remains open. Every release claim must identify supported versions and platforms and fail when required evidence is missing. No production claim follows from a preview archive or an aggregate test count.

## Dependency order

| Gate                              | Existing task owners                              | Required result before advancing                                                                                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Restore the baseline              | 28.6, 31.3, 32.5                                  | Repair the confirmed descriptor leak, run the installed package and normal hooks, push and confirm the exact remote revision with Actions disabled.                                                                                                       |
| Engineering and architecture      | 2, 27, 29, 32; relevant facts in 1                | Reconcile every reference rule, implement blocking checks with negative fixtures, repair current violations and establish package ownership. Complete central settings, typed contracts, errors, operational logging, bounded state and technical guides. |
| Complete local execution          | 3, 7, 8, 9, 10, 13, 14, 16, 25, 26, 28, 30        | Deliver checked plans, scoped decisions and scripts, mixed graphs, isolated callers, durable recovery, verified artifacts and safe apply through CLI, HTTP and MCP.                                                                                       |
| Complete shared capabilities      | 4, 5, 11, 15, 17, 21, 23, 24; related 25 and 26   | Deliver knowledge, personas, helpers, independent evaluation, bounded learning, dashboard, logs, traces and proof checks with their acceptance evidence.                                                                                                  |
| Prove native use and distribution | Codex and Claude parts of 1 and 6; 12, 19, 20, 31 | Install outside the checkout, verify native permissions and recovery, ship current skills and commands, exercise code, document, research and operation examples and test shared live self-development with an immutable installed controller.            |
| Accept the product                | 22 and all applicable owners above                | No required pending scenario, successful complete checks and independent review of usability, supported environments and remaining limitations.                                                                                                           |

Cross-cutting tasks in 25, 26 and 31 are implemented with their owning package rather than left until the last gate. All 32 task groups are accounted for: group 18 remains the existing deferred RunPod backend work. Each task remains individually visible in tasks.md, including mixed tasks containing both supported and deferred vendor work. A gate is not complete because one happy-path example works.

## Three deliveries

The person asked on 2026-11-10 for delivery in chunks, not one task at a time, in at most three deliveries, with no assumptions and no free reading of the specs. Each delivery closes whole task groups. A group closes only when every task in it has its mapped proof. Open task counts below were counted from tasks.md on that date: 230 open (84 + 88 + 52 + 6 in group 18), 45 done.

| Delivery                     | Task groups closed                                                                | Open tasks | Result the person can use                                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Engine and control        | 1 (Codex and Claude facts), 2, 3, 7, 8, 9, 10, 13, 14, 16, 26, 27, 28, 29, 30, 32 | 84         | `titan run` works through CLI, HTTP and MCP for Codex and Claude Code, with recovery, scoped approvals, central settings and the full reference checks |
| 2. Shared capabilities       | 4, 5, 11, 12, 15, 17, 21, 23, 24, 25                                              | 88         | Knowledge hub, persona register, hive, self-training, dashboard, proof checks and the main-agent guide                                                 |
| 3. Native use and acceptance | 6 (Codex and Claude parts), 19, 20, 22, 31                                        | 52         | Installed skill and commands for both tools, examples, Titan editing Titan, and the readiness review                                                   |

Confirmed scope (person, 2026-11-10): an end-to-end working product for Claude Code and Codex only. Other vendors come later. The person wants full compliance and OpenSpec delivery up to fit for purpose, use and readiness, so that Titan can be used to deliver Titan and proven to work, and can be used in real products during delivery. Group 18 (RunPod) and the Antigravity, Anthropic, OpenAI and Gemini API parts of groups 1 and 6 are deferred by this instruction. They stay open and visible in tasks.md and are not marked done.

Each delivery ends with: every task in its groups checked off with the proof output seen, `bun run check` passing, the installed package check passing, and an exact remote hash. Failures and gaps are reported before successes.

## Reference comparison

The reviewed reference is scratch-pad commit e77dea405084be20de04debf72f56aaaf459eae5. DEV_RULES.md has SHA256 a28272fe71c222dd9a0f1f71b879a9b596e28bed5706800379faf83be66d997e. The companion reference-parity.tsv inventories every table rule, including those whose reference job cell is empty. Each row now records its Titan counterpart, an explicit disposition and remaining work. An implemented-subset status means incomplete enforcement, not a passing parity claim. The presence of a similarly named Titan command does not prove equivalent enforcement. Task 32.1 remains open until each row has an explained disposition, a blocking implementation and negative evidence where applicable.

The approved documentation difference remains independent documentation verification with stubbed vendor E2E. Do not copy the reference's scenario-generated documentation pipeline. Preserve faster verification as a measured goal without dropping required checks. Public SDK, API and infrastructure rules need their actual Titan counterpart; no empty package or application is created solely to resemble the reference tree.

## Current architecture gaps

Titan has twenty product libraries and one CLI app after the logging increment. Package checks validate declared imports and cycles, but complete package responsibility and public-contract coverage remain unfinished. The operational logger now has shared levels and events, strict records, home-owner configuration, bounded asynchronous stderr output and server lifecycle integration. It preserves run identities, refuses known secrets and keeps protocol stdout separate. Saturation, failed sinks, incomplete frames and actual process output have proving cases. This does not replace durable journals, traces or the wider architecture repair.

The reference also requires jobs that are currently absent or incomplete here: full rule registry, structure and comments, schema ownership, test tiers and per-unit case inventory, developer knowledge and command freshness, address ownership, documentation links and diagrams, source evidence and complete release checks. Existing string and type plugins, async-filesystem and capped-promise checks do not close those gaps. The next implementation work follows the engineering gate before adding another optional product surface.

## Historical delivery evidence

The descriptor repair and strict TypeScript policy are on main. Independent CI for the latter exposed insufficient graph timing headroom. Workspace copies now use shared capped concurrency while retaining their checks and durability. Repair c8ce85eb9875be31ff4ce0639ca851322c0521c8 passed normal staged and outgoing gates, was pushed and has successful independent CI 42470987942. Its record names timings, installed packaging and the detected mutation.

Logger increment 5f0bd1a4613ebdb2381d852f6edc8c6001e9cd00 passed its normal staged gate: 2238 tests across 126 files, all 185 product sources and zero gaps. Installed packaging also passed. Normal outgoing verification passed the same 2238 tests with zero gaps. Main 57ff480 includes the source and documentation increments; independent CI 42472410317 succeeded. The current lint policy repair proves the actual pinned plugins, promises and import cycles. Full reference parity remains open. Frozen configuration inspection remains preserved and uncommitted on codex/frozen-config-inspection. It does not finish atomic config writes or revision history and is not the next independent feature to ship. No work is discarded.

Use small complete changes inside the current gate. Record the original failing case, repair, counterexample or mutation, restored local checks, commit, push and exact remote confirmation. Stop claiming readiness until the full acceptance boundary above is met.
