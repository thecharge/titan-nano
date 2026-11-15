# Proof check probe

Run on 2026-11-06 on Linux x86-64. Versions are in `versions.txt`. The probe was built in a scratch folder, and only its source files and outputs are kept here. The results are explained in `research/proofs.md`.

No test here calls a real model or a real API. Lean and Z3 ran in containers with `--network none`. The Bun test in `z3-js/` loads `test/guard.ts` before every test file. It is the guard from `probes/dev-standards/`, which removes key variables and blocks the network.

- `images/lean-bwrap/Dockerfile`: Ubuntu 24.04 with bubblewrap 0.9.0, git and a non-root user `prover`. The Lean 4.35.0 toolchain is not in the image. It is mounted read-only from the unpacked release archive.
- `images/z3/Dockerfile`: Ubuntu 24.04 with the `z3` package, Z3 4.8.12.
- `lean/proj/`: the Lake project. `Challenge.lean` holds the locked statements with `sorry`. `comparator.json` names the two theorems and the three permitted axioms.
- `lean/cases/`: six solution files: `good`, `sorry`, `weakened`, `redefined`, `axiom` and `native`.
- `lean/run-cases.sh`: for each case, it runs plain `lean`, `lake check` with no default target, `lake check` with the default target `Solution`, and `lake comparator`. It prints the exit code, the time and the output.
- `lean/run-in-container.sh`: the exact `docker run` command. It needs `--privileged`, because bubblewrap inside Docker could not mount `/proc` otherwise.
- `lean/out/cases-v7.out`: the final run. Only `lake comparator` rejected all 5 cheats. `lake check` with a default target passed `weakened` and `redefined`. Plain `lean` and `lake check` with no default target passed all 6.
- `lean/out/cases-v1.out` to `cases-v6.out`: earlier runs that failed for setup reasons. They are kept as evidence.
- `z3-cli/claim-true.smt2`, `claim-false.smt2`, `claim-hard.smt2` and `run-z3.sh`: three claims for the `z3` program with a 5 s limit.
- `z3-cli/z3-cli.out`: `unsat` (proven), `sat` with x = 1 (refuted), and `timeout` (not proven). The exit code was 0 every time.
- `z3-js/test/z3.test.ts` and `z3-js/plain.mjs`: the `z3-solver` npm package 5.3.1.
- `z3-js/z3-output.txt`: the Bun test. 0 pass, 1 fail, with "Aborted(Assertion failed)". The failure is kept as evidence.
- `z3-js/runtimes.txt`: the same file under Node v24.14.1 (counterexample found in 173 ms) and under Bun 1.3.10 (error, then a hang until `timeout` stopped it, exit 124).

To run the Lean cases again, unpack the Lean 4.35.0 Linux release archive, build `images/lean-bwrap`, and run `lean/run-in-container.sh <unpacked folder> > lean/out/cases-v8.out`. To run the Z3 claims again, build `images/z3` as `titan-probe/z3:1` and run `z3-cli/run-z3.sh`.
