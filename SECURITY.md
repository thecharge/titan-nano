# Report a security concern

Use [GitHub Issues](https://github.com/thecharge/titan-nano/issues) to contact the maintainers about an affected component and its impact. Keep the initial report brief when reproduction details are sensitive. Omit credentials, personal data, private source code and reusable exploit details from public reports.

Include the Titan version, operating system, selected agent and the affected operation. Describe whether the problem concerns file access, command execution, approvals, stored records or another component. Maintainers will use the issue to coordinate the next reporting step.

If a credential was exposed, revoke or rotate it with its provider. Report the affected service and impact without copying the credential into the issue.

## Current security boundaries

Titan workers and scripts operate in the shared project directory. File claims coordinate cooperating work. Complete native write enforcement, human-only credential isolation across vendor tools and supported data migrations remain open in [OpenSpec](openspec/changes/resilient-agent-blackboard-bun/tasks.md). The [usage guide](docs/preview.md) describes current permissions and recovery behavior.

Version-specific verification is recorded in the [delivery evidence](openspec/changes/archive/2026-11-16-repair-harness-delivery/evidence.md). Security fixes are maintained on the current main branch. Earlier tagged versions have no separate maintenance commitment.
