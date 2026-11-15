import { ExecutionPhase, RunStatus } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const worker = {
  blocked: true,
  initialAgents: 0,
  initialSent: 0,
  initialExecutions: 0,
  agents: 2,
  closed: 2,
  sent: 2,
  state: RunStatus.Passed,
};
const checker = { ...worker, initialAgents: 1, initialSent: 1 };
export const phaseSetupCases = {
  positive: [
    positive("one complete step closes both sessions", [null], {
      ...worker,
      blocked: false,
      initialAgents: 2,
      initialSent: 2,
      initialExecutions: 1,
    }),
    positive("two complete steps close all sessions", [null, 2], {
      ...worker,
      blocked: false,
      initialAgents: 4,
      initialSent: 4,
      initialExecutions: 1,
      agents: 4,
      closed: 4,
      sent: 4,
    }),
  ],
  negative: [
    rejected(
      "worker task record failure starts no agent and resumes",
      [ExecutionPhase.Worker],
      worker,
    ),
    rejected(
      "checker task record failure preserves worker and resumes",
      [`${ExecutionPhase.FalsifierPrefix}0`],
      checker,
    ),
    rejected(
      "worker task record failure resumes after reload",
      [ExecutionPhase.Worker, 1, true],
      worker,
    ),
    rejected(
      "checker task record failure resumes after reload",
      [`${ExecutionPhase.FalsifierPrefix}0`, 1, true],
      checker,
    ),
  ],
};
