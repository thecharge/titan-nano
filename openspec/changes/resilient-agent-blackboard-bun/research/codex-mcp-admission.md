# Codex native MCP admission

The projection increment committed as 4e8770a after its normal gate. The next review concerns inherited native tools. No adapter change has been made for this review.

The current default Codex client configures web search, sandbox and network access, but does not supply an explicit MCP server map. The official [MCP configuration guide](https://developers.openai.com/codex/mcp) says local clients share host MCP settings from user config and trusted project config. Its server enabled setting disables an individual registration. The [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference) separates MCP, apps and plugin configuration from filesystem sandbox policy. Those are primary configuration sources, not proof that Titan currently prevents inheritance.

The installed SDK is 0.167.0. Its CodexOptions.config contract accepts a structured configuration object. Its serializer explicitly emits an empty object as a root override such as mcp_servers={}; nonempty objects flatten to dotted fields. This source observation does not prove that the native config loader replaces an inherited map.

A prepared temporary probe uses the pinned native executable only for mcp list, in the standard offline Podman boundary. It mounts only the binary and probe, uses a synthetic home containing one inert registration and has no credentials or network. It first requires that registration to be visible, then requires an explicit empty override to remove it. No model turn or server command is requested. The probe ran after the hook container finished.

If that check passes, the next increment should configure the default production client explicitly, require its flags in strict SDK executable fixtures and falsify their omission. Injected custom clients retain their caller-owned configuration contract. Native persona registration, approved tool expansion and live vendor permission acceptance remain separate work.

## Observed counterexample

The offline native probe ran against the pinned 0.167.0 binary with the normal network, CPU, memory and process limits. Its synthetic home contained one inert home_fixture registration. Both ordinary mcp list --json and the same command with -c mcp_servers={} returned that enabled registration. The expected empty result failed. The CLI listed configuration only; no server command or model turn ran. No host credentials or home were mounted.

An empty SDK map therefore does not establish admission isolation. Do not add it with a claim that inheritance is disabled. A supported explicit native mechanism or a separate configuration boundary needs its own counterexample before adapter changes. Further read-only native help and configuration probes are prepared, but must wait for the projection push container to finish. The production tool-policy gap remains open.

## Narrow integration repair

Native exec --help exposes --ignore-user-config while preserving CODEX_HOME authentication. The pinned public SDK options do not expose this argument; raw config overrides only add --config pairs. It is not an established SDK isolation mechanism. The first help probe failed its second command because its synthetic CODEX_HOME directory did not exist. Creating that directory allowed both help and features list to complete without a model call.

The pinned native features list reports apps, plugins, remote_plugin and hooks as stable and enabled by default. A second offline probe wrote all four as true in a synthetic home configuration. Ordinary features list reported all four true; explicit -c features.<name>=false overrides reported all four false. Both commands exited zero. Only the executable and probe were mounted, with the standard offline resource limits, no host home or credentials and no model call. The configuration reference documents apps and hooks directly, the remote catalog flag, and plugin availability in its managed settings. The native probe establishes availability of these keys for this pinned executable.

The default production SDK client now supplies these four false values through the central CodexDisabledFeatures constant. Adapter transport factories construct that production client with only the executable substituted. The strict stub requires each resulting flag on every start and resume. The first focused run passed all 27 cases and fully covered adapter source and its factories; its overall command correctly exited one for omitted global source coverage. All four mutations completed and source was restored. Re-enabling apps, plugins, remote_plugin or hooks each failed 23 unique transport cases. Complete normal gates remain required. No broad adapter task is marked complete.

This repair does not disable inherited standalone MCP registrations. It does not prove hook commands cannot run on a real model turn or complete native persona permissions. There is no new model call, credential handling or executable wrapper. The existing pending persona MCP and live compatibility acceptance remain pending.

## Native user-config exclusion probe

A later native 0.167.0 execution probe used only a synthetic home and a loopback provider inside network-disabled Podman. The home registered a shell MCP command that wrote a private temporary startup marker and exited. The provider always returned a deliberate HTTP 400; no vendor service or real credential was used. Without --ignore-user-config the command started. With the flag it did not start. Both native executions reached the local provider and exited one for its deliberate refusal; the enclosing assertions exited zero.

This establishes exclusion of that home MCP registration for a native execution. It does not establish a complete model turn, retained real authentication, managed settings or project inheritance policy. The public pinned SDK still exposes no option for the flag. SDK integration and installed distribution must be repaired and tested together before claiming default MCP isolation. The probe currently lives only in temporary scripts; durable reproduction remains required.

## Trusted project and synthetic authentication probe

The corrected native-only offline probe supplied a synthetic home registration and a project .codex/config.toml registration. It also supplied explicit project trust through CLI configuration, preventing loss of home trust from being mistaken for configuration isolation. Without --ignore-user-config both startup markers appeared. With the flag neither appeared. Both cases read a synthetic auth.json in CODEX_HOME and authenticated both loopback requests before deliberate HTTP 400 responses. The enclosing command exited zero; no model service or real credential was used. The first draft failed before startup because reserved built-in provider entries cannot be replaced; that error was corrected before these assertions ran.

The probe used the [documented credential location](https://learn.chatgpt.com/docs/auth#credential-storage). It does not prove OS credential-store preservation, managed-policy behavior, real vendor conversation restoration or complete persona tool confinement. The current SDK still has no launch option for this native flag. Temporary sources are /tmp/titan-codex-trust-probe.js and /tmp/titan-run-codex-trust.ts; a durable checked probe is required before treating this as shipped behavior.

## SDK and installed archive repair

The repository now patches the pinned SDK launch option and enables ignoreUserConfig in the default Codex client. The patch adds a public option and forwards it to the native argument builder on every start and resume. It does not access private SDK fields or wrap the executable. Before this repair, requiring the native flag in the strict executable fixture failed 23 transport cases. With the repair the selected transport and active-process suites passed all 41 assertions. Their focused commands still exited one for omitted global coverage.

[Bun dependency patches](https://bun.com/docs/pm/cli/patch) belong to the root installation. A separately installed archive cannot rely on the source checkout's patchedDependencies. The preview therefore bundles the patched SDK and declares its native CLI dependency directly. Packaging reads the exact native version from the prepared SDK manifest; shared cases reject a missing dependency, a range and malformed metadata. The first unused-code check rejected a redundant catalog entry, which was removed rather than ignored. The corrected helper, boundary and transport selection passed all 45 assertions; its command exited one for omitted global coverage.

The complete fresh-install check exited zero with the final manifest helper. It installs the archive without mounting the checkout. Strict executable fixtures require the exclusion flag, including resumed turns. Existing decision and listing checks, sixteen SDK recoveries, four mixed workflows, four active-process cases, eight waiting cases and four parallel waiting cases all passed. The installed executable fixtures are stubs; they do not establish native default executable discovery or real conversation restoration.

The durable native probe is reproducible after the normal dependency and offline-image preparation:

```bash
bun openspec/changes/resilient-agent-blackboard-bun/research/probes/codex-user-config-offline.ts node_modules/.bun/@openai+codex@0.167.0-linux-x64/node_modules/@openai/codex/vendor/x86_64-unknown-linux-musl/bin/codex
```

That command exited zero. Without exclusion both home and explicitly trusted project markers appeared; with exclusion neither appeared. Both cases authenticated two loopback requests using only synthetic file credentials and ended with the deliberate native exit one. The enclosing probe requires these outcomes. It mounts only its compiled probe and pinned executable within the normal offline limits. Full persona tool policy, managed settings, OS credential storage and live vendor acceptance remain pending. No broad adapter task is marked complete.
