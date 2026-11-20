import { Backend, RequestEscalationSurface } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const requestTurnProcessCases = {
  positive: [
    positive(
      "Codex worker denial continues after daemon death through CLI",
      [Backend.Codex, false, true, false, RequestEscalationSurface.Cli, false],
      true,
    ),
    positive(
      "Codex checker approval continues after daemon restart through HTTP",
      [Backend.Codex, true, false, false, RequestEscalationSurface.Http, false],
      true,
    ),
    positive(
      "Claude worker approval continues after daemon restart through MCP",
      [Backend.Claude, false, false, false, RequestEscalationSurface.Mcp, false],
      true,
    ),
    positive(
      "Claude checker denial continues after daemon death through CLI",
      [Backend.Claude, true, true, false, RequestEscalationSurface.Cli, false],
      true,
    ),
    positive(
      "Codex resumes an approved native web read and records its refusal",
      [Backend.Codex, false, false, true, RequestEscalationSurface.Cli, true],
      true,
    ),
    positive(
      "Claude resumes an approved native web read and records its refusal",
      [Backend.Claude, false, false, true, RequestEscalationSurface.Cli, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "unanswered Codex worker cannot start a turn after daemon death",
      [Backend.Codex, false, true, true, RequestEscalationSurface.Mcp, false],
      true,
    ),
    rejected(
      "unanswered Codex checker cannot start a turn after daemon restart",
      [Backend.Codex, true, false, true, RequestEscalationSurface.Cli, false],
      true,
    ),
    rejected(
      "unanswered Claude worker cannot start a turn after daemon death",
      [Backend.Claude, false, true, true, RequestEscalationSurface.Http, false],
      true,
    ),
    rejected(
      "unanswered Claude checker cannot start a turn after daemon restart",
      [Backend.Claude, true, false, true, RequestEscalationSurface.Mcp, false],
      true,
    ),
    rejected(
      "Claude resumes a denied native web read without acquisition",
      [Backend.Claude, false, true, true, RequestEscalationSurface.Cli, true],
      true,
    ),
    rejected(
      "Codex resumes a denied native web read without acquisition",
      [Backend.Codex, false, true, true, RequestEscalationSurface.Cli, true],
      true,
    ),
  ],
};
