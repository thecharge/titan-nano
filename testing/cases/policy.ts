import { positive, rejected } from "@titan/test-factories";

const fixer = { description: "Fixes", role: "Fix the file" };
const reviewer = { description: "Reviews", role: "Refute the fix" };
const workflow = (extra: object = {}) => ({
  name: "File",
  goal: "Fix the parser",
  personas: { fixer, reviewer },
  steps: [
    {
      id: "one",
      do: { persona: "fixer", task: "Fix" },
      falsify: [{ persona: "reviewer", task: "Refute" }],
    },
  ],
  ...extra,
});
const first = { run: "r1", choices: { width: 2 }, reward: 0.64 };
const second = { run: "r2", choices: { width: 4 }, reward: 0.5 };
const input = { results: 5, survived: 4, criticalMinutes: 2, agents: 6 };

export const policyKindCases = {
  positive: [
    positive(
      "a workflow kind names the policy file that holds the run",
      [workflow({ policy: { kind: "code-fix" } }), [first]],
      { ok: true, files: ["code-fix.json"], runs: [first] },
    ),
    positive("a workflow without a kind uses the general file", [workflow(), [first]], {
      ok: true,
      files: ["general.json"],
      runs: [first],
    }),
    positive(
      "two runs of one kind are both kept",
      [workflow({ policy: { kind: "research" } }), [first, second]],
      { ok: true, files: ["research.json"], runs: [first, second] },
    ),
    positive(
      "one run id replayed is kept once",
      [workflow({ policy: { kind: "research" } }), [first, first]],
      { ok: true, files: ["research.json"], runs: [first] },
    ),
  ],
  negative: [
    rejected(
      "a kind that climbs out of the folder is refused",
      [workflow({ policy: { kind: "../escape" } }), [first]],
      { ok: false, code: "invalid_workflow" },
    ),
    rejected(
      "a kind with a space is refused",
      [workflow({ policy: { kind: "code fix" } }), [first]],
      { ok: false, code: "invalid_workflow" },
    ),
  ],
};

export const rewardCases = {
  positive: [
    positive("4 of 5 survived, 2 minutes, 6 agents give 0.64", [input, {}], {
      ok: true,
      reward: 0.64,
    }),
    positive(
      "a yes verdict replaces the survival share with 1",
      [{ ...input, verdict: true }, {}],
      {
        ok: true,
        reward: 0.84,
      },
    ),
    positive(
      "a no verdict replaces the survival share with 0",
      [{ ...input, verdict: false }, {}],
      {
        ok: true,
        reward: -0.16,
      },
    ),
    positive(
      "an empty run has reward 0",
      [{ results: 0, survived: 0, criticalMinutes: 0, agents: 0 }, {}],
      { ok: true, reward: 0 },
    ),
    positive(
      "config weights replace the defaults",
      [input, { policy: { w_agent: 0, w_time: 0.1 } }],
      {
        ok: true,
        reward: 0.6,
      },
    ),
  ],
  negative: [
    rejected(
      "a negative agent weight in the config is refused",
      [input, { policy: { w_agent: -1 } }],
      {
        ok: false,
        path: "policy.w_agent",
      },
    ),
    rejected("an unknown weight in the config is refused", [input, { policy: { w_speed: 1 } }], {
      ok: false,
      path: "policy",
    }),
  ],
};
