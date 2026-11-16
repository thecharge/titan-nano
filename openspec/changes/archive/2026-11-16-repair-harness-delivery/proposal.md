## Why

Titan has passing component tests but still loses concurrent edits during rollback, omits services from production workflows, and fails installed-package acceptance. We need to repair these gaps and finish the requested Claude Code and Codex delivery with evidence from the installed product.

## What Changes

- Add a delivery contract that rejects unsupported completion claims and links repairs to the existing product backlog.
- Repair file safety and enforce the selected backend before any vendor call.
- Complete production checks, knowledge sharing, run journals and recovery through the actual server.
- Complete installation, model setup, dashboard and the remaining Claude Code and Codex requirements in dependency order.
- Require local acceptance from an installed package, including failure and restart cases, before declaring readiness.
- Preserve unfinished work and existing product requirements. Paid vendor calls require separate explicit authorization.

## Capabilities

### New Capabilities

- `harness-delivery`: Evidence requirements and delivery gates for safe, installed Claude Code and Codex workflows.

### Modified Capabilities

None. Feature requirements remain owned by the active `resilient-agent-blackboard-bun` change. This repair change adds cross-feature acceptance and tracks implementation against those requirements.

## Impact

Runner and workspace file handling, backend admission, server composition, script approvals, knowledge storage, installation, dashboard, tests and release checks are affected. The Bun, TypeScript and SQLite stack stays in place. Verification runs locally; GitHub Actions and paid vendor calls are not authorized by this change. No publication or deployment is included.
