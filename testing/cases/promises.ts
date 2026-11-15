import { negative, positive, rejected } from "@titan/test-factories";

export const promiseSyntaxCases = {
  positive: [
    positive("shared capped utility is allowed", ["await all([() => work()]);"], []),
    positive("ordinary promise construction is allowed", ["await Promise.resolve(1);"], []),
    positive("fixture strings are reference data", ['const source = "Promise.all(items)";'], []),
  ],
  negative: [
    rejected("direct aggregation is blocked", ["await Promise.all(items);"], [1]),
    rejected("computed aggregation is blocked", ['await Promise["all"](items);'], [1]),
    rejected("method references cannot bypass the rule", ["const aggregate = Promise.all;"], [1]),
    rejected("uncapped settlement is also blocked", ["await Promise.allSettled(items);"], [1]),
    rejected("optional computed aggregation is blocked", ['await Promise?.["all"](items);'], [1]),
  ],
};

export const promiseRepositoryCases = {
  positive: [
    positive(
      "product uses capped tasks",
      ["packages/example/src/index.ts", "await all(tasks);", false],
      { code: 0, findings: 0 },
    ),
    positive(
      "vendor dependencies are outside owned sources",
      ["packages/example/node_modules/vendor/index.ts", "Promise.all(tasks);", false],
      { code: 0, findings: 0 },
    ),
    positive("empty source is valid", ["apps/example/src/empty.ts", "", false], {
      code: 0,
      findings: 0,
    }),
  ],
  negative: [
    rejected(
      "nested product source is checked",
      ["packages/example/src/nested/index.ts", "Promise.all(tasks);", false],
      { code: 1, findings: 1 },
    ),
    rejected(
      "executable vendor fixtures are checked",
      ["testing/fixtures/vendor.mjs", "Promise.allSettled(tasks);", false],
      { code: 1, findings: 1 },
    ),
    negative(
      "oversized source fails instead of growing the parser buffer",
      ["tooling/scripts/large.ts", "", true],
      {},
    ),
  ],
};
