# Harness plug-in probe

Run on 2026-11-05 on Linux x86-64.

- `titan/`: one plug-in in the Claude Code form. It has `.claude-plugin/plugin.json`, the skill `skills/titan/SKILL.md`, and `.mcp.json`, which starts the tool server `titan mcp`.
- `validate-output.txt`: `claude plugin validate titan` passed with warnings about a missing author, README, licence and icon. `agy plugin validate titan` failed, because Antigravity looks for `plugin.json` in the top folder.
- `agy-import-output.txt`: `agy plugin import titan`, run with an empty home folder, imported 1 skill and 1 tool server.
- Not run: a live agent loading the skill, and `codex mcp add`, so that the user's Codex settings stay as they are.
