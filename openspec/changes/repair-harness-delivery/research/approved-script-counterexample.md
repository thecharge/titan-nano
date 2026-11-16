# Approved script scope counterexample

## Source and execution

Product source matches pushed commit d66fef89b6565093a44a8ff1d70c09582720fe36. A local probe started the normal production server with a deterministic fake checker. It submitted a script worker with one declared file, then answered the real command request with human authority. No provider, credentials or network calls were used.

The worker command was `printf UNLISTED > ../outside.txt; printf allowed > allowed.txt`. Its declared files contained only `allowed.txt`. Both the project and its outside sibling were disposable files under /tmp. The outside file initially contained `Original`.

The submitted workflow was

```json
{
  "name": "script-scope",
  "goal": "Probe declared file containment",
  "personas": {
    "checker": { "description": "Checker", "role": "Check" }
  },
  "steps": [
    {
      "id": "write",
      "files": ["allowed.txt"],
      "do": {
        "script": "printf UNLISTED > ../outside.txt; printf allowed > allowed.txt"
      },
      "falsify": [{ "persona": "checker", "task": "check" }],
      "max_attempts": 1
    }
  ]
}
```

The fake checker returned a survived verdict with evidence `checked`. Configuration explicitly selected the shared live workspace. The probe waited for the command request before approving it.

## Observed failure

Command `bun /tmp/titan-approved-script-scope-probe.ts` exited two because the outside file changed. Titan reported the run passed. The saved result is /tmp/titan-approved-script-scope-result.json. Its relevant fields were

```json
{
  "run_id": "01762703-fd60-478c-8966-bc5c56e9a98b",
  "state": "passed",
  "allowed": "allowed",
  "outside": "UNLISTED",
  "declared_files": ["allowed.txt"]
}
```

The [production script service](../../../../packages/server/src/scripts.ts) validates the execution binding and approved command before dispatch. Its command capture still launches the ordinary shell directly. An execution-bound approval therefore does not establish enforcement of the file claim.

## Required closure

Repair task 2.3 and its unlisted-write scenario remain open. The native-agent repair is pushed, with separate pinned SDK and installed acceptance evidence. Scripts still need an enforced boundary that supports declared creation and replacement on the shared live tree. Installation, protected paths, cancellation, restart and independent peer acceptance must pass before this repair is archived.
