# Research: goals and steps that a program can prove

**Reader:** a developer new to `titan`. **Purpose:** know how `titan` checks a goal, a step or an outcome with a real proof, and which proof tools it calls. Also know how a proof result becomes a number on the board and on the dashboard. Each pick has a source quote or a test.

On 2026-11-06 the user asked that goals, tasks, steps and outcomes be checkable in a fixed way, with real proofs. The user's examples were Lean and theorems that can be proven in mathematics. The user wants the result to be measurable. The user asked for research with real evidence, in plain language, and in OpenSpec.

All tests ran on 2026-11-06 on Linux x86-64. Lean 4.35.0 and Z3 4.8.12 ran in containers with no network (`--network none`). The probe is in `probes/proofs/`, with its versions in `probes/proofs/versions.txt`. No test called a real model. Every quote below is copied from the fetched page. The page text is in `proofs-sources/<id>.txt`, and the links are in `proofs-sources/urls.tsv`. All 37 pages returned HTTP 200. To check the quotes, run this from the `research/` folder:

```bash
python3 -I check-quotes.py proofs.md proofs-sources probes
```

## Words used here

- A _proof checker_ is a program that reads a proof and says yes or no. The answer does not depend on a model or on chance.
- _Lean_ is a programming language and proof assistant. Its _kernel_ is the small part that checks each proof.
- _Lake_ is Lean's build tool. `lake comparator` and `lake check` are two of its commands.
- A _locked statement_ is the exact theorem that an agent must prove. The main agent writes it and a person approves it. The agent that writes the proof cannot change it.
- In Lean, the locked statement sits in a file called `Challenge.lean`, with `sorry` in place of the proof. The agent writes `Solution.lean`.
- An _axiom_ is a fact that Lean accepts without proof. `sorry` and `native_decide` add axioms in the background.
- The _permitted axioms_ are the three standard ones: `propext`, `Quot.sound` and `Classical.choice`.
- _Z3_ is an SMT solver. It checks claims about numbers, arrays and similar values. You give it the opposite of a claim. If it finds no example (`unsat`), the claim is true. If it finds one (`sat`), the example is a _counterexample_.
- _bubblewrap_ (`bwrap`) is a Linux sandbox program. Lake uses it to run untrusted builds.
- _RLVR_ (reinforcement learning with verifiable rewards) trains a model with rewards from a checker instead of from a person or a model.

## 1. The proof tools, side by side

The table lists what each project says about itself. "Tested here" means that the probe in `probes/proofs/` ran it.

| Tool                                          | License    | What it checks                               | Fits a Bun program             | Tested here    |
| --------------------------------------------- | ---------- | -------------------------------------------- | ------------------------------ | -------------- |
| Lean 4.35.0, `lake comparator` (P1, P31, P32) | Apache-2.0 | a locked theorem, the axioms, and the kernel | yes, as a separate program     | yes, 6 cases   |
| Lean 4.35.0, `lake check` (P31)               | Apache-2.0 | axioms and the kernel, not the statement     | yes, as a separate program     | yes, 6 cases   |
| Plain `lean` on one file (P1)                 | Apache-2.0 | only that the file compiles                  | yes, as a separate program     | yes, 6 cases   |
| comparator, the old separate repo (P5, P26)   | Apache-2.0 | the same as `lake comparator`                | —                              | no: archived   |
| lean4checker (P6)                             | —          | the kernel, again                            | —                              | no: deprecated |
| Lean REPL (P4, P27)                           | Apache-2.0 | one Lean session over JSON                   | yes, as a separate program     | no             |
| LeanstralSafeVerify (P7)                      | not read   | the axioms only                              | not read                       | no             |
| lean-lsp-mcp (P8, P28)                        | MIT        | nothing: it lets an agent use Lean           | yes, as an MCP server          | no             |
| Z3 4.8.12, the `z3` program (P33, P35)        | MIT        | claims over numbers and similar values       | yes, as a separate program     | yes, 3 claims  |
| Z3, the `z3-solver` npm package 5.3.1 (P18)   | —          | the same as Z3                               | no: it failed under Bun 1.3.10 | yes            |
| Dafny (P19, P34, P36)                         | MIT        | programs against their specifications        | yes, as a separate program     | no             |
| Verus (P20, P37)                              | MIT        | Rust programs                                | yes, as a separate program     | no             |
| TLA+ tools (P21)                              | not read   | designs of systems                           | needs Java                     | no             |
| Rocq (P22)                                    | not read   | proofs, like Lean                            | yes, as a separate program     | no             |
| Isabelle (P23)                                | not read   | proofs, like Lean                            | yes, as a separate program     | no             |

Lean is a programming language and a proof assistant:

> [P2] "Lean is an open-source programming language and proof assistant that enables correct, maintainable, and formally verified code"

> [P32] ""license":"Apache-2.0""

Lean 4.35.0 added the two Lake commands. `lake comparator` checks that each named theorem proves the same statement as in the challenge:

> [P31] "#14990 adds lake check, which builds the default targets of the current project, exports them, replays the export through the kernel, and fails if anything uses an axiom other than the standard ones."

> [P31] "#14885 and #15146 add lake comparator, a frontend to comparator: given a challenge module with theorem statements and a solution module, it checks that each named theorem in the solution proves the same statement as in the challenge, that it uses only the permitted axioms, and that the kernel accepts it."

Both commands treat the proof as untrusted, and the sandbox works only on Linux:

> [P31] "Both commands treat the project as untrusted."

> [P31] "It is built and exported inside a bubblewrap sandbox that hides the user's home directory and only gives network access to dependency resolution (#15005), and the kernel runs in a separate process (#15055)."

> [P31] "The sandbox is currently only available on Linux."

With `--paranoid`, the commands also run four other kernels, written by other people:

> [P31] "With --paranoid, both commands run all of these checkers in addition to Lean's own kernel, and accept the project only if every one of them does (#15145):"

The old separate tools are no longer kept up:

> [P5] "This project has been merged into core as of Lean release v4.35.0 in the form of `lake comparator`"

> [P26] ""archived":true"

> [P6] "**This repository is deprecated and will be archived.**"

The old comparator README lists what must be true for its answer to be right. Two of them matter for `titan`. The challenge must not have been built together with an agent's files before. And the checker must not run as a privileged user:

> [P5] "You have not previously tried to compile the `Solution` file or any other potentially adversarial"

> [P5] "6. You are not running this under a privileged user"

The three standard axioms:

> [P9] "This is found in the Classical namespace, so the full name of the theorem is Classical.choice."

Other tools do other jobs. The REPL gives an agent a Lean session. lean-lsp-mcp gives an agent Lean through MCP. Neither one is a judge:

> [P4] "Communicates via JSON on stdin and stdout."

> [P8] "MCP server that allows agentic interaction with the [Lean theorem prover]"

> [P7] "Checks the second file's theorems to make sure they only use the three standard axioms."

Dafny, Verus, Rocq and Isabelle check other kinds of proofs:

> [P19] "shows you counterexamples"

> [P20] "Verus is a tool for verifying the correctness of code written in Rust."

> [P22] "The Rocq Prover is an interactive theorem prover, or proof assistant."

> [P23] "Isabelle is a generic proof assistant."

The license files of Z3, Dafny and Verus are MIT:

> [P35] "MIT License"

> [P36] "MIT License"

> [P37] "Permission is hereby granted, free of charge, to any person obtaining a copy"

## 2. Test: five ways to cheat a Lean check

**What the test does.** The probe locks one statement: the sum 0 + 1 + … + n, times 2, equals n × (n + 1). It also locks one fact about n = 100. The locked file is `probes/proofs/lean/proj/Challenge.lean`. The probe then gives six solution files to three checks. One solution is a real proof. The other five cheat:

- `sorry`: the proof is left out.
- `weakened`: the agent changed the statement to `sumTo n = sumTo n`, which is always true.
- `redefined`: the agent wrote the definition of the sum in another, equal way.
- `axiom`: the agent added its own axiom, `trust_me`, that says the statement is true.
- `native`: the agent proved the fact for n = 100 with `native_decide`. This runs compiled code instead of the kernel.

The checks ran as the non-root user `prover`, with no network. The command is in `probes/proofs/lean/run-in-container.sh`. The output is in `probes/proofs/lean/out/cases-v7.out`.

**Results.** "accepts" means exit 0. "rejects" means exit 1.

| Solution  | Plain `lean` | `lake check`, no default target | `lake check`, default target `Solution` | `lake comparator` |
| --------- | ------------ | ------------------------------- | --------------------------------------- | ----------------- |
| good      | accepts      | accepts                         | accepts                                 | accepts           |
| sorry     | accepts      | accepts                         | rejects                                 | rejects           |
| weakened  | accepts      | accepts                         | **accepts**                             | rejects           |
| redefined | accepts      | accepts                         | **accepts**                             | rejects           |
| axiom     | accepts      | accepts                         | rejects                                 | rejects           |
| native    | accepts      | accepts                         | rejects                                 | rejects           |

Only `lake comparator` rejected all five cheats. It answered in 1377 ms to 1814 ms per case. `lake check` with a default target took about 62 s per case, and it passed the weakened and the redefined statement. `lake check` with no default target checked nothing: it printed "Uses no axioms" even for `sorry`. Plain `lean` exits 0 even when the file uses `sorry`.

> [probe:proofs/lean/out/cases-v7.out] "lake comparator exit=0 ms=1814"

> [probe:proofs/lean/out/cases-v7.out] "Your solution is okay!"

> [probe:proofs/lean/out/cases-v7.out] "error: Illegal axiom detected: 'sorryAx'"

> [probe:proofs/lean/out/cases-v7.out] "error: Challenge and solution theorem statement do not match: 'sumTo_formula'"

> [probe:proofs/lean/out/cases-v7.out] "error: Const does not match between challenge and target 'sumTo._f'"

> [probe:proofs/lean/out/cases-v7.out] "error: Illegal axiom detected: 'trust_me'"

> [probe:proofs/lean/out/cases-v7.out] "error: Illegal axiom detected: 'sumTo_100._native.native_decide.ax_1_1'"

> [probe:proofs/lean/out/cases-v7.out] "plain lean exit=0 ms=157"

> [probe:proofs/lean/out/cases-v7.out] "lake check, default target Solution, exit=0 ms=62002"

**What this means for `titan`.**

- `titan` uses `lake comparator` as the Lean check. A plain build is not a proof.
- The definitions must stay exactly as in the locked statement. The redefined case shows that `lake comparator` rejects even an equal definition written another way. So the locked statement holds the definitions, and the agent copies them as they are.
- `native_decide` is not allowed. It adds an axiom, and `lake comparator` rejects it.

**What went wrong on the way.** Runs v1 to v6 failed for setup reasons, and their output is kept in `out/`. In run v6, bubblewrap inside Docker could not mount `/proc`. The probe then ran Docker with `--privileged`, still as the non-root user `prover`. The old comparator README asks that the checker does not run as a privileged user (section 1). A `titan` host must run `lake comparator` on Linux without `--privileged`. This was not tested here.

## 3. Test: three claims for Z3

**What the test does.** The probe gave three files in SMT-LIB format to the `z3` program, with a time limit of 5 s (`-T:5`). Each file holds the opposite of a claim. The files and the script are in `probes/proofs/z3-cli/`. The output is in `probes/proofs/z3-cli/z3-cli.out`.

| File               | Claim                    | Z3 answer                            | Exit code | Time, with container start |
| ------------------ | ------------------------ | ------------------------------------ | --------- | -------------------------- |
| `claim-true.smt2`  | a true claim             | `unsat`: proven                      | 0         | 355 ms                     |
| `claim-false.smt2` | a false claim            | `sat`, with the counterexample x = 1 | 0         | 341 ms                     |
| `claim-hard.smt2`  | a claim too hard for 5 s | `timeout`: not proven                | 0         | 5370 ms                    |

> [probe:proofs/z3-cli/z3-cli.out] "Z3 version 4.8.12 - 64 bit"

> [probe:proofs/z3-cli/z3-cli.out] "== claim-true.smt2: exit 0, 355 ms (includes container start) unsat"

> [probe:proofs/z3-cli/z3-cli.out] "== claim-false.smt2: exit 0, 341 ms (includes container start) sat ( (define-fun x () Int 1) )"

> [probe:proofs/z3-cli/z3-cli.out] "== claim-hard.smt2: exit 0, 5370 ms (includes container start) timeout"

**What this means for `titan`.** The exit code was 0 in all three cases. So `titan` must read the first word of the answer, not the exit code:

- `unsat` means proven.
- `sat` means refuted. `titan` saves the counterexample.
- `timeout`, `unknown` or anything else means not proven.

## 4. Test: Z3 inside Bun

**What the test does.** The probe ran the `z3-solver` npm package 5.3.1 once under Bun 1.3.10 and once under Node v24.14.1. Both ran the same file, `probes/proofs/z3-js/plain.mjs`. The output is in `probes/proofs/z3-js/z3-output.txt` (the Bun test) and `probes/proofs/z3-js/runtimes.txt` (both runtimes).

**Results.** Under Node, it found the counterexample in 173 ms. Under Bun, the package stopped with an error, and the program then hung until `timeout` stopped it after 60 s (exit 124).

> [probe:proofs/z3-js/runtimes.txt] "runtime node v24.14.1: "x*x > x" negation sat, x = 1, ms 173"

> [probe:proofs/z3-js/z3-output.txt] "Aborted(Assertion failed)"

> [probe:proofs/z3-js/runtimes.txt] "bun exit=124"

**What this means for `titan`.** `titan` runs Z3 as a separate program, the same way it runs Lean. It does not load Z3 into its own Bun process.

## 5. Why the statement must be locked

A checker proves only the statement it is given. If the agent that writes the proof can also change the statement, the proof means nothing. The `weakened` case in section 2 shows this. Writers on AI and proofs say the same:

> [P14] "the challenge will move to correctly defining the specification: that is, how do you know that the properties that were proved are actually the properties that you cared about?"

Models have been seen changing tests to get a better score:

> [P15] "attempting (often successfully) to get a higher score by modifying the tests or scoring code"

So in `titan`:

- The main agent or a person writes the locked statement. A person approves it.
- `titan` writes the hash of the locked statement on the board. It checks the hash before each check.
- The agent that writes the proof gets the statement only to read.

Contests of AI provers judge in the same way, with comparator:

> [P29] "A submission is scored entirely by comparator results: a problem counts as solved iff comparator accepts the submitted solution."

## 6. How a proof result becomes a number

A check gives one of three answers: proven, refuted or not proven. `titan` counts them. This is what makes a run measurable: "proven 3 of 4" is a fact that anyone can check again with the same command.

Model training already uses checker answers as rewards:

> [P16] "a novel method we call Reinforcement Learning with Verifiable Rewards (RLVR)"

> [P17] "superior performance on verifiable tasks such as mathematics, coding competitions, and STEM fields"

AI provers improve when they read the checker's errors and try again:

> [P12] "Verifier-guided self-correction: We enable the model to iteratively revise its proofs by leveraging feedback from the Lean compiler"

> [P11] "reaching 88.9% pass ratio on the MiniF2F-test and solving 49 out of 658 problems from PutnamBench"

> [P13] "combines formal verification with informal reasoning, achieving gold-medal-equivalent performance on the 2025 International Mathematical Olympiad problems"

Hard proofs are still out of reach for most models. So "not proven" must be a normal answer, not an error:

> [P25] "One (GPT-6 Astra) scored 3%, and all others scored 0%."

> [P24] "| Lean 4 | 672 |"

So in `titan`:

- A step with a proof check gets the verdict `proven`, `refuted` or `not proven`.
- `titan` writes every answer into `proofs.json` in the run record. `result.md` shows "proven N of M".
- The self-training reward and the persona numbers use the share of proven checks.
- The dashboard shows the proof answer next to each step.
- The checker's error text goes back to the agent, so that it can try again.

## 7. Claims that were wrong or could not be checked

- The old comparator README (P5) says that the user must have `landrun` in `PATH`. The Lean 4.35.0 notes (P31) say that `lake comparator` uses bubblewrap instead. The probe used bubblewrap, so the README is out of date on this point.
- The GitHub API shows Z3 and Dafny as "NOASSERTION" (P33, P34). Their license files (P35, P36) say MIT, so the license files are the source to trust.
- `lake check` (P31) "fails if anything uses an axiom other than the standard ones". The test agrees, but only when the project has a default target. With no default target, it accepted `sorry` (section 2).
- `z3-solver` (P18) is published as TypeScript bindings. It did not work under Bun 1.3.10 (section 4).

## 8. All picks in one table

| Idea                                                                                   | Source             | Pick                                                                         | Where in the specs                                       |
| -------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| A step or goal can have a `verify` entry that a program checks                         | user request       | kept                                                                         | spec workflow-file, spec verified-checks                 |
| `lake comparator` as the Lean check                                                    | P31, test          | kept: it rejected all 5 cheats in under 2 s                                  | spec verified-checks                                     |
| `lake check` as the Lean check                                                         | P31, test          | not kept: it passed the weakened and redefined cases, and it took about 62 s | —                                                        |
| Plain `lean` as the Lean check                                                         | test               | not kept: it accepts `sorry`                                                 | —                                                        |
| `--paranoid`                                                                           | P31                | kept, as an option of the `verify` entry; not tested                         | spec verified-checks                                     |
| Pinned Lean toolchain, Linux sandbox, no network                                       | P31, test          | kept                                                                         | spec verified-checks                                     |
| The `z3` program as the check for claims over numbers                                  | test               | kept                                                                         | spec verified-checks                                     |
| Read the Z3 answer word, not the exit code                                             | test               | kept                                                                         | spec verified-checks                                     |
| The `z3-solver` package inside Bun                                                     | test               | not kept: it failed under Bun 1.3.10                                         | —                                                        |
| A locked statement, approved by the main agent or a person, with its hash on the board | P14, P15, P5, test | kept                                                                         | spec verified-checks                                     |
| Definitions copied exactly from the locked statement                                   | test               | kept                                                                         | spec verified-checks                                     |
| Verdict `proven`, `proofs.json`, "proven N of M"                                       | P16, P17, P29      | kept                                                                         | spec verified-checks, spec workflow-run                  |
| The checker's error text goes back to the agent                                        | P12                | kept                                                                         | spec verified-checks                                     |
| Reward and persona numbers use the share of proven checks                              | P16, P17           | kept                                                                         | spec self-training-orchestration, spec persona-lifecycle |
| A fixed script as a third kind of check                                                | user request       | kept                                                                         | spec verified-checks                                     |
| The Lean REPL or lean-lsp-mcp as the judge                                             | P4, P8             | not kept: they help an agent work, but they do not judge                     | an agent may use them as tools                           |
| Dafny, Verus, TLA+, Rocq, Isabelle                                                     | P19–P23            | not kept in this change: not tested                                          | an open question in design.md                            |

## 9. Not tested

- `lake comparator` on a Linux host without `--privileged` Docker.
- `--paranoid` and the external kernels.
- A locked statement that imports Mathlib.
- A real model writing a proof. All solutions were written by hand.
- Dafny, Verus, TLA+, Rocq and Isabelle.
- The Lean REPL, lean-lsp-mcp and LeanstralSafeVerify.
- Z3 claims over arrays, bit vectors or strings.
- Lean or Z3 on macOS or Windows.
