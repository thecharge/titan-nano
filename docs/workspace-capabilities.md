# Work in an existing repository

Run these commands from the project directory. In a Titan source checkout, replace `titan` with `bun run titan`. Keep the same `--home` value when inspecting or controlling a run.

## Find work and inspect a run

```sh
titan runs --scope project --project . --state running
titan runs --scope home --home ./titan-home
titan runs --scope known-home
titan status RUN_ID --compact --home ./titan-home
titan status RUN_ID --compact --json --home ./titan-home
titan requests --run-id RUN_ID --state waiting --home ./titan-home
```

Compact status includes step states, attempts, errors, available usage and waiting request identities. Full status remains available by omitting `--compact`. Known-home listing reports an unavailable home alongside reachable homes. Homes become known when the CLI connects to them. Use the returned home cursor to page through a larger registry.

## Reuse repository and user skills

```sh
titan skill list --project .
titan skill show coding-practices --project .
titan workflow create workflow.yaml --skill coding-practices
```

Discovery checks `.agents/skills`, `.codex/skills` and `.claude/skills` in that order, followed by the corresponding user locations. `CODEX_HOME` and `CLAUDE_CONFIG_DIR` select their user roots when configured. Project skills take precedence. The listing records the selected origin and alternative origins.

Select required skills on a persona using its `skills` array. Titan retains the selected `SKILL.md` and supported files under `references/` when admitting the run. Codex and Claude receive the retained instructions. They can read retained references through `titan_file_read` using paths such as `@titan-skills/coding-practices/references/review.md`. Changing the source skill after admission leaves that run's retained instructions available for recovery. Links must remain inside the admitted skill directory. Entry and byte limits bound discovery and retention.

Run `titan check workflow.yaml --project . --json` before starting work. The `skills` field lists the skills selected by each persona, their origins and hashes for the instruction and reference files. The output omits their contents. A missing declared skill fails the check. Dry runs use the same preflight, and admission checks the files again for the new run. Add each referenced skill to the persona that needs it. An available skill listed by discovery is separate from the skills selected on that persona.

## Create a workflow and save a persona

```sh
titan persona create reviewer.yaml --tool Read
titan kb add reviewer.yaml --scope project --project .
titan persona list --scope project --project .
titan workflow create workflow.yaml --template parallel --reviewer project:reviewer@1 --verify 'git diff --check' --project .
titan check workflow.yaml --project .
```

Edit the generated goal, tasks and persona instructions for the actual work. The parallel template creates two independent preparation steps. `--verify` adds a following script step with an independent reviewer. Creation refuses an existing destination. Registered persona references retain the selected scope and exact version through admission, history, usage and approved deletion. Home-scoped references use names such as `reviewer@1`.

## Read a public source

```sh
titan web-read RUN_ID https://example.com/ --home HOME --json
```

If the command returns an approval request, review it with `titan requests show RUN_ID REQUEST_ID --home HOME`. After approval, repeat `web-read` with `REQUEST_ID` as the third positional argument. A home owner can set `approvals.resource: auto` to permit public HTTPS reads for new runs. Workers using the native tool can request the same capability and continue with the recorded answer.

Titan checks each redirect and reports the final URL, media type, retrieval time and content digest, or the observed failure. It caps the response size and duration. Binary responses can have a digest without usable text. The receipt records where the content came from. A factual claim still needs its own verification.

## Run approved scripts

Script actions and falsifiers accept optional `timeout_s` values up to one hour. Their default deadline is five minutes. Checks use that default. Script proofs retain their explicit proof deadline. Cancellation and byte limits remain active throughout execution.

In shared live mode, approved checks and proofs can change their declared output scope. Titan retains each changed candidate separately, with its parent hash, command receipt and execution identity. The original worker snapshot remains available for inspection. Restart checks the candidate chain before reusing a completed command. A pending capture or changed retained evidence blocks acceptance. Independent falsifiers inspect the resulting candidate.

Generated cache directories are omitted from ordinary snapshots unless a step explicitly includes them in its file scope. An explicit scope still passes the normal protected-path and script-write checks.

## Delivery evidence

The [archived change evidence](../openspec/changes/archive/2026-11-20-improve-workspace-agent-experience/evidence.md) records the source and package checks, including bounded public web acquisition. Native skill coverage uses offline vendor fixtures. The recorded live implementation run reached its time limit before completing the whole change.
