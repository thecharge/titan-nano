export enum LcovTag {
  Source = "SF:",
  Line = "DA:",
  FunctionsFound = "FNF:",
  FunctionsHit = "FNH:",
  End = "end_of_record",
}
export enum CoverageRule {
  Missing = "missing_source",
  Lines = "uncovered_lines",
  Functions = "uncovered_functions",
}
export const CoverageFile = "coverage/lcov.info";
export const ProductSourceGlob = "{apps,packages}/*/src/**/*.{ts,tsx,mts,cts}";
export const InvalidCoverageMessage = "Coverage report is malformed or incomplete";

export const TypeScriptPolicy = {
  File: "tsconfig.json",
  MaximumWorkspaces: 256,
  SourcePatterns: ["apps/**/*", "packages/**/*", "testing/**/*", "tooling/scripts/*"],
  PackageSource: "src/**/*",
  TestingSource: "**/*",
  TestingWorkspace: "testing",
  SourceExtensions: ["ts", "tsx", "mts", "cts"],
  WorkspacePattern: /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_*-]+)*$/,
  StrictOptions: [
    "alwaysStrict",
    "strictBindCallApply",
    "strictBuiltinIteratorReturn",
    "strictFunctionTypes",
    "strictNullChecks",
    "strictPropertyInitialization",
    "noImplicitAny",
    "noImplicitThis",
    "useUnknownInCatchVariables",
  ],
} as const;

export enum TypeScriptProject {
  Root = "root",
  Package = "package",
}
