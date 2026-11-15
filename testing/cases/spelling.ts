import { SpellingConfiguration, SpellingFixture, SpellingPolicy } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const valid = { code: 0, unchanged: true };
const invalid = { code: 1, unchanged: true };
export const spellingCheckCases = {
  positive: [
    positive(
      "maintained guide uses plain words",
      ["guide.md", "Deliver reliable workflows.\n", SpellingFixture.Plain, { batch_files: 1 }],
      valid,
    ),
    positive(
      "nested product source uses reviewed technical terms",
      [
        "packages/component/src/main.ts",
        'export const workflow = "backpressure";\n',
        SpellingFixture.Plain,
        { batch_files: 1 },
      ],
      valid,
    ),
    positive(
      "option-shaped source is passed as a file",
      ["--no-progress.md", "Deliver reliable workflows."],
      valid,
    ),
    positive(
      "dependency source is outside maintained ownership",
      ["packages/component/node_modules/dependency/index.ts", ["cspell", "disable"].join(":")],
      valid,
    ),
    positive(
      "generated source is outside maintained ownership",
      ["packages/component/dist/main.ts", ["spell-checker", "ignore"].join(":")],
      valid,
    ),
  ],
  negative: [
    negative(
      "unknown fixture policy cannot silently use plain mode",
      ["guide.md", "A guide.", "unexpected"],
      { name: "ZodError" },
    ),
    negative("obsolete fixture flags are rejected", ["guide.md", "A guide.", false], {
      name: "ZodError",
    }),
    rejected(
      "global dictionary cannot hide a guide error",
      ["guide.md", `A ${"mistake".repeat(3)}.\n`, SpellingFixture.GlobalPolicy],
      invalid,
    ),
    rejected(
      "global dictionary cannot hide nested source",
      [
        "packages/component/src/main.ts",
        `export const workflow = "${"delivery".repeat(3)}";\n`,
        SpellingFixture.GlobalPolicy,
      ],
      invalid,
    ),
    rejected(
      "quoted typo is still invalid in ordinary guides",
      ["guide.md", "solutions".replace("l", "ll")],
      invalid,
    ),
    rejected(
      "deliberate unknown field is still invalid in ordinary source",
      [
        "packages/component/src/main.ts",
        `export const workflow = "${"max_attempts".replace("tt", "t")}";\n`,
      ],
      invalid,
    ),
    rejected(
      "guide spelling error fails",
      ["guide.md", `A ${"mistake".repeat(3)}.\n`, SpellingFixture.Plain, { batch_files: 1 }],
      invalid,
    ),
    rejected(
      "option-shaped guide cannot bypass checking",
      ["--no-progress.md", `A ${"mistake".repeat(3)}.`],
      invalid,
    ),
    rejected(
      "nested product spelling error fails",
      [
        "packages/component/src/main.ts",
        `export const workflow = "${"delivery".repeat(3)}";\n`,
        SpellingFixture.Plain,
        { batch_files: 1 },
      ],
      invalid,
    ),
    rejected(
      "ignore file cannot hide a guide",
      ["guide.md", `A ${"mistake".repeat(3)}.\n`, SpellingFixture.GitIgnored],
      invalid,
    ),
    rejected(
      "child configuration cannot disable a guide",
      ["guide.md", `A ${"mistake".repeat(3)}.\n`, SpellingFixture.ChildPolicy],
      invalid,
    ),
    rejected(
      "child configuration cannot disable nested source",
      [
        "packages/component/src/main.ts",
        `export const workflow = "${"delivery".repeat(3)}";\n`,
        SpellingFixture.ChildPolicy,
      ],
      invalid,
    ),
  ],
};

const admitted = { admitted: true, spawned: 1 };
const refused = { admitted: false, spawned: 0 };
const directive = ["cspell", "disable"].join(":");
export const spellingAdmissionCases = {
  positive: [
    positive("canonical scope is admitted", [SpellingConfiguration], admitted),
    positive(
      "ordinary source retains policy",
      [SpellingConfiguration, "Deliver reliable workflows."],
      admitted,
    ),
    positive(
      "complete inventory spans bounded commands",
      [SpellingConfiguration, "", false, SpellingPolicy.MaximumFiles + 1],
      { admitted: true, spawned: 2 },
    ),
  ],
  negative: [
    rejected(
      "extra exclusion cannot hide guides",
      [
        {
          ...SpellingConfiguration,
          ignorePaths: [...SpellingConfiguration.ignorePaths, "docs/**"],
        },
      ],
      refused,
    ),
    rejected(
      "dictionary cannot silently grow",
      [{ ...SpellingConfiguration, words: [...SpellingConfiguration.words, "mistake".repeat(3)] }],
      refused,
    ),
    rejected(
      "remote configuration cannot be imported",
      [{ ...SpellingConfiguration, import: ["https://example.invalid/policy.json"] }],
      refused,
    ),
    rejected(
      "scope cannot omit product packages",
      [{ ...SpellingConfiguration, files: ["*.md"] }],
      refused,
    ),
    rejected("inline disabling is forbidden", [SpellingConfiguration, directive], refused),
    rejected(
      "later source directive refuses before any command",
      [
        SpellingConfiguration,
        directive,
        false,
        2,
        { batch_files: 1 },
        "packages/component/src/main.ts",
      ],
      refused,
    ),
    rejected(
      "alternate inline policy is forbidden",
      [SpellingConfiguration, ["spell-checker", "ignore"].join(":")],
      refused,
    ),
    rejected(
      "short inline prefix is forbidden",
      [SpellingConfiguration, ["spell", "disable"].join(":")],
      refused,
    ),
    rejected(
      "joined inline prefix is forbidden",
      [SpellingConfiguration, ["spell", "checker", ":disable"].join("")],
      refused,
    ),
    rejected(
      "double colon directive is forbidden",
      [SpellingConfiguration, ["cspell", "disable"].join("::")],
      refused,
    ),
    rejected(
      "local dictionary directive is forbidden",
      [SpellingConfiguration, [["Local", "Words"].join(""), "ordinary"].join(":")],
      refused,
    ),
    rejected(
      "local dictionary without colon is forbidden",
      [SpellingConfiguration, ["Local", "Words ordinary"].join("")],
      refused,
    ),
    rejected(
      "oversized source cannot be silently skipped",
      [SpellingConfiguration, "", true],
      refused,
    ),
    rejected(
      "oversized configuration fails before parsing",
      ["a".repeat(SpellingPolicy.MaximumBytes)],
      refused,
    ),
    rejected(
      "command file count cannot exceed its bound",
      [SpellingConfiguration, "", false, 0, { batch_files: SpellingPolicy.MaximumFiles + 1 }],
      refused,
    ),
    rejected(
      "command byte count cannot exceed its bound",
      [SpellingConfiguration, "", false, 0, { batch_bytes: SpellingPolicy.BatchBytes + 1 }],
      refused,
    ),
    rejected(
      "source larger than its batch is refused before execution",
      [SpellingConfiguration, "", false, 0, { batch_bytes: 1 }],
      refused,
    ),
    rejected(
      "empty command budgets are refused",
      [SpellingConfiguration, "", false, 0, { batch_files: 0 }],
      refused,
    ),
    rejected(
      "unknown command budgets are refused",
      [SpellingConfiguration, "", false, 0, { files: 2 }],
      refused,
    ),
  ],
};

export const spellingBatchCases = {
  positive: [
    positive("every file is checked across three bounded commands", [5, { batch_files: 2 }], {
      code: 0,
      calls: 3,
      files: 6,
    }),
    positive(
      "input bytes split commands before their ceiling",
      [2, { batch_bytes: 8192 }, 0, 6000],
      { code: 0, calls: 3, files: 3 },
    ),
  ],
  negative: [
    rejected("first unsuccessful command stops verification", [5, { batch_files: 2 }, 1], {
      code: 7,
      calls: 1,
      files: 2,
    }),
    rejected("later unsuccessful command cannot be hidden", [5, { batch_files: 2 }, 2], {
      code: 7,
      calls: 2,
      files: 4,
    }),
  ],
};
