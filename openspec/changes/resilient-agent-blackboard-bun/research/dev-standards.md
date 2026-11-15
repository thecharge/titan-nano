# Research: the test strategy and the code standards for `titan`

**Reader:** a developer new to `titan`. **Purpose:** know which tests to write, how a test is kept away from real APIs, and which rules the code and the commits follow. Each pick has a source or a test that tried to prove it wrong.

On 2026-11-05 the user asked for a test strategy in the change, in plain language, with unit tests, integration tests and test cases. Unit tests must not call real APIs. The user also asked for research on the best ways to develop and the best code standards.

All tests ran on 2026-11-05 on Linux x86-64 with Bun 1.3.10. The probe is in `probes/dev-standards/`, with its versions in `versions.txt`. Every quote below is copied from the fetched page. The page text is in `dev-standards-sources/<id>.txt`, and the links are in `dev-standards-sources/urls.tsv`. All 37 pages returned HTTP 200. To check the quotes, run this from the `research/` folder:

```bash
python3 -I check-quotes.py dev-standards.md dev-standards-sources probes
```

## Words used here

- A _unit test_ checks one small part of the code, such as one function, with no other process and no network.
- An _integration test_ checks several parts of `titan` together, such as the runner, the board and an adapter. In `titan`, it uses fakes in place of every outside service.
- An _end-to-end test_ runs the `titan` command, or the server, as a person or a program would. In `titan`, it also uses fakes.
- A _live test_ calls a real agent tool, a real model API or RunPod. It costs money, so it runs only when a person turns it on.
- A _test double_ is anything that takes the place of a real part in a test. A _fake_ is a test double that works, but takes a shortcut. A _stub_ gives fixed answers. A _mock_ checks how it was called.
- A _contract test_ is one set of checks that runs against a fake and against the real service. It shows that the fake still acts like the real service.
- A _property test_ checks a rule on hundreds of made-up inputs, instead of on a few hand-picked ones.
- _Coverage_ is the share of code lines that the tests run.
- _Mutation testing_ changes the code in small ways, such as `>` to `>=`, and runs the tests again. Each change is a _mutant_. A mutant that no test notices _survived_. The _mutation score_ is the share of mutants that some test noticed.
- A _test case_ in `titan` is one scenario from the specs, turned into one test with the same name.

## 1. Which kinds of tests, and how many

> [D1] "Write lots of small and fast unit tests . Write some more coarse-grained tests and very few high-level tests that test your application from end to end."

> [D35] "In short, tests that run end-to-end through the UI are: brittle, expensive to write, and time consuming to run."

> [D2] "Integration tests are those which test multiple units integrating with one another."

> [D2] "entire pages with HTTP requests mocked via MSW (integration tests)"

Fowler's _test pyramid_ says: many unit tests, fewer integration tests, and very few end-to-end tests. Dodds's _testing trophy_ puts the most weight on integration tests. Both agree on one point: the higher the test, the fewer you need. Note that Dodds also calls a test with mocked HTTP an integration test. That is the kind `titan` needs, because its outside services are paid APIs.

The Google Testing Blog post "Just Say No to More End-to-End Tests" (D18) was fetched, but its page text holds only the comments. The post itself loads by script. It is not used as evidence here.

**Pick:** many unit tests for the rules with numbers: the reward, the Wilson bound, the fading counts, the limits and the file checks. Integration tests for each package with fakes. One end-to-end test for each example file and for each spec that has a command. Live tests only by hand or on a schedule. The proportions are not fixed, because the sources do not agree on them.

## 2. Unit and integration tests never reach a real API

> [D19] "Small tests are restricted to one thread, one process, one machine."

> [D19] "because unit tests are designed to be fast and reliable, they deliberately eliminate the chaos of real dependencies, network, and data."

> [D19] "If a large test is nonhermetic, it is almost impossible to guarantee determinism: other tests or user state may interfere with it."

A rule in a document does not stop a test from calling a real API. The probe tried a guard file that Bun loads before every test file:

> [D27] "An array of scripts/plugins to execute before running a file or script."

The first version blocked `fetch`, `node:net`, `node:tls` and `Bun.connect`. A test proved it wrong:

> [probe:dev-standards/out/no-network-v1-output.txt] "(fail) node:https request is blocked"

> [probe:dev-standards/out/no-network-v1-output.txt] "Received: "null""

In Bun, `node:https` does not go through the patched `node:net`, so the request reached example.com. The second version also guards `node:http` and `node:https`. A second gap: a child process does not load the guard file.

> [probe:dev-standards/out/child-process-output.txt] "curl from child process: exit 0 http 200"

This matters, because the Claude Agent SDK and the Codex SDK start the `claude` and `codex` programs. The third version lets a test start only Bun itself, `git`, and scripts under `test/fixtures`. It also removes every key variable from the environment. With all three parts, the probe passed:

> [probe:dev-standards/out/child-process-output.txt] "11 pass"

The guard turns itself off only when a `TITAN_LIVE_*` variable is `1`. An operating system block, a network namespace with `unshare -rn`, failed in this test environment with `Operation not permitted`. It was not tested further.

**Pick:** a guard file in `bunfig.toml` that blocks the network outside 127.0.0.1, blocks programs outside an allow list, and removes keys. A test of the guard itself runs in every test run.

## 3. Fakes, not recordings, with contract tests

> [D3] "Fake objects actually have working implementations, but usually take some shortcut which makes them not suitable for production (an InMemoryTestDatabase is a good example)."

> [D3] "Stubs provide canned answers to calls made during the test, usually not responding at all to anything outside what's programmed in for the test."

> [D20] "A fake is a lightweight implementation of an API that behaves similar to the real implementation but isn’t suitable for production; for example, an in-memory database."

> [D20] "the preference for real implementations developed over time as we saw that overuse of mocking frameworks had a tendency to pollute tests with repetitive code that got out of sync with the real implementation and made refactoring difficult."

> [D4] "The classical TDD style is to use real objects if possible and a double if it's awkward to use the real thing."

For `titan`, a real agent tool or model API is always awkward in a test: it costs money and gives a different answer each time. So `titan` uses real code for its own parts, and fakes only for outside services.

> [D20] "A fake must have its own tests to ensure that it conforms to the API of its corresponding real implementation."

> [D20] "raise an error if an unsupported code path is executed."

> [D5] "These check that all the calls against your test doubles return the same results as a call to the external service would."

> [D5] "These tests need not be run as part of your regular deployment pipeline."

> [D5] "Often running just once a day is plenty."

> [D1] "Together with contract testing and running contract tests against test doubles as well as the real implementations you can come up with integration tests that are faster, more independent and usually easier to reason about."

> [D24] "Contract testing is a technique for testing an integration point by checking each application in isolation"

The probe wrote one contract for the backend port and ran it against the fake backend and against the model-API adapter with the AI SDK's mock model. The live part ran only with `TITAN_LIVE_API=1`, so it was skipped:

> [probe:dev-standards/out/unit-output.txt] "21 pass"

> [probe:dev-standards/out/unit-output.txt] "2 skip"

> [D33] "To instead skip a test based on some condition, use test.skipIf() or describe.skipIf() ."

The other choice is to record real answers once and replay them:

> [D31] "Polly.JS is a standalone, framework-agnostic JavaScript library that enables recording, replaying, and stubbing of HTTP interactions."

> [D23] "It helps you intercept, observe, and affect the network of your application."

Recordings were not picked, for three reasons. A recording of a real call can hold the key in its headers, and `titan` must never write a key to a file. A recording goes stale when the vendor changes its answers, and only a contract test notices that. And the agent SDKs talk to a child program, not over HTTP from `titan`, so an HTTP recorder does not see their calls. The last point comes from the design's adapter section, and was not tested with Polly.JS or MSW.

**Pick:** one fake for each outside service, each with its own tests and an error for any call it has no script for. One contract test for each port, run against the fake in every test run, and against the live service only with a `TITAN_LIVE_*` variable.

## 4. The fakes that `titan` needs

> [D28] "Testing language models can be challenging, because they are non-deterministic and calling them is slow and expensive."

> [D28] "With mock providers and test helpers, you can control the output of the AI SDK and test your code in a repeatable and deterministic way"

> [D37] "It runs on **Node.js**, **Bun**, and **Deno**"

The probe linked a tool server and a client in memory, listed the tool and called it, with no process and no network. It also sent a persona through the model-API adapter with the mock model, and checked the system text that the model got.

| Outside service                              | Fake                                                                    | Seen working                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Claude Agent SDK, Codex SDK, Antigravity SDK | `packages/backend-fake`, and a fake agent program under `test/fixtures` | fake agent program in `probes/dev-standards/test/child-process.test.ts` |
| Model APIs (Anthropic, OpenAI, Gemini)       | the AI SDK mock model `MockLanguageModelV4`                             | `probes/dev-standards/test/contract.test.ts`                            |
| Tool servers                                 | the MCP SDK's linked in-memory transport                                | `probes/dev-standards/test/mcp-in-memory.test.ts`                       |
| RunPod                                       | the fake RunPod server with a fast clock                                | `probes/runpod/fake-runpod.ts`                                          |
| The person                                   | a test that answers requests with the person token                      | not yet built                                                           |
| The embedder                                 | a fixed embedder that gives the same vector for the same text           | not yet built                                                           |

## 5. Test cases: one test for each scenario

The specs hold the test cases already. Each `#### Scenario:` has a WHEN and a THEN. The probe has a check that reads every scenario and every test name of the form `<spec> > <scenario>`:

> [probe:dev-standards/out/scenario-map-output.txt] "186 scenarios, 2 with a test, 184 without, 1 unknown"

The check fails when a scenario has no test, and when a test names a scenario that does not exist. Some scenarios depend on chance, such as the persona pick. The specs already give them a fixed seed and many repeats.

> [D9] "it generates them for you, runs your assertion over hundreds of cases and shrinks failures down to the smallest inputs that still reproduces them."

The probe ran the four Wilson numbers from spec persona-lifecycle as examples. It also ran two property tests with a fixed seed. The first checks that the bounds stay between 0 and 1, around the rate. The second checks that more results give a narrower interval. All passed.

> [D8] "The first time this test runs, Bun serializes the argument to expect and writes it to a snapshot file"

A snapshot accepts whatever the code printed the first time. So `titan` uses snapshots only for the text of `titan guide` and `--help`, where a person reads the change in review.

For live tests of agents, the answer changes from run to run:

> [D29] "Each trial should be “isolated” by starting from a clean environment."

> [D29] "pass^k measures the probability that all k trials succeed."

> [D29] "If your agent has a 75% per-trial success rate and you run 3 trials, the probability of passing all three is (0.75)³ ≈ 42%."

**Pick:** a test for each scenario, named `<spec> > <scenario>`, and a check in every test run that fails when one is missing. Property tests with a fixed seed for the number rules. A live test starts from an empty `TITAN_HOME`, runs 3 times, and reports how many of the 3 passed. The 3 is a guess that has not been measured.

## 6. Is a test run strong enough? Coverage and mutation testing

> [D7] "If your test suite does not meet or exceed it, bun test exits with a non-zero exit code."

The probe set the coverage bar to 90 %. The run passed, then failed after an untested function was added:

> [probe:dev-standards/out/coverage-output.txt] "exit code: 1"

Coverage says which lines ran, not whether a test checked them. Mutation testing checks that:

> [D10] "Today, StrykerJS supports most JavaScript projects, including TypeScript, React, Angular, VueJS, Svelte, and NodeJS."

> [D34] "there's no official StrykerJS test runner plugin for it."

> [D36] "The command runner runs a configurable bash/cmd command and bases the result on the exit code of that program (0 for success, otherwise failed)."

StrykerJS has no official runner for `bun test`. Its command runner worked, because it only reads the exit code of `bun test`. The probe ran it on two files that had 100 % line coverage:

> [probe:dev-standards/out/stryker-output.txt] "Instrumented 2 source file(s) with 39 mutant(s)"

> [probe:dev-standards/out/stryker-output.txt] "All files | 87.18 | 87.18 | 34 | 0 | 5 | 0 | 0 |"

Five mutants survived. For example, no test checked the Wilson bound with 0 results, and no test checked that the fake records its calls. So 100 % line coverage did not mean that the code was checked. The run took 3 s on these two small files. The command runner runs the whole test run for each mutant, so a large project takes much longer. That time was not measured.

**Pick:** a coverage bar of 90 % of lines in every test run. Mutation testing with the command runner on the packages with number rules: `policy`, `falsify`, `registry` and `workflow`. It runs once a day and before a release, with a bar of 80 %. Both bars are guesses that have not been measured.

## 7. Code standards: types, lint and format

> [D11] "The strict flag enables a wide range of type checking behavior that results in stronger guarantees of program correctness."

The probe ran TypeScript 7.0.2 with `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. It found one error in code that Bun had run without complaint:

> [probe:dev-standards/out/tsc-output.txt] "error TS1375"

Bun runs TypeScript without checking the types, so a separate type check is needed.

> [D12] "Biome’s linter statically analyzes your code to find and fix common errors and to help you write better, modern code."

> [D12] "Such information is needed for some rules as noFloatingPromises , noUnresolvedImports or noImportCycles , which can’t function otherwise."

> [D13] "go from zero to linting with our recommended rules on your TypeScript code as quickly as possible."

Biome is one program that formats and lints. The probe found 19 errors and 22 warnings in the probe's own code. With the project rules on, Biome found an import cycle. It found a promise with no `await` only after the rule was turned on by name:

> [probe:dev-standards/out/biome-project-rules.txt] "lint/suspicious/noImportCycles"

> [probe:dev-standards/out/biome-project-rules.txt] "lint/nursery/noFloatingPromises"

Biome counts a warning as a pass, unless it gets a flag:

> [probe:dev-standards/out/biome-rules.txt] "Found 20 warnings. exit code: 0"

> [probe:dev-standards/out/biome-rules.txt] "$ biome ci --error-on-warnings test/no-network.ts Checked 1 file in 4ms. No fixes applied. Found 20 warnings. exit code: 1"

A missing `await` is a real risk in `titan`, because a step result that is not awaited can be lost from the board. ESLint with typescript-eslint has more type-aware rules, but it was not tested here.

**Pick:** TypeScript `strict` with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, checked by `tsc --noEmit` in every test run. Biome for format and lint, with the recommended rules, the project rules, and `noFloatingPromises` as an error. It runs as `biome ci --error-on-warnings`, so that a warning fails the check. The import cycle rule adds to the test of the dependency rule in design decision 23.

## 8. How the work flows: trunk, small changes, review, commits

> [D14] "A source-control branching model, where developers collaborate on code in a single branch called ’trunk’* and resist any pressure to create other long-lived development branches by employing documented techniques."

> [D21] "Have three or fewer active branches in the application’s code repository. Merge branches to trunk at least once a day."

> [D22] "teams perform better when developers merge their work into trunk at least daily."

> [D22] "If these automated tests fail, the team stops what they are doing to fix the problem"

The user already pushes to `main` for review. This is trunk-based development.

> [D30] "Small, simple CLs are: Reviewed more quickly."

> [D16] "In general, reviewers should favor approving a CL once it is in a state where it definitely improves the overall code health of the system being worked on, even if the CL isn’t perfect."

A _CL_ is Google's word for one change sent for review.

> [D15] "The Conventional Commits specification is a lightweight convention on top of commit messages."

> [D15] "This convention dovetails with SemVer , by describing the features, fixes, and breaking changes made in commit messages."

> [D26] "MAJOR version when you make incompatible API changes"

The probe checked the subjects of the commits in this repo against Conventional Commits:

> [probe:dev-standards/out/commit-check-output.txt] "0 ok, 9 fail"

The old commits stay as they are, because they are already pushed. The rule starts with the next commit. Plug-ins depend on the backend port's version, so a change that breaks the port needs a new major version and a `!` in the commit subject.

> [D17] "We will keep a collection of records for "architecturally significant" decisions: those that affect the structure, non-functional characteristics, dependencies, interfaces, or construction techniques."

The numbered decisions in `design.md` already work as these records. Each one has the choice, the reason and what else was considered.

> [D25] "A litmus test for whether an app has all config correctly factored out of the code is whether the codebase could be made open source at any moment, without compromising any credentials."

> [D32] "Gitleaks is a tool for detecting secrets like passwords, API keys, and tokens in git repos"

> [D32] "Gitleaks is feature complete. I'm not merging new features into Gitleaks. Future releases will be security patches only."

Gitleaks gets only security fixes now. It was not tested here.

**Pick:**

- Work on `main`, in small commits. Each commit passes the whole default test run before it is pushed.
- Commit subjects follow Conventional Commits. A check rejects a subject that does not.
- Versions follow SemVer.
- Each decision goes into `design.md` with the reason and what else was considered.
- Keys come only from the environment. A test of the record and the board fails when a file holds a key's value.

## 9. All picks in one table

| Topic                | Pick                                                           | Evidence                                                  |
| -------------------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| Kinds of tests       | unit, integration and end-to-end with fakes; live only by flag | D1, D2, D19                                               |
| No real API in tests | guard file: network, programs, keys                            | probe: v1 and child process disproved, final 11 pass      |
| Outside services     | fakes with their own tests, contract test for each port        | D3, D5, D20, probe contract test                          |
| Recordings           | not picked                                                     | key in recordings, stale answers, SDKs use child programs |
| Test cases           | one test for each scenario, with a check                       | probe: 186 scenarios found                                |
| Number rules         | examples and property tests with a fixed seed                  | D9, probe Wilson test                                     |
| Live agent tests     | clean `TITAN_HOME`, 3 tries, report how many passed            | D29                                                       |
| Strength             | 90 % line coverage in every run; mutation testing once a day   | D7, D34, D36, probe: 5 survivors at 100 % coverage        |
| Types                | `tsc --noEmit`, strict                                         | D11, probe TS1375                                         |
| Format and lint      | Biome, with `noFloatingPromises` turned on by name             | D12, probe                                                |
| Flow                 | trunk, small commits, review, Conventional Commits, SemVer     | D14, D15, D16, D21, D22, D26, D30                         |
| Decisions            | numbered decisions in `design.md`                              | D17                                                       |
| Secrets              | keys only from the environment, a test for leaks               | D25                                                       |

## 10. Not tested

- A network block by the operating system with `unshare -rn`. It failed with `Operation not permitted` in this environment.
- ESLint with typescript-eslint.
- The community Bun runners for StrykerJS, and mutation testing on a large test run.
- Polly.JS and MSW, and whether they see the calls of the agent SDKs.
- Gitleaks.
- Whether 3 tries are enough for a live agent test.
- The bars of 90 % coverage and 80 % mutation score on real `titan` code.
