import { Backend, RequestEscalationSurface } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const requestTurnProcessCases = {
  positive: [
    positive(
      "Codex worker denial continues after daemon death through CLI",
      [Backend.Codex, false, true, false, RequestEscalationSurface.Cli],
      true,
    ),
    positive(
      "Codex checker approval continues after daemon restart through HTTP",
      [Backend.Codex, true, false, false, RequestEscalationSurface.Http],
      true,
    ),
    positive(
      "Claude worker approval continues after daemon restart through MCP",
      [Backend.Claude, false, false, false, RequestEscalationSurface.Mcp],
      true,
    ),
    positive(
      "Claude checker denial continues after daemon death through CLI",
      [Backend.Claude, true, true, false, RequestEscalationSurface.Cli],
      true,
    ),
  ],
  negative: [
    rejected(
      "unanswered Codex worker cannot start a turn after daemon death",
      [Backend.Codex, false, true, true, RequestEscalationSurface.Mcp],
      true,
    ),
    rejected(
      "unanswered Codex checker cannot start a turn after daemon restart",
      [Backend.Codex, true, false, true, RequestEscalationSurface.Cli],
      true,
    ),
    rejected(
      "unanswered Claude worker cannot start a turn after daemon death",
      [Backend.Claude, false, true, true, RequestEscalationSurface.Http],
      true,
    ),
    rejected(
      "unanswered Claude checker cannot start a turn after daemon restart",
      [Backend.Claude, true, false, true, RequestEscalationSurface.Mcp],
      true,
    ),
  ],
};
