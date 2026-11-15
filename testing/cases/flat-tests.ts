import { ErrorCode, FlatTestRule, OwnedSource } from "@titan/constants";
import { flatTestReadLimit, invalidTestSource } from "@titan/messages";
import { negative, positive, rejected } from "@titan/test-factories";

export const flatTestSyntaxCases = {
  positive: [
    positive(
      "case table keeps registration flat",
      ["test.each([1, 2])('value', value => expect(value).toBeGreaterThan(0));"],
      [],
    ),
    positive("shared factory owns behavior", ["test('result', verifyResult);"], []),
    positive(
      "strings and comments do not become control flow",
      ['const text = "if (true) {}"; // for (;;) {}\ntest("result", verifyResult);'],
      [],
    ),
    positive(
      "object properties may name control keywords",
      ["const value = { if: true, while: false };"],
      [],
    ),
    positive(
      "flat TSX retains its grammar",
      ["test('view', () => expect(<View />).toBeDefined());", "view.test.tsx"],
      [],
    ),
    positive(
      "flat JavaScript remains valid",
      ["test('result', verifyResult);", "subject.test.mjs"],
      [],
    ),
  ],
  negative: [
    rejected(
      "if statements belong in a factory",
      ["test('value', () => { if (ready) check(); });"],
      [1],
    ),
    rejected(
      "for statements belong in a factory",
      ["test('value', () => { for (;;) check(); });"],
      [1],
    ),
    rejected(
      "for-in statements belong in a factory",
      ["test('value', () => { for (const key in value) check(key); });"],
      [1],
    ),
    rejected(
      "for-of statements belong in a factory",
      ["test('value', () => { for (const item of values) check(item); });"],
      [1],
    ),
    rejected(
      "async iteration belongs in a factory",
      ["test('value', async () => { for await (const item of values) check(item); });"],
      [1],
    ),
    rejected(
      "while statements belong in a factory",
      ["test('value', () => { while (ready) check(); });"],
      [1],
    ),
    rejected(
      "do-while statements belong in a factory",
      ["test('value', () => { do { check(); } while (ready); });"],
      [1],
    ),
    rejected(
      "switch statements belong in a factory",
      ["test('value', () => { switch (value) { default: check(); } });"],
      [1],
    ),
    rejected(
      "try and cleanup belong in a factory",
      ["test('value', () => { try { check(); } finally { close(); } });"],
      [1],
    ),
    rejected(
      "named helpers in a test file cannot hide control flow",
      ["function helper() {\n if (ready) check();\n}"],
      [2],
    ),
    rejected(
      "else-if retains both source locations",
      ["if (first) check();\nelse if (second) check();"],
      [1, 2],
    ),
    negative("invalid syntax cannot appear flat", ["test('value', () => { if ( });"], {
      message: invalidTestSource("subject.test.ts"),
    }),
  ],
};

const file = "testing/integration/value.test.ts";
const peer = "testing/unit/peer.test.ts";
const source = "test('result', verifyResult);";
const accepted = { code: 0, findings: 0, unchanged: true };
const refused = { code: 1, findings: 1, unchanged: true };

export const flatTestTreeCases = {
  positive: [
    positive("actual command accepts flat cases", [{ [file]: source }], accepted),
    positive(
      "factories may own control flow",
      [
        {
          [file]: source,
          "testing/factories/value.ts": "export async function result() { if (ready) check(); }",
        },
      ],
      accepted,
    ),
    positive(
      "exact byte and file allowances remain valid",
      [
        { [file]: source, [peer]: source },
        { max_files: 2, total_bytes: Buffer.byteLength(source) * 2 },
      ],
      accepted,
    ),
    positive(
      "module test extensions remain checked",
      [{ "testing/e2e/value.test.mts": source }],
      accepted,
    ),
  ],
  negative: [
    rejected(
      "underscore test files cannot hide control flow",
      [{ [file]: source, "testing/integration/value_test.ts": "if (ready) check();" }],
      refused,
    ),
    rejected(
      "underscore spec files cannot hide control flow",
      [{ [file]: source, "testing/integration/value_spec.ts": "if (ready) check();" }],
      refused,
    ),
    rejected(
      "actual command rejects test control flow",
      [{ [file]: "test('value', () => { if (ready) check(); });" }],
      refused,
    ),
    rejected(
      "spec files cannot hide test control flow",
      [{ [file]: source, "testing/integration/value.spec.ts": "while (ready) check();" }],
      refused,
    ),
    rejected(
      "TSX tests cannot hide control flow",
      [{ [file]: source, "testing/integration/value.test.tsx": "if (ready) render(<View />);" }],
      refused,
    ),
    rejected(
      "JavaScript tests cannot hide control flow",
      [{ [file]: source, "testing/integration/value.test.cjs": "for (;;) check();" }],
      refused,
    ),
    negative("missing test inventory fails", [{}], { message: flatTestReadLimit }),
    negative("invalid test syntax fails", [{ [file]: "test('value', () => { if ( });" }], {
      message: invalidTestSource(file),
    }),
    negative(
      "source read allowance cannot be exceeded",
      [{ [file]: " ".repeat(OwnedSource.MaximumSourceBytes + 1) }],
      { code: ErrorCode.StreamLimit },
    ),
    negative(
      "combined test byte allowance cannot be exceeded",
      [{ [file]: source, [peer]: source }, { total_bytes: Buffer.byteLength(source) * 2 - 1 }],
      { message: flatTestReadLimit },
    ),
    negative(
      "test file allowance cannot be exceeded",
      [{ [file]: source, [peer]: source }, { max_files: 1 }],
      { message: flatTestReadLimit },
    ),
    negative("zero allowances fail", [{ [file]: source }, { max_files: 0 }], { name: "ZodError" }),
    negative(
      "enlarged allowances fail",
      [{ [file]: source }, { total_bytes: FlatTestRule.MaximumBytes + 1 }],
      { name: "ZodError" },
    ),
    negative("unknown allowance keys fail", [{ [file]: source }, { ignore: true }], {
      name: "ZodError",
    }),
  ],
};

export const flatTestDiscoveryCases = {
  positive: [".test", "_test", ".spec", "_spec"].flatMap((suffix) =>
    ["js", "jsx", "ts", "tsx", "mjs", "cjs", "mts", "cts"].map((extension) =>
      positive(
        `pinned Bun discovers value${suffix}.${extension}`,
        [`value${suffix}.${extension}`],
        {
          exitCode: 0,
          checked: true,
        },
      ),
    ),
  ),
  negative: [
    rejected("ordinary helper is not an automatic test", ["helper.ts"], {
      exitCode: 1,
      checked: false,
    }),
    rejected("extended module JSX is not an automatic test", ["value.test.mjsx"], {
      exitCode: 1,
      checked: false,
    }),
    rejected("unsupported extension is not an automatic test", ["value.test.json"], {
      exitCode: 1,
      checked: false,
    }),
  ],
};

export const testLayoutCases = {
  positive: [
    positive("unit tier is discovered", [{ "testing/unit/subject.test.ts": source }], accepted),
    positive(
      "integration tier is discovered",
      [{ "testing/integration/subject_test.mts": source }],
      accepted,
    ),
    positive("e2e tier is discovered", [{ "testing/e2e/subject.spec.cts": source }], accepted),
    positive(
      "central factories remain permitted",
      [{ [file]: source, "testing/factories/subject.ts": "export const value = 1;" }],
      accepted,
    ),
    positive(
      "product testing contracts are ordinary sources",
      [{ [file]: source, "packages/types/src/testing.ts": "export const value = 1;" }],
      accepted,
    ),
  ],
  negative: [
    ...[
      "packages/backend-codex/test/value.test.ts",
      "apps/cli/src/value_spec.cjs",
      "tooling/scripts/value.test.mts",
      "testing/contracts/value.test.ts",
      "testing/unit-extra/value.test.ts",
      "tooling/scripts/fixtures/value.ts",
      "packages/backend-codex/src/testing/helper.ts",
    ].map((path) =>
      rejected(
        `test outside discovered tiers fails: ${path}`,
        [{ [file]: source, [path]: source }],
        refused,
      ),
    ),
    ...["test", "tests", "testing", "fixtures", "factories", "harness", "stubs"].map((directory) =>
      rejected(
        `product test support belongs in testing: ${directory}`,
        [
          {
            [file]: source,
            [`packages/backend-codex/${directory}/helper.ts`]: "export const value = 1;",
          },
        ],
        refused,
      ),
    ),
  ],
};
