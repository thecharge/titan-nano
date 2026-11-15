# Approved script execution implementation

## Required outcome

This continues tasks 10.1, 22.8, 22.10 and 24.7. Script workers and falsifiers must run through the engine after a scoped person approval. A successful script worker returns its recorded output. A completed falsifier exit of zero survives, and an ordinary completed nonzero exit refutes with retained evidence. Launch failures, cancellation, signals, lost outcomes and resource exhaustion block operationally without consuming a result attempt. Script execution must not create an agent session or add agent usage.

Each script falsifier must run twice against separate copies of the same immutable candidate. A different answer cannot certify the candidate. The controller and installed runtime must stay outside those writable folders. Applying, committing, pushing and replacing a runtime remain separately authorized actions.

## Implementation boundaries

The existing runner owns phase state, requests and durable transitions. Shared contracts and validation belong to types, settings to config, identifiers and finite allowances to constants, and diagnostics to messages. Runtime composes the process executor through an explicit engine service. Script capacity has separate bounded admission from native agent capacity and remains subordinate to workflow scheduling.

The process executor must use an owner-selected immutable local Podman image. Project and workflow input cannot replace that image, executable, credentials or host policy. The container has no network, host sockets, credential mounts or writable root. Only its owned attempt folder is writable. Captured output is bounded bytes and both pipes drain concurrently through the shared capped utility. Cancellation and deadlines stop and await owned processes and the named container. No host shell is a substitute for this isolation.

A persisted execution identity owns its container. The runner must commit dispatch intent before sending an effect and retain the container outcome until the result is durable. Recovery inspects that owned identity before any new dispatch. An unknown outcome must remain blocked for reconciliation. A missing acknowledgement must not cause the command to run twice. Approval binds the script bytes, exact input tree, immutable image and execution policy. Changed scope requires a new request. Script request origins need an explicit discriminator and a null native session. Existing request identities and journal formats must retain their prior serialization and validation.

## Verification requirements

Use flat positive and negative tables for validation, binding, exit classification, byte ceilings, process cleanup, capacity, cancellation, interrupted dispatch, approval changes and rechecks. Repeat the engine path with Codex and Claude versioned stubs and the installed executable. Verify isolation and controller bytes. The offline suite cannot start nested Podman, so strict versioned executor process fixtures must prove protocol and command construction there. Any real container smoke test must be separately observed in its supported host environment and retain the same budgets. No vendor turn or Titan skill invocation is authorized by this record.

## Current state

The bounded process foundation is implemented and verified through the focused offline selection. The current engine still rejects script actions in preflight and turn dispatch. Approved workflow execution and its complete acceptance remain open. Installed-package acceptance passed. Both complete ordinary gates passed and exact remote publication was confirmed. Task 31.8 is complete. Runtime suites and hooks remain serialized across checkouts.

## Bounded process foundation

The first implementation slice introduces @titan/process and reuses it in the existing packaging output wrapper. It has central command, byte and deadline schemas, binary results and a typed process port. It bounds and cancels both captured streams, uses shared capped concurrency, stops the owned Linux group, falls back to direct-child cleanup after a group-stop failure and awaits the child. Normal nonzero results retain their bytes for a caller to classify. Packaging retains its prior byte and deadline allowances and messages. No external dependency version changed. This is process ownership needed by the container executor. Workflow script execution remains unimplemented and explicitly blocked.

The first selection passed 66 cases in 3.33 seconds. Its focused command exited one for 253 omitted complete-product coverage gaps. Two added cleanup-failure cases passed in the 68-case extended selection in 3.37 seconds. The process owner, shared new schemas and packaging wrapper then had complete measured lines and functions. A launcher counter strengthened proof that invalid and pre-cancelled input starts no child. The strengthened 68-case selection passed in 3.36 seconds, with command exit one for 252 omitted whole-product coverage gaps. Evidence is /tmp/titan-script-process-first.log, /tmp/titan-script-process-extended.log and /tmp/titan-script-process-strengthened.log.

Six type-correct faults were caught. Enlarged pipe ceilings failed four cases, replaced exit codes three, omitted group cleanup one, omitted deadline state four, omitted pre-cancelled admission one and replaced first-failure retention seven. Source was restored byte-for-byte in finally and restored typechecking passed. Evidence is /tmp/titan-script-process-mutants.json and /tmp/titan-script-process-restored-types.log. All new runtime tests used the existing offline container with unchanged CPU, memory, process and concurrency limits. No nested container or vendor call occurred. Task 31.8 is complete after both ordinary gates and exact remote publication were observed.

The control-command owner uses a one-MiB ceiling per pipe and a ten-second ceiling per command, matching existing packaging allowances. An earlier uncommitted draft proposed a ten-minute upper bound without a validated caller. It was removed before complete verification. Container execution lifetime and its durable owner policy remain separate work. The frozen lockfile check exited zero with private cache storage, and its before and after SHA-256 values were both fe0720fcfdc741c7dcbfe134e9724e7f738e82aaaabc4108cb54b4982c765356. All lock changes are declared workspace entries.

The final restored selection passed all 68 cases across two files in 3.36 seconds. Its command exited one for 252 omitted whole-product coverage gaps across 299 sources. Evidence is /tmp/titan-script-process-restored.log.

Installed-package acceptance exited zero and retained every existing acceptance table, including both native stub backends, request turns, interruption recovery, configuration edits, saved inputs and candidate commitments. Evidence is /tmp/titan-script-process-installed.log.

## Container output evidence research

The host reports Podman 4.9.3 and container monitor version 2.1.10. The matching Podman manual describes container deadlines, environment clearing and the default image pull behavior. The executor must explicitly forbid pulling and clear inherited environment. These are implementation requirements pending runtime proof. [Podman 4.9.3 run manual](https://docs.podman.io/en/v4.9.3/markdown/podman-run.1.html).

The matching container monitor source replaces its current log file after reaching the configured size. Inferring complete output solely from the final bounded file would therefore lose evidence. A recovered script result needs retained complete bytes or an explicit operational block when completeness cannot be established. No rotating-log recovery design has been accepted or verified. [Version 2.1.10 log owner](https://github.com/containers/conmon/blob/v2.1.10/src/ctr_logging.c#L344-L362), [replacement implementation](https://github.com/containers/conmon/blob/v2.1.10/src/ctr_logging.c#L557-L583).

Both complete ordinary gates passed at 70d32163ff8252a4f046b59dee02cda046345300. Staged tests passed all 4,147 cases across 213 files in 604.25 seconds, with zero failures and zero gaps across 299 sources. The staged hook took 627.11 seconds and message policy 0.48 seconds. Outgoing tests passed the same 4,147 cases in 618.71 seconds with zero gaps. Evidence is /tmp/titan-script-process-commit-final.log and /tmp/titan-script-process-push.log. Exact remote main and disabled Actions were independently confirmed afterward. Initial export-order and package-README hook failures were corrected before the complete pass. Workflow script execution and isolated self-development remain open.
