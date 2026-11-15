import { positive, rejected } from "@titan/test-factories";

export const ciPolicyFixture = {
  name: "Forbidden workflow",
  on: { push: null, pull_request: null },
  jobs: { verify: { steps: [{ run: "bun run check" }] } },
};

export const ciPolicyCases = {
  positive: [
    positive("an empty workflow inventory keeps checks local", [[]], true),
    positive("an immutable empty inventory is accepted", [Object.freeze([])], true),
  ],
  negative: [
    rejected("a push workflow is refused", [[".github/workflows/push.yml"]], false),
    rejected("a pull request workflow is refused", [[".github/workflows/pr.yaml"]], false),
    rejected(
      "a manual workflow still requires explicit authorization",
      [[".github/workflows/manual.yml"]],
      false,
    ),
    rejected(
      "a hidden workflow cannot escape the inventory",
      [[".github/workflows/.hidden.yml"]],
      false,
    ),
    rejected("a malformed inventory cannot certify absence", [null], false),
    rejected("an object cannot replace the inventory", [{}], false),
    rejected("a non-string entry cannot certify absence", [[null]], false),
    rejected("an old workflow definition is refused", [ciPolicyFixture], false),
  ],
};
