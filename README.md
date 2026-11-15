# Titan Nano

Titan Nano coordinates coding agents, independent reviews and scripts in your project. Workers share the live file tree, use retained knowledge and leave execution records you can inspect.

Give Codex or Claude Code a task in plain English. Your agent plans the workflow, starts Titan and handles the results. Independent reviewers look for concrete defects before a step is accepted. Workflows combine sequential work, parallel tasks and script checks.

## Install

Clone the repository and run the installer. Git is required. The optional flag installs Bun when it is missing.

```sh
git clone https://github.com/thecharge/titan-nano.git
cd titan-nano
sh install.sh --install-bun --harness both
export PATH="$HOME/.bun/bin:$HOME/.local/bin:$PATH"
```

The installer creates a managed release under `~/titan`, links `~/.local/bin/titan`, checks prerequisites and connects both agents in the current project. Choose `--harness codex` or `--harness claude` for one agent. Add `--project /path/to/project` to connect another project. Existing unrelated commands are preserved. The PATH line makes Bun and Titan available in the current shell. Keep it in your shell profile for future terminals. Read the [installation guide](docs/install.md) for another installation folder, package installation and release checks.

## Connect your agent

To connect another project, run the command for your agent from that project.

| Agent       | Command                          |
| ----------- | -------------------------------- |
| Codex       | `titan install --harness codex`  |
| Claude Code | `titan install --harness claude` |

This installs the agent guide and sets up the local knowledge model. Repeating the command preserves identical generated files and retries registration. Start a new agent session in that project. Invoke `/titan` in Claude Code or `$titan` in Codex and give your agent the task in plain English. The agent writes and checks the workflow. Use `titan guide` to read the same operating instructions.

Workers, scripts and independent checkers use your shared project directory. Open the dashboard with the following command, then open the returned browser login link.

```sh
titan dashboard
```

Use [the dashboard guide](docs/dashboard.md) for run inspection, retained files, frozen settings, knowledge and connection recovery.

## Inspect a real run

The repository retains a real Codex SDK run in which Titan changed its own version checks and wrote an inspection guide. The workflow includes a parallel group, independent reviewers and a script step. The sanitized export includes the journal, pseudonymous session identifiers, results and recovery history. Personal paths and usage totals were removed. Manual recovery and a reviewer-schema repair were required. Read the [self-development record](docs/examples/self-development/README.md) and the later [delivery evidence](openspec/changes/repair-harness-delivery/evidence.md#2026-11-15-self-development-delivery-and-readiness-audit).

## Current support

Codex and Claude Code adapters, local knowledge, structured questions, run inspection and managed updates are implemented. Complete source and installed-package checks run locally. The retained live self-development evidence covers Codex. Complete live Claude acceptance remains open.

Custom skill selection and arbitrary MCP inheritance, full native write enforcement, supported data migrations and several recovery contracts remain incomplete. Declared file scopes coordinate cooperating workers. They do not establish a complete operating-system boundary. These requirements remain visible in OpenSpec.

Read the [usage guide](docs/preview.md) for commands and current limits. The active product change is [resilient-agent-blackboard-bun](openspec/changes/resilient-agent-blackboard-bun/proposal.md). The [delivery record](openspec/changes/repair-harness-delivery/evidence.md) retains observed verification and remaining requirements.

## Contribute through issues

Use [GitHub Issues](https://github.com/thecharge/titan-nano/issues) for bugs, feature proposals, questions and reproducible examples. Maintainers review proposals and implement accepted changes. Read the [contribution policy](CONTRIBUTING.md) and [security reporting guidance](SECURITY.md).

## Project history

Titan began in September 2025. Companion followed in March 2026. Titan Nano is the third generation of that work.

## License

Titan Nano is licensed under [Apache-2.0](LICENSE). Copyright and attribution are in [NOTICE](NOTICE). Runtime dependency terms are retained in [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES).

## Develop Titan

Read [the development guide](docs/development.md) before changing code.

```sh
bun install --frozen-lockfile
bun run hooks:install
bun run titan --help
bun run titan check examples/mixed-graph.yaml
bun run test:prepare # first pull the pinned base as described in the preview guide
bun run test
```

Stage the intended increment before running `bun run check`, which verifies the staged snapshot used by the commit hook.
