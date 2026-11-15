import { AgentTool, Backend, ErrorCode } from "@titan/constants";
import { unknownPersona, unsupportedPersonaTools } from "@titan/messages";
import { negative, positive, rejected } from "@titan/test-factories";

const empty = [[], []];
const files = [[AgentTool.Read, AgentTool.Write], [AgentTool.Read]];
const shell = [[AgentTool.Read], [AgentTool.Bash]];
const builderShell = [[AgentTool.Bash], [AgentTool.Read]];
const checkerWrites = [[AgentTool.Write], [AgentTool.Edit]];
const shellFailure = {
  code: ErrorCode.PermissionDenied,
  message: unsupportedPersonaTools("checker", [AgentTool.Bash]),
};
const checkerFailure = {
  code: ErrorCode.PermissionDenied,
  message: unsupportedPersonaTools("checker", [AgentTool.Edit]),
};

export const toolAdmissionCases = {
  positive: [
    positive("no implicit tools", empty, true),
    positive("worker writes and checker reads", files, true),
  ],
  negative: [
    negative("shell policy is unavailable", shell, shellFailure),
    negative("checker cannot request writes", checkerWrites, checkerFailure),
  ],
};
export const mcpToolAdmissionCases = {
  positive: toolAdmissionCases.positive,
  negative: [
    rejected("shell policy is unavailable", shell, false),
    rejected("checker cannot request writes", checkerWrites, false),
  ],
};
export const planToolAdmissionCases = {
  positive: [
    positive("explicit Claude permissions", [...files, Backend.Claude], true),
    positive("builder may run shell commands", [...builderShell, Backend.Claude], true),
    positive("workflow fallback", [...files, undefined, undefined, Backend.Claude], true),
    positive("unresolved backend leaves vendor admission pending", empty, true),
    positive(
      "effective fallback overrides workflow default",
      [...shell, undefined, Backend.Fake, Backend.Claude],
      true,
    ),
    positive(
      "explicit persona overrides effective fallback",
      [...files, Backend.Claude, Backend.Fake],
      true,
    ),
  ],
  negative: [
    negative(
      "explicit persona rejects shell despite fake fallback",
      [...shell, Backend.Claude, Backend.Fake],
      shellFailure,
    ),
    negative(
      "effective fallback rejects shell",
      [...shell, undefined, Backend.Claude],
      shellFailure,
    ),
    negative(
      "workflow fallback rejects shell",
      [...shell, undefined, undefined, Backend.Claude],
      shellFailure,
    ),
    negative(
      "checker role restricts writable tools",
      [...checkerWrites, Backend.Claude],
      checkerFailure,
    ),
    negative(
      "missing persona cannot be skipped",
      [...empty, Backend.Claude, undefined, undefined, true],
      { code: ErrorCode.UnknownPersona, message: unknownPersona("Tool admission", "worker") },
    ),
  ],
};
export const cliFallbackToolAdmissionCases = {
  positive: [
    positive("CLI fallback accepts exact files", [...files, Backend.Claude], true),
    positive("CLI fallback accepts no tools", [...empty, Backend.Claude], true),
    positive("CLI fallback accepts builder shell", [...builderShell, Backend.Claude], true),
  ],
  negative: [
    negative("CLI fallback refuses shell", [...shell, Backend.Claude], shellFailure),
    negative(
      "CLI fallback refuses checker writes",
      [...checkerWrites, Backend.Claude],
      checkerFailure,
    ),
  ],
};
