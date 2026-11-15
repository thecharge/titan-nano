import { negative, positive, rejected } from "@titan/test-factories";

const fixer = { description: "Fixes", role: "Fix the file" };
const reviewer = { description: "Reviews", role: "Refute the fix" };
const falsifier = { persona: "reviewer", task: "Refute" };
const step = (extra: object = {}, id = "one") => ({
  id,
  do: { persona: "fixer", task: "Fix" },
  falsify: [falsifier],
  ...extra,
});
const workflow = (extra: object = {}, steps: unknown[] = [step()]) => ({
  name: "File",
  goal: "Plan a move to Sofia for under 3000 EUR",
  personas: { fixer, reviewer },
  steps,
  ...extra,
});

export const workflowShapeCases = {
  positive: [
    positive(
      "a Linux goal Lean check passes shape validation",
      [workflow({ verify: [{ kind: "lean", statement: "sum.lean", theorems: ["sum"] }] }), "linux"],
      { ok: true, nodes: 1 },
    ),
    positive("a macOS workflow without Lean passes shape validation", [workflow(), "darwin"], {
      ok: true,
      nodes: 1,
    }),
    positive(
      "a script with an independent reconciliation persona passes",
      [
        workflow({}, [
          step({
            do: { script: "deliver once" },
            reconcile: { persona: "fixer", task: "Merge retained edits" },
          }),
        ]),
      ],
      { ok: true, nodes: 1 },
    ),
    positive(
      "a native step with an explicit reconciliation action passes",
      [workflow({}, [step({ reconcile: { persona: "fixer", task: "Merge retained edits" } })])],
      { ok: true, nodes: 1 },
    ),
    positive("one checked step passes", [workflow()], { ok: true, nodes: 1 }),
    positive(
      "an open call with a split passes",
      [
        workflow({}, [
          step({
            do: { call: { tags: ["code"], task: "Fix one file" } },
            split: { parts: "plan.files" },
          }),
        ]),
      ],
      { ok: true, nodes: 1 },
    ),
    positive("a script step passes", [workflow({}, [step({ do: { script: "bun test" } })])], {
      ok: true,
      nodes: 1,
    }),
    positive(
      "nested groups keep every step",
      [workflow({}, [step({}, "a"), { parallel: [step({}, "b"), step({}, "c")] }, step({}, "d")])],
      { ok: true, nodes: 4 },
    ),
    positive(
      "a goal check and run limits pass",
      [
        workflow({
          limits: { max_steps: 20, max_parallel: 2, max_minutes: 30 },
          verify: [{ kind: "script", run: "bun test", deterministic: true }],
        }),
      ],
      { ok: true, nodes: 1 },
    ),
    positive(
      "the three persona forms pass",
      [
        workflow({
          personas: {
            fixer,
            reviewer: { use: "reviewer@2" },
            variant: { mutates: "fixer@1", role: "Fix quickly" },
          },
        }),
      ],
      { ok: true, nodes: 1 },
    ),
    positive(
      "several candidates with a judge pass",
      [workflow({}, [step({ candidates: 3, judge: "reviewer" })])],
      { ok: true, nodes: 1 },
    ),
    positive(
      "a lean check with theorems passes",
      [
        workflow({}, [
          step({ verify: [{ kind: "lean", statement: "proofs/sum.lean", theorems: ["sum"] }] }),
        ]),
      ],
      { ok: true, nodes: 1 },
    ),
  ],
  negative: [
    rejected(
      "a macOS step Lean check names the Linux requirement",
      [
        workflow({}, [
          step({ verify: [{ kind: "lean", statement: "sum.lean", theorems: ["sum"] }] }),
        ]),
        "darwin",
      ],
      { ok: false, code: "invalid_workflow", message: "lean checks need Linux" },
    ),
    rejected(
      "a Windows goal Lean check names the Linux requirement",
      [workflow({ verify: [{ kind: "lean", statement: "sum.lean", theorems: ["sum"] }] }), "win32"],
      { ok: false, code: "invalid_workflow", message: "lean checks need Linux" },
    ),
    rejected(
      "an unknown reconciliation persona names the step",
      [workflow({}, [step({ reconcile: { persona: "ghost", task: "Merge" } })])],
      { ok: false, code: "unknown_persona", message: 'one: unknown persona "ghost"' },
    ),
    rejected(
      "a reconciliation persona cannot falsify its own script result",
      [
        workflow({}, [
          step({
            do: { script: "deliver once" },
            reconcile: { persona: "reviewer", task: "Merge" },
          }),
        ]),
      ],
      {
        ok: false,
        code: "self_falsification",
        message: "one: a step cannot be falsified by its own persona",
      },
    ),
    rejected(
      "a reconciliation alias cannot falsify its own script result",
      [
        workflow({ personas: { fixer: { use: "coder@2" }, reviewer: { use: "coder@2" } } }, [
          step({ do: { script: "deliver once" }, reconcile: { persona: "fixer", task: "Merge" } }),
        ]),
      ],
      {
        ok: false,
        code: "self_falsification",
        message: "one: a step cannot be falsified by its own persona",
      },
    ),
    rejected(
      "an unknown persona names the step and the quoted name",
      [workflow({}, [step({ do: { persona: "chemist", task: "Fix" } })])],
      { ok: false, code: "unknown_persona", message: 'one: unknown persona "chemist"' },
    ),
    rejected(
      "a worker cannot falsify itself",
      [workflow({}, [step({ falsify: [{ persona: "fixer", task: "Refute" }] })])],
      {
        ok: false,
        code: "self_falsification",
        message: "one: a step cannot be falsified by its own persona",
      },
    ),
    rejected(
      "two aliases of one registered persona cannot falsify each other",
      [
        workflow({
          personas: { fixer: { use: "coder@2" }, reviewer: { use: "coder@2" } },
        }),
      ],
      {
        ok: false,
        code: "self_falsification",
        message: "one: a step cannot be falsified by its own persona",
      },
    ),
    rejected("a step without a falsifier fails", [workflow({}, [step({ falsify: [] })])], {
      ok: false,
      code: "no_falsifier",
      message: "one: every step needs at least one falsifier",
    }),
    rejected(
      "two steps with one id name both paths",
      [workflow({}, [step({}, "plan"), { parallel: [step({}, "plan")] }])],
      {
        ok: false,
        code: "duplicate_step",
        message: "Duplicate step id: plan at steps[0] and steps[1].parallel[0]",
      },
    ),
    rejected("candidates above one need a judge", [workflow({}, [step({ candidates: 3 })])], {
      ok: false,
      code: "missing_judge",
      message: "one: candidates > 1 needs a judge",
    }),
    rejected(
      "an unknown policy field is named by its path",
      [workflow({ policy: { kind: "code-fix", speed: "high" } })],
      {
        ok: false,
        code: "invalid_workflow",
        message: 'policy.speed: Unrecognized key: "speed"',
      },
    ),
    rejected(
      "only the person sets the time weight",
      [workflow({ policy: { kind: "code-fix", w_time: 2 } })],
      {
        ok: false,
        code: "invalid_workflow",
        message: "policy.w_time: only the person sets w_time, in ~/.titan/config.yaml",
      },
    ),
    rejected(
      "only the person sets the agent weight, even at zero",
      [workflow({ policy: { w_agent: 0 } })],
      {
        ok: false,
        code: "invalid_workflow",
        message: "policy.w_agent: only the person sets w_agent, in ~/.titan/config.yaml",
      },
    ),
    rejected(
      "a lean entry without theorems fails at its path",
      [workflow({}, [step({ verify: [{ kind: "lean", statement: "proofs/sum.lean" }] })])],
      {
        ok: false,
        code: "invalid_workflow",
        message: "steps[0].verify[0].theorems: theorems must name at least one theorem",
      },
    ),
    rejected(
      "a check of an unknown kind fails at its path",
      [workflow({}, [step({ verify: [{ kind: "coq", statement: "proofs/sum.v" }] })])],
      {
        ok: false,
        code: "invalid_workflow",
        message: "steps[0].verify[0].kind: kind must be lean, smt or script",
      },
    ),
    rejected(
      "an unknown kind and a misspelled field in one step are both named",
      [
        workflow({}, [
          step({ verify: [{ kind: "coq", statement: "proofs/sum.v" }], max_tries: 3 }),
        ]),
      ],
      {
        ok: false,
        code: "invalid_workflow",
        message: [
          "steps[0].verify[0].kind: kind must be lean, smt or script",
          'steps[0].max_tries: Unrecognized key: "max_tries"',
        ].join("\n"),
      },
    ),
    rejected(
      "a goal check of an unknown kind fails at its path",
      [workflow({ verify: [{ kind: "coq", statement: "proofs/sum.v" }] })],
      {
        ok: false,
        code: "invalid_workflow",
        message: "verify[0].kind: kind must be lean, smt or script",
      },
    ),
    rejected("a misspelled field is an unknown field", [workflow({}, [step({ max_tries: 3 })])], {
      ok: false,
      code: "invalid_workflow",
      message: 'steps[0].max_tries: Unrecognized key: "max_tries"',
    }),
    rejected(
      "an empty candidate backend list fails at its path",
      [workflow({}, [step({ candidate_backends: [] })])],
      {
        ok: false,
        code: "invalid_workflow",
        message: "steps[0].candidate_backends: Too small: expected array to have >=1 items",
      },
    ),
  ],
};

const pending = (id: string, feature: string) => ({
  ok: false,
  code: "not_built",
  message: `${id}: ${feature} is not built yet in this preview`,
});

export const workflowBuiltCases = {
  positive: [
    positive("a plain checked step is built", [workflow()], { ok: true, nodes: 1 }),
    positive(
      "a goal script proof check is built",
      [workflow({ verify: [{ kind: "script", run: "bun test", deterministic: true }] })],
      { ok: true, nodes: 1 },
    ),
    positive(
      "a script step is built for the check",
      [workflow({}, [step({ do: { script: "bun test" } })])],
      {
        ok: true,
        nodes: 1,
      },
    ),
    positive(
      "a step proof check is built for the statement lock",
      [workflow({}, [step({ verify: [{ kind: "lean", statement: "a.lean", theorems: ["t"] }] })])],
      { ok: true, nodes: 1 },
    ),
    positive(
      "an open call is built",
      [workflow({}, [step({ do: { call: { tags: ["code"], task: "Fix" } } })])],
      { ok: true, nodes: 1 },
    ),
  ],
  negative: [
    rejected(
      "several candidates are refused before work",
      [workflow({}, [step({ candidates: 2, judge: "reviewer" })])],
      pending("one", "several candidates"),
    ),
    rejected(
      "candidate backends are refused before work",
      [workflow({}, [step({ candidate_backends: ["fake"] })])],
      pending("one", "candidate backends"),
    ),
    rejected(
      "a step SMT check is refused before work",
      [workflow({}, [step({ verify: [{ kind: "smt", statement: "proof.smt2" }] })])],
      pending("one", "verify"),
    ),
    rejected(
      "a goal SMT proof check is refused before work",
      [workflow({ verify: [{ kind: "smt", statement: "proof.smt2" }] })],
      pending("File", "verify"),
    ),
  ],
};

export const personaHelperCases = {
  positive: [
    positive("a written persona resolves", [workflow(), "fixer"], {
      ok: true,
      role: "Fix the file",
      worker: "fixer",
    }),
    positive(
      "a call step has no worker persona",
      [workflow({}, [step({ do: { call: { tags: ["code"], task: "Fix" } } })]), "reviewer"],
      {
        ok: true,
        role: "Refute the fix",
        worker: undefined,
      },
    ),
  ],
  negative: [
    rejected("an unknown persona is named", [workflow(), "ghost"], {
      ok: false,
      code: "unknown_persona",
      message: 'File: unknown persona "ghost"',
    }),
    rejected(
      "a register persona is not resolved",
      [workflow({ personas: { fixer, reviewer, shared: { use: "shared@1" } } }), "shared"],
      {
        ok: false,
        code: "unresolved_persona",
        message: "personas.shared: a persona taken from the register is not resolved yet",
      },
    ),
  ],
};

export const statementPathCases = {
  positive: [
    positive(
      "statement and solution inside the project pass",
      ["proofs/sum.lean", null, "proofs/sum.lean"],
      { ok: true },
    ),
    positive(
      "missing solution inside the project passes the path check",
      ["proofs/sum.lean", null, "proofs/missing.lean"],
      { ok: true },
    ),
    positive("a statement inside the project passes", ["proofs/sum.lean", null], { ok: true }),
    positive("a script check has no statement file to test", [null, null], { ok: true }),
    positive("a missing statement file passes the path check", ["proofs/none.lean", null], {
      ok: true,
    }),
  ],
  negative: [
    negative(
      "statement link loop retains its resolution error",
      ["loop.lean", "loop.lean", undefined, true],
      { code: "ELOOP" },
    ),
    negative(
      "solution link loop retains its resolution error",
      ["proofs/sum.lean", "loop.lean", "loop.lean", true],
      { code: "ELOOP" },
    ),
    rejected(
      "solution outside the project is refused",
      ["proofs/sum.lean", null, "../secret.lean"],
      { ok: false, code: "unsafe_path" },
    ),
    rejected("a statement outside the project is refused", ["../secret.lean", null], {
      ok: false,
      code: "unsafe_path",
    }),
    rejected(
      "a statement through a symlink out of the project is refused",
      ["link.lean", "link.lean"],
      {
        ok: false,
        code: "unsafe_symlink",
      },
    ),
  ],
};
