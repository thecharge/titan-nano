# @titan/workflow

## Responsibilities

Owns workflow loading, format validation, group compilation and dependency validation. Group ordering and graph edges determine execution dependencies; display order does not add graph dependencies.

## Public contract

`validateWorkflow` returns a hashed plan. Callers load input through config's asynchronous data loader and validate that same parsed document. `outputSchema` and `checkAnswer` enforce declared persona output formats. `validatePlanTools` checks action permissions against the effective backend, including the read-only checker ceiling. It rejects unsupported Claude tools with persona and field diagnostics. Call it with the resolved backend fallback before admission. Optional persona request_turns enables requestTurnOutputSchema, a strict result/requests envelope around the normal output contract. Completed turns require an empty request array; waiting turns require a null result and bounded strict request descriptions. Internal group, graph, permission and format modules are not public package subpaths.

Input mappings require a completed predecessor in every group order or a transitive graph dependency. Declared input and output formats are compared structurally, with object property order ignored. A mismatch names the input path, source output and both formats. An unfinished dependency names the consumer and producer before any execution starts.

Schema diagnostics retain every leaf issue from nested group and action unions and invalid persona keys. Paths use Zod's dot and bracket notation, including escaped property names. Missing required values use Required. Schema failures use InvalidWorkflow and exit code 2.

`workflowFile` returns a detached buffer for the run record. A supplied source must fit the shared 1 MiB data allowance and compile to the submitted plan under the effective group-depth limit. Comments, line endings and formatting survive unchanged. Missing source selects the validated workflow's YAML representation. Invalid bytes, oversized input and a different plan fail before run creation.

## Verification

Run the offline workflow contract and foundation suites. Cases cover sequence/parallel joins, graph ordering, cycles, unknown dependencies, unsupported formats, typed inputs and invalid output data.

## Limits

Group depth is bounded before recursive schema parsing. Execution limits are applied using resolved configuration. Script actions are represented in the schema but execution remains blocked pending scoped approval support.
