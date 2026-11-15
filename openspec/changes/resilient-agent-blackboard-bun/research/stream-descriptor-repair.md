# Stream descriptor repair

## Failure and reproduction

Main 84760fe0263a966a7cb1e08f30da10ba56f0c024 was pushed normally. Its outgoing suite passed 2116 tests with 181 sources and zero coverage gaps in 260.94 seconds; the gate took 279.96 seconds. Remote CI 42463573767 failed during the second 40-node graph case with ENFILE and then EMFILE across the remaining suite. This was not accepted as an infrastructure-only failure or retried unchanged.

A local pinned Bun 1.3.10 diagnostic consumed the same file through sourceChunks 1000 times. Open descriptors grew from 12 to 1012 despite FileHandle.close. Explicit stream.destroy before file.close kept the count at 12. Both workspace sourceChunks and journal boardLines used the affected FileHandle.createReadStream with autoClose false.

The new offline regression reads each source 32 times and inspects only descriptors under its own temporary directory through a shared capped helper. Its original six cases all failed on the original implementation: completed workspace and journal cases retained 37 descriptors each, while early returns and consumer failures each retained five from fixture setup. These are actual retained input descriptors, not whole-process noise.

## Repair and verification

The first repair made both readers own their stream explicitly and destroy it in finally before closing their handle. It was superseded by the single-owner repair below. Existing mode checks, no-follow opening, streaming, byte bounds and journal parsing remain. Full and empty consumption, early returns and consumer exceptions have separate shared cases. No limits or timeouts were raised.

The first repaired selection passed 70 tests across six files in 18.70 seconds, including both 40-node orders and refutation branches, workspace and journal checks, byte streams and server cleanup. Its focused command retained the expected omitted global coverage failure. Final expanded cases, mutations and normal full gates are recorded below when observed.

Host: Linux 6.17.0-1033-oem x86_64, Bun 1.3.10, rootless Podman 4.9.3 and Git 2.43.0. No vendor network calls or Titan skill operation occurred.

The expanded final selection passed 72 tests across six files in 18.92 seconds. Removing only workspace cleanup and then only journal cleanup made all eight descriptor cases fail in 321 ms and 295 ms respectively. Both mutations passed typecheck and were restored in finally. Initial fixture reads use both readers, so either missing cleanup is observable in every case. Final restored typecheck passed. Biome passed 634 files; specification validation reported 337 requirements, 723 scenarios and zero errors. Unused-code analysis passed. Spelling initially refused the two actual operating-system error names; they were added to the central technical dictionary rather than ignored.

The first fresh installed-package verification was intentionally interrupted when the person requested a stop. Its partial output is not a successful package check. It had reached native recovery, retry, backoff, mixed graph, active recovery and request-turn probes. The person subsequently authorized full delivery again. A fresh complete package check and normal staged and outgoing gates are required before this repair is accepted.

The fresh complete installed-package check passed for archive 52731f23e4558875346c240ec78af8d0c9145f68. It installed outside the checkout and completed CLI/MCP request checks, 16 SDK recovery cases, four Claude retry cases, six backoff cases, four mixed backoff cases, four mixed eight-node deliveries from two origins, four active SDK recovery cases, eight request-turn cases and four parallel request-turn cases. This is stubbed installed-runtime evidence, not live-vendor or self-development acceptance.

## Full-gate correction

The first normal commit gate rejected the repair: 2123 tests passed and the workspace consumer-failure case failed because its iterator delivered zero chunks. Coverage still had zero gaps. Explicit stream.destroy plus file.close was not accepted as sufficient: the separate Bun wrapper can finish cleanup after the file descriptor is reused. This observation extends the diagnosis beyond the original retained-descriptor reproduction.

The revised repair removes FileHandle.createReadStream wrappers. A shared fileHandleChunks generator reads bounded 64 KiB buffers directly from the caller-owned handle; each yield owns its buffer. Workspace mode checks and no-follow opening remain. The journal and bounded document reader use the same generator and close their sole handle in finally. The workspace declares its new direct streams dependency. Borrowed-handle cases cover empty and binary reads and closed-handle and directory failures. The original descriptor, early return and consumer error assertions remain unchanged. The new implementation needs restored focused, installed and full-gate evidence before committing.

The revised single-owner reader passed all 76 tests across six files in 21.83 seconds. Removing the workspace close and then the journal close made all eight descriptor cases fail in 303 ms and 308 ms. Both variants passed typecheck, were restored in finally and the restored tree passed typecheck. The borrowed-handle error cases and original assertion that the consumer sees one chunk remained strict.

The revised complete installed-package check passed for archive 2bd0cc15717d02b3f4dc43ffedc80373d7851ef0. All previously listed installed SDK and request probes completed with the single-owner buffered reader. The earlier archive is superseded for this repair.

The next normal commit gate passed all 2128 tests in 239.53 seconds, but refused an uncovered closing line in the unbounded generator loop. The generator now uses an explicit end-of-file loop condition so the executed control flow has no unreachable loop exit. The same cleanup and behavioral assertions remain; coverage requirements are unchanged. Typecheck and formatting passed before rerunning the normal gate.

The final repair committed as db850d0e787509ebce0427514b4070a2afccd84b. Its normal staged suite passed 2128 tests across 121 files in 267.15 seconds, with all 181 product sources and zero gaps. The staged gate took 281.41 seconds and message validation 0.49 seconds. The normal outgoing suite passed the same 2128 tests in 241.32 seconds with zero gaps; its gate took 254.89 seconds. Main was pushed and its remote hash confirmed. Independent CI 42467262086 completed successfully. The EOF-loop correction followed the recorded installed-package archive, so that archive is evidence for the shared reader ownership design, not an exact archive of the final commit.
