import { BoundaryReadLimit, ErrorCode, ReadmeFinding } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const readmeFixture =
  "# @fixture/package\n\n## Responsibilities\n\nOwns the test contract.\n\n## Public contract\n\nExports a fixture.\n\n## Verification\n\nRuns offline cases.\n\n## Limits\n\nNo runtime API.\n";

export const readmeCases = {
  positive: [
    positive("package name and documented contract", ["@fixture/package", readmeFixture], []),
    positive(
      "additional sections are allowed",
      ["@fixture/package", `${readmeFixture}\n## Architecture\n\nA fixture only.\n`],
      [],
    ),
  ],
  negative: [
    rejected("wrong package title", ["@fixture/other", readmeFixture], [ReadmeFinding.Title]),
    rejected(
      "missing public contract",
      ["@fixture/package", readmeFixture.replace("## Public contract", "## Internal notes")],
      [ReadmeFinding.Sections],
    ),
    rejected(
      "empty public contract",
      ["@fixture/package", readmeFixture.replace("Exports a fixture.", "")],
      [ReadmeFinding.EmptySection],
    ),
  ],
};

export const readmeFileCases = {
  positive: [
    positive("workspace README exists", [true, "packages/fixture", "@fixture/package"], []),
    positive("root documentation uses its own contract", [false, ".", "root"], []),
  ],
  negative: [
    negative(
      "README file read is bounded",
      [
        true,
        "packages/fixture",
        "@fixture/package",
        "x".repeat(BoundaryReadLimit.ManifestBytes + 1),
      ],
      { code: ErrorCode.StreamLimit },
    ),
    rejected(
      "missing README fails",
      [false, "packages/fixture", "@fixture/package"],
      [ReadmeFinding.Missing],
    ),
    rejected(
      "copied README with a different package name fails",
      [true, "packages/fixture", "@fixture/other"],
      [ReadmeFinding.Title],
    ),
  ],
};
