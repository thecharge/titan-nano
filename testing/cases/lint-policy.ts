import { LintPolicy } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const lintPolicyCandidateCases = {
  positive: [
    positive("canonical complete policy", [[], null], true),
    positive("property order does not change policy", [[], null, true], true),
  ],
  negative: [
    rejected(
      "Markdown formatting retains its dedicated document formatter",
      [["markdown", "formatter", "enabled"], true],
      false,
    ),
    rejected("disabled linter", [["linter", "enabled"], false], false),
    rejected(
      "project analysis cannot be disabled",
      [["linter", "domains", "project"], "none"],
      false,
    ),
    rejected(
      "floating promises cannot become warnings",
      [["linter", "rules", "nursery", "noFloatingPromises"], "warn"],
      false,
    ),
    rejected(
      "import cycles cannot be disabled",
      [["linter", "rules", "suspicious", "noImportCycles"], "off"],
      false,
    ),
    rejected("recommended rules remain required", [["linter", "rules", "preset"], "none"], false),
    rejected(
      "source inventory cannot omit product files",
      [["files", "includes"], ["testing/**"]],
      false,
    ),
    rejected(
      "new exclusions cannot hide product files",
      [
        ["files", "includes"],
        [...LintPolicy.Includes, "!!packages"],
      ],
      false,
    ),
    rejected("plugins cannot be removed", [["plugins"], []], false),
    rejected("unknown overrides cannot disable required rules", [["overrides"], []], false),
    rejected("file size cannot silently remove sources", [["files", "maxSize"], 1], false),
    rejected(
      "string checks cannot exclude the runtime",
      [
        ["plugins"],
        [
          { path: LintPolicy.ValuePlugin, includes: ["apps/*/src/**"] },
          { path: LintPolicy.ShapePlugin, includes: LintPolicy.ShapeIncludes },
          { path: LintPolicy.LiteralPlugin, includes: LintPolicy.LiteralIncludes },
        ],
      ],
      false,
    ),
    rejected(
      "type checks cannot exclude tests",
      [
        ["plugins"],
        [
          { path: LintPolicy.ValuePlugin, includes: LintPolicy.ValueIncludes },
          { path: LintPolicy.ShapePlugin, includes: ["packages/*/src/**"] },
          { path: LintPolicy.LiteralPlugin, includes: LintPolicy.LiteralIncludes },
        ],
      ],
      false,
    ),
  ],
};
export const lintPolicyFileCases = {
  positive: [
    positive("formatted policy stays unchanged", ["formatted"], 0),
    positive("compact policy stays unchanged", ["compact"], 0),
  ],
  negative: [
    rejected("missing policy fails closed", ["missing"], 1),
    rejected("null policy fails closed", ["null"], 1),
    rejected("empty policy fails closed", ["empty"], 1),
    rejected("malformed policy fails closed", ["malformed"], 1),
    rejected("oversized policy fails closed", ["large"], 1),
  ],
};
const accepted = { code: 0, matched: false, unchanged: true };
const refused = { code: 1, matched: true, unchanged: true };
export const lintOwnershipCases = {
  positive: [
    positive(
      "constants own literal values",
      [{ "packages/constants/src/value.ts": 'export const value = "ready";\n' }],
      accepted,
    ),
    positive(
      "messages own template text",
      [{ "packages/messages/src/value.ts": "export const value = `ready-" + "$" + "{1}`;\n" }],
      accepted,
    ),
    positive(
      "types own interfaces",
      [{ "packages/types/src/value.ts": "export interface Value { count: number; }\n" }],
      accepted,
    ),
    positive(
      "types own aliases",
      [{ "packages/types/src/value.ts": "export type Value = number;\n" }],
      accepted,
    ),
  ],
  negative: [
    rejected(
      "application cannot own literal values",
      [{ "apps/cli/src/value.ts": 'export const value = "ready";\n' }, "Inline string literal"],
      refused,
    ),
    rejected(
      "runtime cannot own template text",
      [
        { "packages/runtime/src/value.ts": "export const value = `ready-" + "$" + "{1}`;\n" },
        "Inline template text",
      ],
      refused,
    ),
    rejected(
      "application cannot own interfaces",
      [
        { "apps/cli/src/value.ts": "export interface Value { count: number; }\n" },
        "Interface declared outside",
      ],
      refused,
    ),
    rejected(
      "runtime cannot own aliases",
      [
        { "packages/runtime/src/value.ts": "export type Value = number;\n" },
        "Type alias declared outside",
      ],
      refused,
    ),
    rejected(
      "tooling cannot own inline object types",
      [
        { "tooling/scripts/value.ts": "export const value: { count: number } = { count: 1 };\n" },
        "Inline object type",
      ],
      refused,
    ),
    rejected(
      "tests cannot own aliases",
      [
        { "testing/support/value.ts": "export type Value = number;\n" },
        "Type alias declared outside",
      ],
      refused,
    ),
    rejected(
      "types cannot own a string literal type",
      [{ "packages/types/src/value.ts": 'export type Value = "ready";\n' }, "String literal type"],
      refused,
    ),
    rejected(
      "types cannot own a union of literal types",
      [
        { "packages/types/src/value.ts": 'export type Value = "ready" | "done";\n' },
        "String literal type",
      ],
      refused,
    ),
    rejected(
      "constants cannot hide literal types in functions",
      [
        {
          "packages/constants/src/value.ts":
            'export function value(): "ready" { return "ready"; }\n',
        },
        "String literal type",
      ],
      refused,
    ),
    rejected(
      "tests cannot hide literal result types",
      [
        { "testing/support/value.ts": 'export function value(): "ready" { return "ready"; }\n' },
        "String literal type",
      ],
      refused,
    ),
  ],
};
export const lintPromiseCases = {
  positive: [
    positive(
      "awaited promise is handled",
      [{ "packages/runtime/src/value.ts": "await Promise.resolve(1);\n" }],
      accepted,
    ),
    positive(
      "explicit background promise is marked",
      [{ "packages/runtime/src/value.ts": "void Promise.resolve(1);\n" }],
      accepted,
    ),
  ],
  negative: [
    rejected(
      "bare promise is rejected",
      [{ "packages/runtime/src/value.ts": "Promise.resolve(1);\n" }, "noFloatingPromises"],
      refused,
    ),
    rejected(
      "unhandled asynchronous call is rejected",
      [
        { "packages/runtime/src/value.ts": "async function value() { return 1; }\nvalue();\n" },
        "noFloatingPromises",
      ],
      refused,
    ),
  ],
};
export const lintCycleCases = {
  positive: [
    positive(
      "two modules form a directed chain",
      [
        {
          "packages/runtime/src/a.ts":
            'import { b } from "./b.ts"; export function a() { return b(); }\n',
          "packages/runtime/src/b.ts": "export function b() { return 1; }\n",
        },
      ],
      accepted,
    ),
    positive(
      "three modules form a directed chain",
      [
        {
          "packages/runtime/src/a.ts":
            'import { b } from "./b.ts"; export function a() { return b(); }\n',
          "packages/runtime/src/b.ts":
            'import { c } from "./c.ts"; export function b() { return c(); }\n',
          "packages/runtime/src/c.ts": "export function c() { return 1; }\n",
        },
      ],
      accepted,
    ),
  ],
  negative: [
    rejected(
      "two modules cannot import each other",
      [
        {
          "packages/runtime/src/a.ts":
            'import { b } from "./b.ts"; export function a() { return b(); }\n',
          "packages/runtime/src/b.ts":
            'import { a } from "./a.ts"; export function b() { return a(); }\n',
        },
        "noImportCycles",
      ],
      refused,
    ),
    rejected(
      "three module cycle is rejected",
      [
        {
          "packages/runtime/src/a.ts":
            'import { b } from "./b.ts"; export function a() { return b(); }\n',
          "packages/runtime/src/b.ts":
            'import { c } from "./c.ts"; export function b() { return c(); }\n',
          "packages/runtime/src/c.ts":
            'import { a } from "./a.ts"; export function c() { return a(); }\n',
        },
        "noImportCycles",
      ],
      refused,
    ),
  ],
};
