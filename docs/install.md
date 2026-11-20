# Install Titan

Titan is a tool that your coding agent (Claude Code or Codex) uses. You do not write workflow files yourself. The agent writes them. This page shows how to install Titan on a new computer.

## What the package is

Titan Nano is distributed as `titan-cli-0.1.0-alpha.1.tgz`, built from this repository. The archive installs `@titan/cli` with the `titan` command, agent guide, input schemas, example workflows, license notices and pinned Codex and Claude runtime dependencies. Registry publication remains pending. Linux archives also include the pinned Apache-2.0 Sandlock script sandbox, its component inventory, license notices and patched source. Archives target their build operating system and CPU architecture.

## What you need first

Required:

- Bun 1.3.10 or newer. Get it from https://bun.sh.
- Git.

Optional:

- The `claude` command (Claude Code) or the `codex` command (Codex). You can install Titan before them.
- Python 3, Lean 4, Z3 and Podman. Titan uses them only for some checks and for the test suite.

Scoped Claude shell commands on Linux also use bubblewrap and `socat`. Install both with your system package manager and enable supported user namespaces. `titan doctor` reports missing commands. A missing sandbox refuses the command. Managed file tools remain available.

`titan install` checks the required tools first. If Bun is too old or Git is missing, it stops with exit code 2, names the tool, and writes no file. If only optional tools are missing, it finishes and lists them.

## The short way

On a computer that has no Bun yet, start with the script. It needs only `sh`. Run `sh install.sh --harness both` in this repository to install Titan and connect Codex and Claude Code in the current project. Choose `--harness codex` or `--harness claude` for one agent. Add `--project /path/to/project` to select another existing project. The project selector resolves from the directory where you start the script. Omit `--harness` to install the command alone. It checks Bun and Git, then builds the package and installs it into `~/titan`. To pick another folder, add its path: `sh install.sh /path/to/folder`. If Bun is missing, the script stops with exit code 2 and tells you where to get it. If you add `--install-bun`, it runs the official Bun installer from https://bun.sh first, and says so.

The script creates a managed launcher, runs the installed doctor and links `~/.local/bin/titan` to the launcher. Run `titan guide` when that directory is on your `PATH`. If needed, add `export PATH="$HOME/.bun/bin:$HOME/.local/bin:$PATH"` to your shell profile once. The launcher keeps your current project directory. Reinstalling keeps the stable command linked to the managed launcher. An existing unrelated command file or link is preserved. The installer reports that path, and the absolute launcher remains available as `~/titan/titan` or under your chosen folder.

Running the script again builds a separate release under the installation folder's `releases` directory. It runs that release's installed doctor before atomically switching the `titan` launcher. Previous releases remain available, and a failed package installation or doctor check preserves the working launcher. The script preserves an existing package manifest and refuses to replace an unrelated file named `titan`. A fresh folder receives a private package manifest. Bootstrap installation and managed updates share the same exclusive maintenance lease. Process exit releases that lease, including after termination. An abandoned legacy `.install-lock` directory can remain while installation proceeds. Unknown options, multiple destination folders, linked release folders and ambiguous build archives fail with a diagnostic. Package installation disables package scripts. The [update instructions](#update-titan) describe managed updates, backups and recovery. Supported format migration remains open in the [distribution contract](../openspec/changes/resilient-agent-blackboard-bun/specs/distribution/spec.md).

Agent setup runs through the installed stable launcher after the release switch. A failed registration reports failure and retains the installed command for retry with `titan install --harness codex` or `titan install --harness claude`. Installation and agent setup require separate results because registration changes the selected agent configuration. Relative installation folders resolve from the directory where you start the script.

Each installer builds its package in a separate temporary directory and removes that directory after installation. Retained archives under the source repository's `dist` directory stay available. Concurrent installations into different destination folders use separate package outputs.

## Steps by hand

1. In this repository, install the build tools: `bun install --frozen-lockfile`
2. Build the package: `bun run pack:preview`. The file appears in `dist/`.
3. Go to your project folder and add the file: `bun add /path/to/dist/titan-cli-0.1.0-alpha.1.tgz`. The program is then `node_modules/.bin/titan`. Below, `titan` means that file.
4. Check the computer: `titan doctor`
5. Install the skill for your agent: `titan install --harness claude` or `titan install --harness codex`
6. Start with the guide: `titan guide`

For a separate build output, run `bun run pack:preview /path/to/output`. The archive and its unpacked `package` directory appear there.

Step 5 writes a skill file into your project. It announces the pinned local embedding model and its size, then downloads missing model files. Add `--no-model` to skip that download. It does not change agent permissions.

Claude installation writes `.claude/skills/titan/SKILL.md` and retains the plugin bundle under `.titan/plugin`. When the Claude command is available, installation registers MCP in Claude's local project scope using the selected project directory. Codex installation writes `.agents/skills/titan/SKILL.md` and registers MCP through the Codex command. Both registrations retain the selected Titan home, including an explicit `--home`. Missing agent commands appear in the install result. Failed registration or plugin import returns exit code 1 and retains the written guide for retry. Each registration command has a thirty-second deadline. A command that stalls returns failure. Start a new agent session in that project after installation and invoke `/titan` in Claude Code or `$titan` in Codex.

Agent registration records the absolute runtime and installed CLI paths. The registered MCP command starts even when the agent does not inherit your shell PATH. Managed installations register the stable `titan` launcher, so new MCP processes follow verified release switches. Direct archive installations register their installed bundle. After moving a direct archive installation, run setup again with `--force`. A conflicting Claude registration requires removing the old local `titan` entry with `claude mcp remove --scope local titan` before setup.

Running the same harness install again preserves identical generated files and retries registration. An identical enabled Claude registration is accepted after the native command reports that it already exists. Different commands, arguments or environment overrides retain the registration failure. Changed files require `--force`, so setup preserves your edits. Existing linked skill files are refused during ordinary setup. Forced replacement atomically replaces the generated file entry and preserves any linked target.

`titan doctor` reports whether the selected home has the model and prints the command to fetch it. Use `titan doctor --fetch-model` to fetch missing files. Plain doctor never downloads. The pinned model uses 23,916,680 bytes. Normal meaning search uses only verified local files and works without networking after setup. Missing files leave word search available; explicit meaning search reports that setup is required.

## If something is missing

`titan doctor` and `titan install` print a list. Each line has the tool name, whether it is ready, and one sentence on how to fix it. Fix the line and run the command again.

Normal installation prints the saved guide, MCP registration result, local model status and next steps. Doctor prints the selected home, project, agent, runtime tools and local prerequisites. It also reports whether live backend checks ran. Add `--json` to either command for its complete machine-readable report. A missing native command or failed registration stays visible in either format.

## Update Titan

Set `update.source` in the selected Titan home's `config.yaml` to the Git repository that carries your release tags. Only the home owner can change this setting. For example, a home file can contain the following settings.

```yaml
update:
  source: https://github.com/thecharge/titan-nano.git
  check: daily
  mode: notify
```

Run `titan update --check --home HOME --json` to compare that source's version tags with your installed release. This command changes no files and starts no daemon. Its output names an available newer version when one exists. It reports `checked: false` when no source is configured or checks are disabled.

Ordinary commands check a configured source at most once a day and send a one-line notice to the error stream when a newer release is known. JSON results retain their normal shape. Concurrent commands share the check cache. Failed checks also wait until the next daily interval. The Git query has an 1800-millisecond deadline and a one-megabyte output limit. Set `update.check` to `never` to disable these calls. A source is optional, so an unconfigured installation makes no release query.

Run `titan update --home HOME` through the managed launcher to install the newest tagged release from that source. Titan pins the selected Git tag object, builds its package and checks the staged release. Use `titan update --from /path/to/titan-cli-VERSION.tgz --home HOME` for a local release archive.

Updates hold exclusive installation and home ownership. An idle daemon drains and stops before backup. Active work defers installation. An explicit `--force` pauses active work through the owner shutdown path. Earlier releases remain in the installation's `releases` folder.

Before selecting the new release, Titan copies the whole home and affected project metadata into `HOME/backups/VERSION-TIME-ID`. Earlier backups, credentials, journals, private proposals, file modes and symbolic links are retained. Streamed content hashes and source identities detect changes during copying. The staged doctor validates supported journal formats, retained paths and a consistent creating runtime within each journal. Catalogs can retain runs created by different releases. A failed package, incompatible journal or failed doctor retains the earlier launcher and live data.

Set the home-owned `update.mode` to `auto` for idle installation during ordinary commands. After a successful update, the stable launcher receives the original command and its streams. `notify` is the default behavior and prints the availability notice. `off` disables release queries and automatic installation. `update.check: never` also disables release queries.

Automatic updates use the same `titan update` installer. While a run is active, Titan defers the update before building the release. The next ordinary command can install it once the run has ended. The source must have a version tag newer than the installed release.

An interrupted transaction blocks daemon startup. Run `titan update --home HOME` to verify its retained backup and restore the earlier launcher. Recovery reports its result before another installation. The next invocation can install the selected release. A changed launcher, damaged backup or transaction belonging to another installation retains the recovery barrier for owner review.

Use `titan doctor --backup /path/to/backup --home HOME` to inspect a retained copy. Known journal formats retain their existing representation. Unsupported formats refuse selection of the new release.

Commands for older pinned runs automatically locate a retained managed release, check its manifest and executable version, and hand the command to that runtime. The stable launcher continues selecting the new release. An incompatible idle daemon drains before handoff. Active work defers switching. A retained invocation suppresses automatic updates to prevent a handoff loop. Missing or invalid earlier releases preserve the runtime compatibility diagnostic. New installed runs retain the exact creating bundle hash. Recovery selects a retained release matching both version and hash, including when different builds share a version. Older version-only runs refuse ambiguous different bundles. Byte-identical retained copies remain compatible. Recovery of an interrupted active run appends its normal restart event once. Supported data-format migrations remain open in the [distribution contract](../openspec/changes/resilient-agent-blackboard-bun/specs/distribution/spec.md).

CLI run and request clients and MCP run and request tools use this same compatible-runtime recovery. Each operation retries once after a successful idle-owner handoff. Repeated compatibility errors remain visible. A persistent MCP connection can inspect an older run and then use current-release tools, with idle daemon discovery selecting the required owner for each operation. Person-authorized request operations retain their authority through recovery.

## Uninstall and reinstall Titan

Run `titan uninstall` through the command installed by `install.sh`. You can also run `~/titan/titan uninstall`, or use the launcher in your chosen installation folder.

Use `--home /path/to/home` to select a Titan home. If the home and installation are separate folders, uninstall checks the home without writing to it or stopping its daemon. It refuses if it finds a running daemon, a held write lock, or an unfinished update.

Finish or pause any runs before stopping that home's daemon. If you started it with `titan serve`, stop it from the same terminal with Ctrl+C. Let maintenance finish before retrying. If an update was interrupted, recover it through the launcher that started it.

If the home is the installation folder itself, uninstall can stop its idle daemon before removing the launcher.

Uninstall removes the verified launcher and the matching PATH link that the installer recorded when it created the link. A pre-existing link without a record stays in place. If a recorded link has been replaced, Titan refuses and leaves both paths in place.

Runs, their runtime pins, knowledge, settings, backups, custom files and agent registrations stay on disk. Titan keeps old releases so runs pinned to those releases can use them after reinstall.

Run `sh install.sh /path/to/installation` again to restore the launcher. From any directory, run `titan status RUN_ID --home /path/to/home` to inspect a retained run in that home. Titan recovers interrupted runs using the retained release when the run requires it.

For a copy added with `bun add`, run `bun remove @titan/cli` from the folder where you added it.

## Verification and current limits

Complete local source and installed-package acceptance use pinned SDKs with vendor stubs. A retained [real Codex self-development run](../docs/examples/self-development/README.md) exercised workers, independent reviewers and scripts. It required manual recovery and a reviewer-schema repair. The later [delivery evidence](../openspec/changes/archive/2026-11-16-repair-harness-delivery/evidence.md#2026-11-15-self-development-delivery-and-readiness-audit) records the committed implementation and complete verification. Complete live Claude acceptance and native permission and recovery contracts remain open.

The installed command checks the daemon version and exact runtime bundle hash. An idle daemon from another build is replaced through the existing graceful handoff. A busy daemon keeps its work and reports the handoff refusal. Source development commands retain version-only discovery.

For a first offline run, copy the shipped `examples` and `tests` directories to a project. Run these commands from that project with the installed launcher.

```sh
titan doctor --home HOME
titan check examples/everyday-problem.yaml --harness fake --home HOME
titan run examples/everyday-problem.yaml --harness fake --fake-script tests/everyday-problem.answers.yaml --home HOME
```

If a run stops for an answer or its daemon is interrupted, keep the original run ID and home. Check the status and requests, answer any pending request through the normal approval path, then resume.

```sh
titan status RUN_ID --compact --home HOME
titan requests --run-id RUN_ID --home HOME
titan resume RUN_ID --watch --home HOME
```

Titan reports missing Python, Lean and local embedding files in doctor. The offline example works with those capabilities absent. See the [distribution checks](distribution.md) for the tested Linux and Bun setup and the isolated registry check. See the [Claude adapter guide](../packages/backend-claude/README.md#verification) for Claude setup and offline checks.

## Linux script sandbox

Approved scripts require Linux 6.12 or newer with Landlock, seccomp user notification and parent-to-child ptrace enabled. The installer prepares Sandlock 0.9.1 with Titan's Apache-2.0 file-claim policy patch while building the package. The first source build requires Cargo or access to download the private Rust toolchain, a C compiler for linking, GNU tar and patch. When Cargo is missing, preparation installs checksum-pinned Rustup 1.29.3 and Rust 1.96.0 in Titan's private dependency cache. It leaves shell profiles unchanged. Later source builds reuse that cache. Direct archive installations contain the ready executable and need no Rust toolchain or C compiler. Preparation failures preserve the existing managed release.

Run `bun run test:prepare` before source tests or script workflows. The same preparation runs during `bun run pack:preview`. Read the [script boundary and source rebuild instructions](preview.md#approved-script-filesystem-boundaries) for policy behavior, third-party licensing and platform verification limits.
