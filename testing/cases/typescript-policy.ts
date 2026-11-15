import { TypeScriptPolicy, TypeScriptProject } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const rootTypeScriptFixture = {
  compilerOptions: {
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
  },
  include: ["apps/**/*", "packages/**/*", "testing/**/*", "tooling/scripts/*"],
};
export const rootTypeScriptPolicyCases = {
  positive: [
    positive("root enables all required strict settings", [rootTypeScriptFixture], true),
    positive(
      "explicit strict flags remain enabled",
      [
        {
          ...rootTypeScriptFixture,
          compilerOptions: {
            ...rootTypeScriptFixture.compilerOptions,
            strictNullChecks: true,
            noCheck: false,
          },
        },
      ],
      true,
    ),
  ],
  negative: [
    rejected(
      "root cannot omit product sources",
      [{ ...rootTypeScriptFixture, include: ["testing/**/*.ts"] }],
      false,
    ),
    rejected(
      "duplicate patterns cannot hide omitted sources",
      [{ ...rootTypeScriptFixture, include: Array(4).fill("testing/**/*.ts") }],
      false,
    ),
    rejected(
      "root cannot exclude files from its source patterns",
      [{ ...rootTypeScriptFixture, exclude: ["packages/**"] }],
      false,
    ),
    ...TypeScriptPolicy.StrictOptions.map((option) =>
      rejected(
        `root cannot disable ${option}`,
        [
          {
            ...rootTypeScriptFixture,
            compilerOptions: { ...rootTypeScriptFixture.compilerOptions, [option]: false },
          },
        ],
        false,
      ),
    ),
    rejected(
      "root cannot disable strict mode",
      [
        {
          ...rootTypeScriptFixture,
          compilerOptions: { ...rootTypeScriptFixture.compilerOptions, strict: false },
        },
      ],
      false,
    ),
    rejected(
      "root cannot disable indexed access checks",
      [
        {
          ...rootTypeScriptFixture,
          compilerOptions: {
            ...rootTypeScriptFixture.compilerOptions,
            noUncheckedIndexedAccess: false,
          },
        },
      ],
      false,
    ),
    rejected(
      "root cannot disable exact optional properties",
      [
        {
          ...rootTypeScriptFixture,
          compilerOptions: {
            ...rootTypeScriptFixture.compilerOptions,
            exactOptionalPropertyTypes: false,
          },
        },
      ],
      false,
    ),
    rejected(
      "strict mode cannot hide disabled null checks",
      [
        {
          ...rootTypeScriptFixture,
          compilerOptions: { ...rootTypeScriptFixture.compilerOptions, strictNullChecks: false },
        },
      ],
      false,
    ),
    rejected(
      "noCheck cannot bypass all checks",
      [
        {
          ...rootTypeScriptFixture,
          compilerOptions: { ...rootTypeScriptFixture.compilerOptions, noCheck: true },
        },
      ],
      false,
    ),
    rejected(
      "an external parent cannot weaken implicit flags",
      [{ ...rootTypeScriptFixture, extends: "external.json" }],
      false,
    ),
  ],
};
export const packageTypeScriptFixture = {
  extends: "../../tsconfig.json",
  include: ["src/**/*"],
};
export const packageTypeScriptPolicyCases = {
  positive: [
    positive(
      "package inherits the exact root",
      [packageTypeScriptFixture, "../../tsconfig.json"],
      true,
    ),
    positive(
      "package may explicitly retain strict settings",
      [
        {
          ...packageTypeScriptFixture,
          compilerOptions: {
            strict: true,
            noUncheckedIndexedAccess: true,
            exactOptionalPropertyTypes: true,
          },
        },
        "../../tsconfig.json",
      ],
      true,
    ),
  ],
  negative: [
    ...["src/**/*.ts", "no-source/**/*.ts", "README.md", "**/*"].map((pattern) =>
      rejected(
        `package cannot hide sources with ${pattern}`,
        [{ ...packageTypeScriptFixture, include: [pattern] }, "../../tsconfig.json"],
        false,
      ),
    ),
    rejected(
      "duplicate package source patterns are refused",
      [{ ...packageTypeScriptFixture, include: ["src/**/*", "src/**/*"] }, "../../tsconfig.json"],
      false,
    ),
    ...TypeScriptPolicy.StrictOptions.map((option) =>
      rejected(
        `package cannot disable ${option}`,
        [
          { ...packageTypeScriptFixture, compilerOptions: { [option]: false } },
          "../../tsconfig.json",
        ],
        false,
      ),
    ),
    rejected(
      "package cannot turn strict off",
      [{ ...packageTypeScriptFixture, compilerOptions: { strict: false } }, "../../tsconfig.json"],
      false,
    ),
    rejected(
      "package cannot turn one inherited flag off",
      [
        { ...packageTypeScriptFixture, compilerOptions: { noImplicitAny: false } },
        "../../tsconfig.json",
      ],
      false,
    ),
    rejected(
      "foreign parent is refused",
      [{ ...packageTypeScriptFixture, extends: "../other.json" }, "../../tsconfig.json"],
      false,
    ),
    rejected(
      "missing parent is refused",
      [{ include: ["src/**/*"] }, "../../tsconfig.json"],
      false,
    ),
    rejected(
      "package cannot bypass typechecking",
      [{ ...packageTypeScriptFixture, compilerOptions: { noCheck: true } }, "../../tsconfig.json"],
      false,
    ),
    rejected(
      "unknown package fields cannot redirect compilation",
      [{ ...packageTypeScriptFixture, references: [] }, "../../tsconfig.json"],
      false,
    ),
  ],
};

export const typeScriptWorkspaceCases = {
  positive: [
    positive(
      "declared package inherits root checks",
      [rootTypeScriptFixture, packageTypeScriptFixture],
      1,
    ),
    positive(
      "explicit strict package retains checks",
      [rootTypeScriptFixture, { ...packageTypeScriptFixture, compilerOptions: { strict: true } }],
      1,
    ),
  ],
  negative: [
    negative(
      "unmatched workspace glob cannot hide a missing package",
      [rootTypeScriptFixture, packageTypeScriptFixture, ["missing/*"]],
      { name: "Error" },
    ),
    negative(
      "workspace pattern cannot escape the repository",
      [rootTypeScriptFixture, packageTypeScriptFixture, ["../outside/*"]],
      { name: "ZodError" },
    ),
    negative(
      "disabled root checks fail workspace verification",
      [{ ...rootTypeScriptFixture, compilerOptions: { strict: false } }, packageTypeScriptFixture],
      { name: "Error" },
    ),
    negative(
      "disabled package checks fail workspace verification",
      [
        rootTypeScriptFixture,
        { ...packageTypeScriptFixture, compilerOptions: { noUncheckedIndexedAccess: false } },
      ],
      { name: "Error" },
    ),
    negative("missing package config fails closed", [rootTypeScriptFixture, null], {
      code: "ENOENT",
    }),
    negative(
      "foreign parent fails workspace verification",
      [rootTypeScriptFixture, { ...packageTypeScriptFixture, extends: "../foreign.json" }],
      { name: "Error" },
    ),
  ],
};
export const typeScriptCompilationCases = {
  positive: [
    positive(
      "indexed read handles an absent element",
      ["const values: number[] = []; const value: number = values[0] ?? 0; export { value };"],
      true,
    ),
    positive(
      "optional property may be absent",
      ["const value: {label?: string} = {}; export { value };"],
      true,
    ),
  ],
  negative: [
    rejected(
      "unchecked indexed read fails actual compilation",
      ["const values: number[] = []; const value: number = values[0]; export { value };", 2322],
      false,
    ),
    rejected(
      "explicit undefined is not an absent optional property",
      ["const value: {label?: string} = { label: undefined }; export { value };", 2375],
      false,
    ),
  ],
};

export const typeScriptWorkspaceCapacityCases = {
  positive: [
    positive("one declared workspace remains valid", [1], 1),
    positive("all 256 configured workspaces are checked", [256], 256),
  ],
  negative: [
    negative("workspace 257 exceeds the inspection budget", [257], { name: "Error" }),
    negative("a larger workspace inventory also fails closed", [258], { name: "Error" }),
  ],
};

export const typeScriptSourceScopeCases = {
  positive: Object.values(TypeScriptProject).flatMap((project) =>
    TypeScriptPolicy.SourceExtensions.flatMap((extension) => [
      positive(
        `${project} checks a valid string in ${extension}`,
        ["const scopeValue: string = 'ready';", undefined, extension, project],
        true,
      ),
      positive(
        `${project} checks a valid number in ${extension}`,
        ["const scopeValue: number = 1;", undefined, extension, project],
        true,
      ),
    ]),
  ),
  negative: Object.values(TypeScriptProject).flatMap((project) =>
    TypeScriptPolicy.SourceExtensions.flatMap((extension) => [
      rejected(
        `${project} refuses number assigned to string in ${extension}`,
        ["const scopeValue: string = 1;", 2322, extension, project],
        false,
      ),
      rejected(
        `${project} refuses string assigned to number in ${extension}`,
        ["const scopeValue: number = 'wrong';", 2322, extension, project],
        false,
      ),
    ]),
  ),
};
export const typeScriptTestingScopeCases = {
  positive: [
    positive(
      "testing root includes its complete tree",
      [{ extends: "../tsconfig.json", include: ["**/*"] }],
      2,
    ),
    positive(
      "testing root may retain strict explicitly",
      [{ extends: "../tsconfig.json", include: ["**/*"], compilerOptions: { strict: true } }],
      2,
    ),
  ],
  negative: [
    negative(
      "testing root cannot hide cases outside src",
      [{ extends: "../tsconfig.json", include: ["src/**/*"] }],
      { name: "Error" },
    ),
    negative(
      "testing root cannot narrow to TS",
      [{ extends: "../tsconfig.json", include: ["**/*.ts"] }],
      { name: "Error" },
    ),
  ],
};
