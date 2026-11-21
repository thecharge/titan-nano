# Installed recovery delivery

## Offline checks

- The [recovery example](../../../../examples/README.md#offline-restart-with-codex-and-claude) uses a fresh archive installation and both pinned SDK libraries with local vendor stubs. It checks and dry-runs the shipped workflow. Two workers meet before either can finish. One case kills the daemon during Claude's rate-limit wait. The other swaps the adapters and interrupts the Codex response.
- The final check resumes its native session on attempt one. The vendor invocation logs show one start for each completed phase and one resume for the final check. The installed CLI lists, shows and exports the checked file. A manual copy into a fresh path succeeds. A second copy refuses to overwrite it. In-place application remains under task 30.5.
- Publication tests interrupt the knowledge journal, file and receipt stages. Reopening the engine and hub preserves already published files on disk, one version of each entry, one passed journal event and the checked artifact. Both SDKs are exercised. The post-commit fault uses the run projection boundary and reopens the engine in the test process.
- Two negative controls change the saved outcome presented to the restart assertions. Task 31.6 remains open for runtime mutations and the full fault matrix, including killing the daemon at the publication boundary.

## Titan self-development record

Run `bab761a8-0e4e-4690-af5a-5aaf29e1ac86` used the installed `@titan/cli@0.1.0-alpha.1` controller with SHA-256 `d7b4dd77962d9ef8b679477c9320de00194b219a09db6861db4370b50d0a6136`. The Codex SDK worker edited this checkout. The separate Titan reviewer refuted the candidate. It identified a missing dry run, missing vendor invocation checks and rewrites after a durable knowledge receipt. Titan restored the live paths and retained the candidate.

The delivery recovered that candidate and applied manual corrections for those findings. Review the failed run with `titan status` and `titan events` in its creating home. Raw journals stay in the local run store. The corrected code passed verification through the repository's offline gates. Task 31.5 remains open for a passing self-development run with the approved script gate inside Titan.

## Release boundary

The [preview guide](../../../../docs/preview.md) records offline recovery for both SDKs. Live provider recovery remains unverified. The full release gate remains closed.
