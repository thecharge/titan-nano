import { OwnedSource, SourceCommentFixture, SourceCommentLimit } from "@titan/constants";
import { sourceCommentReadLimit, sourceCommentViolation } from "@titan/messages";
import { negative, positive, rejected } from "@titan/test-factories";

export const sourceCommentSyntaxCases = {
  positive: [
    positive("quoted markers are reference text", ['const text = "/* note */ // note";'], []),
    positive("template text remains reference data", ["const text = `// note /* note */`;"], []),
    positive(
      "regular expression slashes remain syntax",
      ["const pattern = /https?:\\/\\/[a-z]+/;"],
      [],
    ),
    positive(
      "executable shebang remains available",
      ["#!/usr/bin/env bun\nexport const value = 1;"],
      [],
    ),
    positive(
      "JSX text and attributes are not comments",
      ['const view = <div title="// text">/* text */</div>;', "view.tsx"],
      [],
    ),
    positive(
      "ordinary source needs no exemption",
      ["export const value = { one: { two: true } };"],
      [],
    ),
  ],
  negative: [
    rejected("line comment is refused", ["export const value = 1; // rationale"], [1]),
    rejected(
      "documentation comment is refused",
      ["/** rationale */\nexport const value = 1;"],
      [1],
    ),
    rejected("comment inside empty arguments is refused", ["run(/* rationale */);"], [1]),
    rejected(
      "comment inside template expression is refused",
      [["const value = `", "{ /* rationale */ name }`;"].join("$")],
      [1],
    ),
    rejected(
      "JSX expression comment is refused",
      ["const view = <div>{/* rationale */}</div>;", "view.tsx"],
      [1],
    ),
    rejected(
      "trailing standalone comment is refused",
      ["export const value = 1;\n// rationale"],
      [2],
    ),
    rejected(
      "separate source lines retain exact diagnostics",
      ["// first\nconst one = 1;\n/* second */\nconst two = 2;"],
      [1, 3],
    ),
    negative(
      "oversized source is refused before parsing",
      ["a".repeat(OwnedSource.MaximumSourceBytes + 1)],
      { message: sourceCommentReadLimit },
    ),
    negative(
      "excessive diagnostics are refused",
      ["// rationale\n".repeat(SourceCommentLimit.Findings + 1)],
      { message: sourceCommentReadLimit },
    ),
  ],
};

export const sourceCommentTreeCases = {
  positive: [
    positive(
      "maintained app is checked without writes",
      [{ "apps/cli/src/main.ts": "export const value = 1;" }],
      { code: 0, findings: [] },
    ),
    positive(
      "dependency and generated sources stay outside ownership",
      [
        {
          "packages/core/src/index.ts": "export const value = 1;",
          "packages/core/node_modules/vendor/index.ts": "// dependency",
          "apps/cli/dist/main.js": "// generated",
        },
      ],
      { code: 0, findings: [] },
    ),
  ],
  negative: [
    rejected("tooling comments are reported", [{ "tooling/scripts/subject.ts": "// rationale" }], {
      code: 1,
      findings: [sourceCommentViolation("tooling/scripts/subject.ts", 1)],
    }),
    rejected(
      "vendor fixture comments are reported",
      [{ "testing/fixtures/vendor.mjs": "/* rationale */" }],
      { code: 1, findings: [sourceCommentViolation("testing/fixtures/vendor.mjs", 1)] },
    ),
    negative("empty source discovery cannot pass", [{}], { message: sourceCommentReadLimit }),
    negative(
      "inventory file budget is enforced",
      [{ "packages/core/src/one.ts": "", "packages/core/src/two.ts": "" }, { max_files: 1 }],
      { message: sourceCommentReadLimit },
    ),
    negative(
      "inventory byte budget is enforced",
      [{ "packages/core/src/one.ts": "export const value = 1;" }, { total_bytes: 1 }],
      { message: sourceCommentReadLimit },
    ),
    negative(
      "diagnostic budget is enforced",
      [{ "packages/core/src/one.ts": "// one\n// two" }, { max_findings: 1 }],
      { message: sourceCommentReadLimit },
    ),
    negative(
      "larger limits cannot bypass admission",
      [{ "packages/core/src/one.ts": "" }, { max_files: SourceCommentLimit.Files + 1 }],
      { name: "ZodError" },
    ),
    negative(
      "unknown limit fields cannot bypass admission",
      [{ "packages/core/src/one.ts": "" }, { ignored: true }],
      { name: "ZodError" },
    ),
  ],
};

export const sourceCommentDiscoveryCases = {
  positive: OwnedSource.Roots.flatMap((root) =>
    SourceCommentFixture.Suffixes.map((suffix) =>
      positive(
        `unchanged ${root} ${suffix} source is checked`,
        [`${root}/subject.${suffix}`, false],
        { code: 0, findings: [] },
      ),
    ),
  ),
  negative: OwnedSource.Roots.flatMap((root) =>
    SourceCommentFixture.Suffixes.map((suffix) =>
      rejected(`comment in ${root} ${suffix} cannot hide`, [`${root}/subject.${suffix}`, true], {
        code: 1,
        findings: [sourceCommentViolation(`${root}/subject.${suffix}`, 1)],
      }),
    ),
  ),
};
