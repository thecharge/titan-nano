## ADDED Requirements

### Requirement: The guide tells the main agent how to design and run a workflow

`titan guide` SHALL print a guide for the main agent. The guide MUST list these steps in this order:

1. talk with the person until the goal is clear;
2. read lessons with `titan lessons`;
3. read the best earlier plans for this kind of goal with `titan plans <kind>`, as in spec self-training-orchestration;
4. search the knowledge hub with `titan kb search`, and reuse, mutate or create personas;
5. write the workflow file as the starting plan, which agents can add steps to during the run;
6. run `titan check` until it prints `ok`, resolving any preflight requests through the approval commands;
7. start the run with `titan run`;
8. list requests with `titan requests`, answer those at level `main` with `titan answer`, pass the others to the person, then run `titan resume`;
9. read `result.md` and tell the person the result and its evidence.

#### Scenario: Guide lists the steps

- **WHEN** `titan guide` runs
- **THEN** the output names the commands `titan lessons`, `titan plans`, `titan kb search`, `titan check`, `titan run`, `titan requests`, `titan answer`, `titan resume` in that order
- **AND** the output says that the person does not write personas or the workflow file

### Requirement: The guide holds the file format and the examples

`titan guide` SHALL include the JSON schema of the workflow file, the same as `titan schema` prints, and the four example files.

#### Scenario: Schema in the guide matches titan schema

- **WHEN** `titan guide` and `titan schema` run
- **THEN** the schema in the guide is the same text as the output of `titan schema`
- **AND** the guide holds the four files from `examples/`

### Requirement: titan plugs into each agent tool as a skill and a tool server

`titan install --harness claude|codex|antigravity` SHALL install the guide as the skill `titan`, and the tool server `titan mcp`, as in spec titan-server. It MUST write one plug-in folder in the Claude Code form: `.claude-plugin/plugin.json`, `skills/titan/SKILL.md` and `.mcp.json`. Then:

- for `claude`, it installs that plug-in in Claude Code;
- for `antigravity`, it runs `agy plugin import` on that folder;
- for `codex`, it writes the same skill to `.agents/skills/titan/SKILL.md` and adds the tool server with `codex mcp add titan -- titan mcp`.

It MUST NOT overwrite a file that `titan` did not write, unless `--force` is given.

#### Scenario: Install into a project

- **WHEN** `titan install --harness claude` runs in a folder with no `titan` plug-in
- **THEN** the plug-in folder holds `skills/titan/SKILL.md`, with a header that has `name: titan` and a description
- **AND** the body of that file is the output of `titan guide`
- **AND** `.mcp.json` in the plug-in folder starts `titan mcp`

#### Scenario: Install for Codex

- **WHEN** `titan install --harness codex` runs with `CODEX_HOME` set to an empty test folder
- **THEN** `.agents/skills/titan/SKILL.md` exists with the same body as the Claude Code skill
- **AND** `codex mcp list` in that test folder lists `titan`

#### Scenario: Someone else's file is there

- **WHEN** `.agents/skills/titan/SKILL.md` or the plug-in's `SKILL.md` exists and was not written by `titan`
- **AND** `titan install` runs without `--force`
- **THEN** `titan` exits with code 2 and leaves the file as it was

### Requirement: The person can start titan by name

The skill SHALL be named `titan`, so that the person can start it with `/titan` in Claude Code and Antigravity, and with `$titan` in Codex. The skill MUST tell the main agent to use the tools of `titan mcp` when they are there, and the `titan` commands otherwise.

#### Scenario: Skill header

- **WHEN** `titan install --harness claude` has run
- **THEN** the header of `SKILL.md` has `name: titan`
- **AND** its body names the tools `titan_run` and `titan_requests`

### Requirement: The main agent can design and run a workflow from a problem alone

In the live main-agent test, the main agent SHALL get only a problem in plain words. It MUST write a workflow file, pass `titan check`, run it, and report the result, with no file written by a person.

#### Scenario: Live main agent in Claude Code

- **WHEN** the live test runs with `TITAN_LIVE_CLAUDE=1` and gives the main agent the problem "Plan a move to Sofia for under 3000 EUR"
- **THEN** a run record exists whose `workflow.yaml` was written by the main agent
- **AND** the main agent's last message names the result and points to `result.md`

### Requirement: The guide says when not to split work

The guide SHALL tell the main agent when to run steps in a sequence, with one agent at a time. This is when each step needs the result of the one before it, or when the steps change the same file. It MUST tell the main agent to use parallel groups and `split` only for independent parts. Candidates MAY edit the same paths because each has a separate snapshot. Parallel kept steps MUST follow the file-conflict rule in spec workflow-run. It MUST tell the main agent not to add agents to a kind of goal that one agent already passes in most runs, and to check this with `titan plans <kind>`. These rules come from the papers in `research/swarm.md`, where more agents made sequential tasks worse.

#### Scenario: Guide warns about sequential work

- **WHEN** `titan guide` runs
- **THEN** the output contains the text `steps that need the one before them, or that change the same file, run in a sequence with one agent`

### Requirement: The guide asks for proof checks where a claim can be proven

`titan guide` SHALL tell the main agent to add a `verify` entry when a program can check a goal, a step or an outcome. Such a program checks a theorem in Lean, a claim over numbers in SMT, or runs a fixed script such as a test run. The guide MUST say that the main agent writes the locked statement with every definition and that its effective approval level applies. The default is the person. A script marked `proven` means only that the approved command passed. It MUST NOT be described as a formal proof of the goal. It MUST say `not proven is a normal answer` for completed semantic checks. It MUST distinguish a completed `not proven` observation from an interrupted checker. The former does not establish truth; the latter requires recovery without a quality verdict.

#### Scenario: Guide text on proof checks

- **WHEN** `titan guide` runs
- **THEN** the output contains the text `when a claim can be checked by a program, add a verify entry` and the text `not proven is a normal answer`

### Requirement: The guide teaches concurrent workflow ownership

The guide SHALL show two harnesses sharing one home and one harness starting two workflows before either finishes. It MUST show explicit run handles, origin-filtered requests, independent watches and cancellation. It MUST explain per-run versus server limits, queued work and the read-only global dashboard. If the originating client disconnects, unrelated work MUST continue. Another authorized client MAY deliberately answer a main-level request by naming its run and request; the guide MUST explain that shared tokens do not isolate same-user clients.

#### Scenario: Guide demonstrates both concurrency paths

- **WHEN** the generated guide is checked
- **THEN** it includes different-harness and same-harness examples, each retaining distinct run ids and selecting requests explicitly

### Requirement: Installed preview skills are usable documents

The Codex and Claude Code preview skills SHALL have parseable YAML frontmatter and the same body as `titan guide`. The body MUST include a workflow that passes the current compiler and commands supported by the current CLI. Installation MUST preserve an existing skill. This preview check does not establish live harness discovery, automatic MCP registration or the complete guide requirements above.

#### Scenario: Installed preview skill contract

- **WHEN** the packaged CLI installs a project skill for Codex or Claude Code in an offline temporary project
- **THEN** the generated header parses with the name `titan` and a nonempty description
- **AND** the body equals the packaged canonical guide, its example workflow passes `titan check`, and each documented command has an implementation
- **AND** a repeated installation refuses replacement and preserves the existing bytes
