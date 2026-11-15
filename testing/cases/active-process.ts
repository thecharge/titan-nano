import { Backend, FileErrorCode, RunStatus } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const recovered = {
  requestPreserved: true,
  staleRequestRefused: true,
  state: RunStatus.Passed,
  stopped: true,
  sessionPreserved: true,
  executions: 2,
  attempt: 1,
  refutations: 0,
  delivered: true,
  originalPreserved: true,
};
const cancelled = { ...recovered, state: RunStatus.Cancelled, executions: 1, delivered: false };
export const processStateErrorCases = {
  positive: [
    positive("process reaped before opening stat is stopped", [FileErrorCode.Missing], true),
    positive("process exits during the stat read is stopped", [FileErrorCode.NoProcess], true),
  ],
  negative: [
    negative("denied stat cannot prove process exit", [FileErrorCode.AccessDenied], {
      code: FileErrorCode.AccessDenied,
    }),
    negative("stat I/O failure cannot prove process exit", [FileErrorCode.InputOutput], {
      code: FileErrorCode.InputOutput,
    }),
  ],
};
export const processStateEvidenceCases = {
  positive: [
    positive("reaped process is stopped", [null], true),
    positive("zombie process cannot write", ["Z"], true),
    positive("dead process cannot write", ["X"], true),
  ],
  negative: [
    rejected("running process is not stopped", ["R"], false),
    rejected("sleeping process is not stopped", ["S"], false),
    negative("unreadable process evidence fails closed", ["directory"], { code: "EISDIR" }),
  ],
};
export const activeProcessRecoveryCases = {
  positive: [
    positive(
      "Codex active descendant stops before native resume",
      [Backend.Codex, false],
      recovered,
    ),
    positive(
      "Claude active descendant stops before native resume",
      [Backend.Claude, false],
      recovered,
    ),
  ],
  negative: [
    rejected(
      "cancelled Codex descendant cannot continue writing",
      [Backend.Codex, true],
      cancelled,
    ),
    rejected(
      "cancelled Claude descendant cannot continue writing",
      [Backend.Claude, true],
      cancelled,
    ),
  ],
};
