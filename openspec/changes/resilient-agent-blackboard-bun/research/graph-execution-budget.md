# Graph execution budget repair

## Failure and scope

Main 09ac472f0d0b08834797c787f88523763d099f9c was pushed with normal hooks. Independent CI 42468678545 failed both successful 40-node graph cases at their unchanged 12-second execution deadline. The preceding successful CI 42467262086 took 11200.87 and 11401.87 milliseconds for the complete successful cases. A successful local run alone did not establish enough headroom.

The unchanged local baseline passed eight graph and budget assertions. Its successful full cases took 8451.13 and 8381.12 milliseconds. The focused command exited 1 because the repository requires complete source coverage, which this selection does not provide.

## Repair

Workspace assembly previously copied each file serially. It now schedules independent copies through the existing lazy capped all utility. The default cap remains eight. Manifest bounds, parent checks and stale-file removal complete first. Source verification, secret checks, execute flags, file synchronization, atomic rename and directory synchronization remain. The shared utility stops admission on failure and drains already admitted work.

New shared batch cases cover two and seventeen real files, executable modes, stale destination removal, changed sources and deleted sources. At return, every case requires zero open descriptors under its own directory. Every retained file must match its manifest; leftover temporary files also fail that check. Existing shared concurrency cases cover the worker cap and failure admission policy.

## Verification so far

Typecheck passed. The selected graph, workspace, modes, budgets, descriptor and concurrency suites passed 104 tests across six files in 20.10 seconds. Successful full graph cases took 7475.10 and 7277.10 milliseconds. The selection exited 1 for omitted global coverage. No deadlines, assertions, coverage requirements or durability checks were relaxed.

Temporary timing instrumentation, removed before the selection above, measured execution at 6410.82 and 6233.64 milliseconds, journal delivery checks at 437.91 and 401.84 milliseconds, and journal reload at 836.08 and 836.96 milliseconds. An earlier modified run took 13308.17 milliseconds for its first full case despite passing the execution deadline, so these local timings are evidence, not a stable-host performance guarantee.

The complete installed-package check passed for archive 4ecfbf4c24050f3f6b91d173f1973839e9dbc6fc. It ran outside the checkout in offline Podman, including native SDK recovery, delayed backoff, mixed file delivery, active process recovery and parallel request turns against versioned stubs. No live vendor claim follows from those probes.

A deliberate mutation removed awaiting the workspace copy batch. Typecheck still passed, but nine workspace assertions failed, including the seventeen-file case and both new failure-drain cases. The mutation was restored in finally and restored typecheck passed. Formatting, spelling across 722 files, and specification validation passed. Normal commit and push hooks and independent CI remain pending. Task 32.2 stays open because this repair does not establish the complete reference rule set. The product remains unready for production acceptance.

The repair committed as c8ce85eb9875be31ff4ce0639ca851322c0521c8. The normal staged suite passed 2187 tests across 123 files in 243.79 seconds with all 182 product sources and zero gaps; its gate took 257.76 seconds and message validation 0.48 seconds. The normal outgoing suite passed 2187 tests in 245.07 seconds with zero gaps; its gate took 258.77 seconds. Main was pushed and its remote hash confirmed. Independent CI 42470987942 completed successfully.

Independent CI passed 2187 tests across 123 files in 292.31 seconds with 182 product sources and zero gaps. Successful full graph cases took 10428.30 and 10447.30 milliseconds, against the unchanged execution deadline. This establishes one successful independent run, not a production performance guarantee.
