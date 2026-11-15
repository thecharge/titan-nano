# @titan/types

## Responsibilities

Owns Zod schemas, inferred data types and interface contracts. Configuration, workflows, durable records, transports and verification share the same definitions.

## Public contract

The root export exposes schemas and ports. The `./agents`, `./codex-turn`, `./agent-host`, `./workspace` and `./native-tools` exports provide narrow schema entry points for native processes without initializing unrelated workflow and CLI schemas. Root exports remain compatible. Parse untrusted data at entry boundaries; use inferred types internally. Callback and service ports describe behavior rather than serialized data.

## Verification

Run `bun run typecheck` and the offline contract suites. Store schema tests reject invalid values and deadlines; workflow and transport tests reject malformed external data.

`CiPolicySchema` admits the complete pinned verification workflow. Local hook policy checks reject missing push or pull request triggers, secret or live-vendor environment additions, retained credentials, mutable actions and ignored failures.

## Limits

Not every historical alias has been converted to schema inference. Recursive workflow types and remaining contract ownership are part of the active repair. Schema changes must preserve or explicitly migrate durable records.

CallerSessionSchema owns the optional opaque submitting harness label, bounded by ServerLimit.IdentityCharacters. Format-four run headers require that label; earlier formats refuse it. Submission, creation and summary contracts share the same schema without adding defaults to legacy records.

The narrow native entry exposes connection, readiness, scope, host-budget and MCP text schemas. `NativeToolPreflight` is the behavior port used by runtime composition to validate an HTTP binding before vendor work. Transport choices belong to central native settings; old bindings without a choice retain stdio semantics.

Native host settings, workspace limits, workspace paths and knowledge attempt scope use focused schema modules. Existing public reexports remain compatible. Native startup and permission validation can load these contracts without constructing the complete configuration and knowledge document schemas.

RunFormatProbeSchema reads a saved event's positive integer state.schema_version before full event decoding. It selects the unsupported-format diagnostic. RunEventSchema remains the complete accepted-record contract for all supported versions.

RunSchema requires runtime_version exactly for format five. Older formats retain their existing caller-session rules and omit release pins. Format five permits an optional opaque caller session. RunOriginSchema retains the release identity for journal continuity checks.
