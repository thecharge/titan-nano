import { Backend, RunStatus } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const complete = { state: RunStatus.Passed, opened: 2, executions: 1 };
const blocked = { state: RunStatus.Blocked, opened: 0, executions: 0 };
export const hostTaskCases = {
  positive: [
    positive("Codex host accepts complete turn data", [Backend.Codex, false], complete),
    positive("Claude host accepts complete turn data", [Backend.Claude, false], complete),
  ],
  negative: [
    rejected("Codex oversized role spends no execution", [Backend.Codex, true], blocked),
    rejected("Claude oversized role spends no execution", [Backend.Claude, true], blocked),
  ],
};
