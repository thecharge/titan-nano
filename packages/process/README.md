# @titan/process

## Responsibilities

Owns finite binary command capture, cancellation, bounded pipe collection and Linux process-group cleanup. Both pipes drain through shared capped concurrency. Command arguments, each pipe and elapsed time have central schema-validated ceilings.

## Public contract

The caller authorizes the command and supplies its working directory. `captureCommand(command, cwd, options, signal, processes)` ignores input and returns separate stdout and stderr Buffers with the normal exit code. A normal nonzero exit retains its captured bytes for the caller to classify. A signal, deadline, cancellation or byte overflow fails. The default `ownedCommandProcesses` port starts a detached child and stops its Linux process group. The typed `CommandProcessPort` allows controlled failure fixtures without changing global process APIs.

## Verification

After typechecking, run `bun run test testing/integration/command-capture.test.ts testing/integration/distribution.test.ts`. The offline cases cover exact binary ceilings, ordinary nonzero results, empty arguments, invalid admission, pipe overflow, signals, cancellation, deadline and inherited descendant pipes. Cleanup-failure cases retain the first failure and verify fallback direct-child cleanup. Shared argument and options tables cover positive and negative schema boundaries. Installed-package acceptance retains the existing packaging and runtime tables.

## Limits

Each pipe defaults to one MiB and the default and maximum deadline are ten seconds. Callers can lower either budget. Cleanup stops the owned Linux process group and awaits the direct child. Descendants that deliberately leave that group require their enclosing executor's isolation and cleanup. Container policy, scoped approvals, effect reconciliation and workflow accounting belong to their respective owners.
