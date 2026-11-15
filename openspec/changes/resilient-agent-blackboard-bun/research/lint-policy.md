# Lint policy and ownership proof

This increment implements task 2.6 and a focused part of engineering task 32.1. It does not complete reference parity. The reference remains scratch-pad e77dea405084be20de04debf72f56aaaf459eae5. Current package boundaries and existing ownership scopes remain explicit; no empty package or broad ignore is added.

## Policy and real command

Installed Biome 2.6.6 owns the primary configuration schema. Its configuration_schema.json declares suspicious.noImportCycles. The root now explicitly requires that error alongside recommended rules, project analysis and noFloatingPromises. Central constants define paths, scopes and formatting; a strict Zod schema refuses removed plugins, new exclusions, unknown overrides and weakened rules. The bounded read-only command is mandatory in both hook scopes.

Each source fixture invokes the actual pinned CLI. Setup formats isolated generated files, then the proving command runs biome ci with error-on-warnings and compares source bytes afterward. No linter result is substituted. Allowed owner examples pass. Misplaced string and template values, interfaces, aliases, object types and literal types must fail with their actual diagnostics. Two handled promises and two directed chains pass; two unhandled promises and two import cycles fail.

## Observed corrections and counterexamples

The first selection passed 57 cases and failed eight. Its nested policy mutations traversed Zod-parsed copies without reconnecting them. The original candidate therefore stayed valid. The factory now reconnects each validated child before traversal. No negative assertion was relaxed. Added null and empty file cases cover valid JSON with an invalid policy shape. Restored selection passed 67 tests across three files in 4.12 seconds. Both new product schema and checker had complete lines and functions. The focused command still exited 1 because unrelated global source coverage was omitted.

Five temporary variants each passed typecheck before their offline selection. Removing the value plugin failed six cases, including actual strings and templates: 57 passed in 3.39 seconds. Removing the shape plugin failed eight, including all four misplaced shape forms: 55 passed in 3.35 seconds. Removing the literal-type plugin failed eight, including single, union and function result forms: 55 passed in 3.41 seconds. Allowing weaker rule levels failed both warning and disabled-cycle cases: 61 passed in 3.43 seconds. Removing the policy hook job failed both source and documentation delivery cases: 61 passed in 3.41 seconds. Every variant was restored in finally; restored typecheck passed. Mutation logs remain local temporary evidence rather than shipped product inputs.

## Remaining verification

Restored full-scope verification, normal commit, outgoing checks, push and independent CI remain required. No installed product behavior changed in this engineering increment. No live vendor call or Titan skill operation occurred. Structure, comments, schema-only data, test inventories and the complete rule registry remain open. Full task 32.1 is not closed.

## Main and independent CI evidence

Commit 8208792eb9e87724353b336bb1d65fda64f4d1a1 passed its normal staged gate with 2283 tests across 127 files in 247.73 seconds, 187 product sources and zero coverage gaps. The gate took 262.15 seconds and message validation 0.87 seconds. Its normal outgoing gate passed the same counts in 250.34 seconds; the gate took 263.86 seconds. Main and origin matched after push. Independent CI 42474067232 succeeded with 2283 tests in 268.05 seconds and the same complete coverage inventory. This closes the pending delivery evidence above, not wider engineering or product acceptance.
