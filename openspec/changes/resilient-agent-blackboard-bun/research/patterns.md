# Patterns for the backends, tools, data and monorepo

Reader: a developer who is new to `titan`. Purpose: see, for each part of the design, which ways were tried, how each was tested, and why one was picked.

All tests ran on 2026-11-05 on Linux x86-64 with Bun 1.3.10. Each test is one run, not a benchmark. Every quote below is copied from the fetched page. The page text is in `patterns-sources/<id>.txt`, and the links are in `patterns-sources/urls.tsv`. To check the quotes, run this from the `research/` folder:

```bash
python3 -I check-quotes.py patterns.md patterns-sources probes
```

## 1. The common interface for every backend

**What the user asked:** a common interface for each agent, with facades and adapters. It must be possible to add a vendor, tools and other parts without changing the rest.

**Words used here**

- A _port_ is an interface that the core of `titan` owns. The core only talks to the port.
- An _adapter_ turns calls on the port into calls to one vendor's SDK or API.
- A _facade_ is one small entry point that hides many parts behind a few functions.
- A _capability_ is a yes-or-no flag on a backend that says what it can do, such as "can resume a session".

**Sources**

> [P1] "Allow an application to equally be driven by users, programs, automated test or batch scripts"

> [P1] "For each external device there is an adapter that converts the API definition to the signals needed by that device and vice versa."

> [P1] "an adapter to a "mock" database, one that sits in memory and doesn't depend on the presence of the real database at all."

> [P2] "You can introduce new types of adapters into the program without breaking the existing client code"

> [P2] "The overall complexity of the code increases"

> [P3] "A facade can become a god object coupled to all classes of an app."

> [P4] "specificationVersion: 'v4'; provider: string; modelId: string;"

> [P4] "publish your custom provider in your own GitHub repository and as an NPM package"

The first three quotes are from Alistair Cockburn's page on hexagonal architecture (ports and adapters). The next three are from the Adapter and Facade pages on refactoring.guru. The last two are from the Vercel AI SDK page on custom providers. That SDK gives every provider one interface with a version field, and lets other people ship providers as npm packages.

**Ways that were compared**

| Way                                                                                                                               | Test                                                                                                              | Result                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. One port, `AgentBackend`, with a version field and capability flags. One adapter package per vendor. A fake adapter for tests. | Wrote the port and the Claude, Codex and model API adapters against the real SDK types. Ran `tsc` in strict mode. | Passed: `tsc exit 0`. Kept.                                                                                                                                            |
| B. One big facade class that has a branch for each vendor.                                                                        | Read the Facade page.                                                                                             | Rejected. Every new vendor changes the same class, and the page warns that a facade "can become a god object".                                                         |
| C. Use the AI SDK's model interface for every backend, also the agent SDKs.                                                       | Compared the AI SDK interface with what the agent SDKs need.                                                      | Rejected. The interface is one model call (`doGenerate`, `doStream`). It has no session to resume, no skills and no built-in tools, and the agent SDKs need all three. |
| D. Run each agent tool's command line (`claude -p`, `codex exec`, `agy --print`).                                                 | None.                                                                                                             | Not picked. The user asked for the SDKs. `agy --print` stays the fallback for Antigravity in the design's open questions.                                              |

> [probe:backend-port/tsc-output.txt] "tsc exit 0"

**What way A looks like:** see `probes/backend-port/port.ts`. A backend has an `id`, its `capabilities`, and two functions: `start(spec)` starts an agent session and `resume(sessionId, spec)` continues one. A session has one function, `send(prompt)`, which returns the structured output and the session id. The facade on top is small: `@titan/runner` exports only `runWorkflow()`, `resumeRun()` and `answerRequest()`.

**What the capability flags showed:** the adapters cannot all do the same things.

| Capability                    | Claude Agent SDK | Codex SDK                  | Antigravity SDK (from the docs only) | Model APIs (AI SDK)                          |
| ----------------------------- | ---------------- | -------------------------- | ------------------------------------ | -------------------------------------------- |
| system prompt                 | yes              | no option in the SDK types | yes, `system_instructions`           | yes                                          |
| built-in file and shell tools | yes              | yes                        | yes, read only by default            | no                                           |
| skills                        | yes              | no option in the SDK types | not found in the docs                | no                                           |
| tool servers                  | yes              | yes, through `config`      | yes, `McpStdioServer`                | yes                                          |
| resume a session              | yes              | yes                        | not stated; a task checks it         | no: `titan` keeps the message history itself |
| structured output             | yes              | yes                        | not checked                          | yes                                          |

The Claude, Codex and model API columns come from the SDK types on this machine. The Antigravity column comes from the fetched pages only, because the Python package is not installed:

> [P8] "The system_instructions parameter is optional."

> [P8] "By default, Agent runs in read-only mode for safety."

So the core cannot assume that every backend can do everything. `titan check` reads the flags and fails when a persona needs something that its backend cannot do.

The Codex SDK has no system prompt option, so the Codex adapter puts the role text at the start of the first prompt. The Codex binary contains the text `developer_instructions`. It may be a config key for the role text, but nobody has checked that. A task checks it.

> [probe:backend-port/versions.txt] "codex binary strings: base_instructions developer_instructions"

## 2. How tools and other parts plug into each vendor

**What the user asked:** tools and other parts that can be plugged into each agent tool.

**Words used here:** a _tool server_ is a program that offers tools over the Model Context Protocol (MCP). An agent tool starts it and calls its tools. _stdio_ means the two programs talk through standard input and output.

**Sources**

> [P5] "Custom tools extend the Agent SDK by letting you define your own functions that Claude can call during a conversation."

> [P5] "All built-ins are removed. Claude can only use your MCP tools."

> [P6] "Configure each MCP server with a [mcp_servers.<server-name>] table in the configuration file."

> [P6] "enabled_tools (optional): Tool allow list."

> [P13] "The SDK accepts a JSON object, flattens it into dotted paths, and serializes values as TOML literals before passing them as repeated `--config key=value` flags."

> [P7] "You can define MCP servers programmatically in your application’s LocalAgentConfig using McpStdioServer or McpStreamableHttpServer ."

> [P9] "The Stdio transport can be imported from either the MCP SDK or the AI SDK"

**Ways that were compared**

| Way                                                                                                                           | Test                                                                                                         | Result                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Every tool that `titan` adds is offered by a stdio tool server. Each adapter passes the persona's tool servers to its SDK. | Read the docs of all four. Wrote a tool server with `@modelcontextprotocol/sdk` and called it from a client. | Kept. All four accept a stdio tool server. The test server answered in 105 ms.                                                                                                                    |
| B. Write each tool in each vendor's own form: Claude `tool()`, Antigravity Python functions, AI SDK `tool()`.                 | Read the Codex SDK types.                                                                                    | Rejected. The Codex SDK has no option for functions in its types, and each tool would be written several times.                                                                                   |
| C. Agents ask for every tool through the `requests` list in their answer, as in the earlier design.                           | Compared with way A.                                                                                         | Kept only for requests that pause the run. A request in the answer arrives only at the end of a turn. A search of the knowledge hub must answer during the turn, so the agent can use the result. |

> [probe:backend-port/toolserver-output.txt] "result: [{"type":"text","text":"match for: time zones"}]"

**What this changes in the design**

- `titan` ships its own tool server, `titan tool-server`. It offers the knowledge hub tools `kb_search`, `kb_get`, `kb_add`, `kb_update` and `kb_delete`. Every agent gets it, on every backend.
- A persona's `tool_servers` field lists more tool servers, each with a command, arguments and environment variables. This is how the main agent plugs in a tool for any vendor.
- The earlier non-goal "No MCP server" changes. The tool server is not a product for other programs. It is the inside link between `titan` and its agents.
- The earlier non-goal "No tool loop of `titan`'s own for model APIs" changes. The AI SDK runs the tool loop (`stopWhen: stepCountIs(20)` in `probes/backend-port/api.ts`). So a persona on a model API can use tool servers. It still has no built-in file or shell tools.

## 3. How a new vendor, embedder or tool server is added

**Word used here:** a _plug-in_ is an npm package that adds backends, embedders or tool servers to `titan` without a change to `titan` itself. An _embedder_ makes embeddings for meaning search.

| Way                                                                                                                                                                                                    | Test                                                                                                        | Result                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A. A plug-in package exports one object with a `specificationVersion`, a name and lists of backends and embedders. `titan` loads the packages named in the workflow file or in `~/.titan/config.yaml`. | Probe in `probes/plugins/`: one good plug-in, one with an old version, one missing, and the good one twice. | First try failed: `titan` looked for the package from its own folder. Second try, looking from the user's project folder, passed. |
| B. All vendors are built into `titan`.                                                                                                                                                                 | None.                                                                                                       | Rejected: a new vendor needs a new `titan` release.                                                                               |

> [probe:plugins/plugin-first-try-output.txt] "titan-plugin-good: not installed (Cannot find package 'titan-plugin-good' from"

> [probe:plugins/plugin-output.txt] "titan-plugin-old: wants titan-plugin-v0, titan has titan-plugin-v1"

> [probe:plugins/plugin-output.txt] "titan-plugin-good: backend mistral-api already registered"

The probe showed three rules for the design:

- `titan` looks for a plug-in from the user's project folder, with `Bun.resolveSync(name, folder)`;
- `titan` refuses a plug-in with another `specificationVersion`, and says which version each side has;
- `titan` refuses a second backend with an id that is already used.

## 4. Data design

**Sources**

> [P11] "stores table data, versions, and indexes in open, columnar files."

**Ways that were compared**

| Question                                     | Way                                                                                                                               | Test                                                   | Result                                                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Where is the truth?                          | A. Plain files are the truth. SQLite holds only an index that can be rebuilt.                                                     | Earlier knowledge hub probes, `probes/knowledge-hub/`. | Kept. People can read and fix the files.                                                                 |
|                                              | B. SQLite is the truth.                                                                                                           | None.                                                  | Rejected: people cannot read it without a tool, and the user asked for a readable option.                |
|                                              | C. LanceDB.                                                                                                                       | Read the docs.                                         | Rejected: its "columnar files" are not readable, and SQLite already gives word search and vector search. |
| Can many processes add to the board at once? | One line per message, added to `board.jsonl`.                                                                                     | 8 processes, 2000 lines each.                          | Passed: 16000 lines, 0 broken.                                                                           |
| Can many processes change the same entry?    | SQLite with write-ahead logging, `busy_timeout` set after `journal_mode`.                                                         | 8 processes, 300 changes each.                         | Failed: 7 of 8 processes stopped with `SQLITE_BUSY`.                                                     |
|                                              | `busy_timeout=5000` set first. Each change checks the version it read (`where version=?`) and tries again when the version moved. | Same test.                                             | Passed: final version 2400 of 2400.                                                                      |

> [probe:data/append-output.txt] "8 processes x 2000 appends: board lines 16000 broken 0"

> [probe:data/sqlw-first-try-output.txt] "SQLITE_BUSY errors: 7"

> [probe:data/sqlw-output.txt] "final version 2400 expected 2400"

**What this means for the design**

- The board and the event log are files where each message is one added line.
- A change to a knowledge hub entry checks the entry's version in SQLite inside one write transaction, then replaces the file. When the version moved, `titan` reads the entry again and tries again. This is called an _optimistic version check_.
- Every SQLite connection sets `busy_timeout` before anything else.
- The test only checked lines of about 330 bytes. Longer lines were not tested.

## 5. Monorepo design

**Sources**

> [P10] "define those versions once in a catalog in the root package.json and reference them from your workspaces with the catalog: protocol."

> [P10] "use a semver range or the workspace protocol (for example workspace:* ) as the version in your package.json ."

> [P12] "bun install turbo --dev"

**Ways that were compared**

| Question                     | Way                                                                                                                                      | Test                                                                               | Result                                                                                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which workspace tool?        | A. Bun workspaces only, with `workspace:*` and a catalog for shared versions.                                                            | Probe in `probes/monorepo/`: `apps/cli` uses `@titan/core` and `@titan/knowledge`. | Kept: ran from source with exit 0.                                                                                                                                                |
|                              | B. Bun workspaces plus Turborepo.                                                                                                        | Read the install page.                                                             | Not picked. The page shows how to install it with Bun, and says nothing more about Bun. The layout in the design has 17 small packages and one app, and needs no build cache yet. |
| How is `titan` shipped?      | A. As a Bun package that runs from source.                                                                                               | Same probe.                                                                        | Kept: `sqlite-vec` and the embedder both load.                                                                                                                                    |
|                              | B. As one file made with `bun build --compile`.                                                                                          | Built the probe as one file.                                                       | Failed for `sqlite-vec` from its package. It works only with `vec0.so` next to the file. Failed for the embedder: the image library `sharp` does not load.                        |
| How are packages kept apart? | Each adapter depends only on `@titan/core` and its vendor's SDK. Nothing depends on an adapter except `apps/cli` and the plug-in loader. | Not tested yet.                                                                    | A task adds a test that reads every `package.json` and fails on a wrong dependency.                                                                                               |

> [probe:monorepo/run-output.txt] "core ok {"fts5":"ok","vec":"v0.1.9 (package)"}"

> [probe:monorepo/compile-sqlite-vec-package-output.txt] "error: Cannot find module 'sqlite-vec-linux-x64/vec0.so' from '/$bunfs/root/only-package'"

> [probe:monorepo/run-output.txt] "core ok {"fts5":"ok","vec":"v0.1.9 (next to binary)"}"

> [probe:monorepo/compile-embed-output.txt] "error: Could not load the "sharp" module using the linux-x64 runtime"

## What was not tested

- Codex and the Antigravity SDK were not started live. The Codex adapter only passed the type check.
- The Antigravity adapter was not written, because the Python package is not installed.
- Turborepo and Nx were not installed or run.
- The plug-in probe used workspace packages, not packages installed from npm.
- The data tests ran on one Linux machine only.
