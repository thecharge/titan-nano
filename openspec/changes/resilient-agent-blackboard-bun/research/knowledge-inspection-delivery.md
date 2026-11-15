# Knowledge inspection completion

This sequence refines product task 33.3 and repair task 4.4. Existing scope filters, counts, pending inspection and stored-run summaries remain useful, verified components. They do not close the missing history and per-kind date requirements.

## Starting gaps

`ScopedKnowledgeHub.show` reports the number of earlier versions but returns no historical content. Version files already live below `.history/<kind>/<id>/`. Both ordinary and read-only statistics compute oldest and newest dates across a scope, while kind rows contain only counts. The dashboard consequently shows dates only at scope level.

## Bounded implementation sequence

- [x] H1 Add a strict, paginated read-only history contract to the knowledge client and both local readers. Retain entry identity, kind, version, exact content and a continuation cursor. Bound entries and serialized bytes. Validate each path component, regular-file identity, links, version order and entry size. Keep historical reads separate from usage accounting and publication.
- [x] H2 Expose history through authenticated HTTP and its checked client. Validate requested identity, cursor, returned versions and truncation. Keep this operator capability separate from native private-attempt publication. Reuse the existing transport credentials and response budget.
- [x] H3 Add oldest and newest dates for every kind in ordinary and read-only statistics. Share the calculation and preserve empty-kind behavior. CLI statistics must expose the same validated values as the dashboard.
- [x] H4 Extend show and the dashboard with actual version bodies and bounded continuation. Keep selected scope and entry identity in every continuation. Display per-kind dates beside their counts. Historical content must remain text rather than executable markup.
- [x] H5 Run local, actual-server, CLI and browser acceptance; refresh screenshots after implementation. Run complete source coverage and installed acceptance against one frozen product identity. Close task 33.3 and repair 4.4 only after their complete mapped requirements pass.

H1 precedes H2 and H4. H3 can proceed independently. H5 depends on H1 through H4. All five steps now have complete local evidence. This closes inspection and stored-run listing, not the shared-fabric protocol or production readiness.

## Required negative evidence

Each subject needs at least two positive and two negative cases in the shared flat case tables. History cases must cover Markdown and persona YAML, multiple pages, absent retained versions, identity substitution, changed version numbers, linked parent directories, linked files, hard links, malformed content and byte limits. Client cases must reject foreign ids and invalid cursors before dispatch, and mismatched responses after dispatch. Date cases must distinguish kinds with different modification ranges and preserve null dates for empty kinds. Read-only cases must show unchanged catalogue bytes and read counters.

The actual-server matrix must cover project and home versions without opening a second writer. CLI show must expose the same retained content. Browser proof must exercise history continuation and kind dates, not merely a count of earlier versions. Passing those focused cases does not establish the remaining shared-fabric write boundary.

## Focused evidence

Offline session 87049 passed 126 tests with zero failures and 230 expectations across three files. This covers local and inspected Markdown and YAML history, pagination, byte limits, path and identity refusal, client validation, repeated per-kind dates, CLI contracts and actual-server project/home inspection. Typecheck session 25397 passed. A real Chrome session followed the version-53 continuation to the page containing versions two and one. It checked both retained bodies and the absence of a further continuation. The screenshot is under docs/screenshots/harness-repair/history.png. A second browser probe proved retained markup stays literal text, with no image element or executed handler. Packed-command probes assert history, dates and future-cursor refusal.

An independent byte-budget probe then found that array brackets and commas were missing from the history size calculation. The repair retains those bytes in the budget. Four flat boundary cases cover exact fit, below limit, framing overflow and one-byte overflow, preserving continuation without losing a version. Focused session 22903 passed 198 tests with zero failures and 306 expectations across five files. Linked roots and oversized client replies are refused too.

## Complete acceptance

The final frozen manifest covers 448 product files with aggregate SHA-256 `ebbe744472cd1c95382eca628c36ec758a031f8c5ce858cde5481ba90f9ebdfb`. Per-file hashes are retained in the repair change at research/history-final-product-sha256.txt. Full source session 40274 exited zero: 5,613 passed, one skipped and zero failed, with 8,673 expectations across 335 files in 767.30 seconds. Coverage checked 446 product TypeScript files with zero line or function gaps. Installed session 27773 exited zero; archive SHA-256 `16e1768ef584b6b78d83698d5e655b3359400ec8f0893a67d491f706f2ad8ae6`. All 448 product files matched the frozen manifest after both gates.

The complete suite includes actual-server project/home inspection, CLI selector refusal, read-only catalogue checks, pending visibility and stored-summary migration races. Persisted-dashboard cases seed 200 runs, start the actual server with two resident slots, restart it and require listing below two seconds while retaining journal bytes and creating no event indexes. Separate list cases assert stage and persona without snapshot, event or usage reads. Screenshots are retained under docs/screenshots/harness-repair. These are local tests with controlled vendor responses, not live vendor or deployed production proof.
