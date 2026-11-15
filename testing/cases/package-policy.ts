import { BoundaryRule, ErrorCode, PackageArchitecture } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const packagePolicyCases = {
  positive: [
    positive("canonical workspace metadata remains valid", [{}], { code: 0, findings: 0 }),
    positive(
      "test factories can declare framework support",
      [
        {
          "testing/packages/factories/package.json": {
            name: "@titan/test-factories",
            dependencies: { "@titan/test-framework": "workspace:*" },
          },
        },
      ],
      { code: 0, findings: 0 },
    ),
    positive(
      "runtime may declare its concrete adapter",
      [
        {
          "packages/runtime/package.json": {
            name: "@titan/runtime",
            dependencies: { "@titan/backend-claude": "workspace:*" },
          },
        },
      ],
      { code: 0, findings: 0 },
    ),
    positive(
      "root tools may use product libraries for checks",
      [
        {
          "package.json": {
            name: "titan-workspace",
            workspaces: { packages: [...PackageArchitecture.WorkspacePatterns] },
            devDependencies: { "@titan/core": "workspace:*" },
          },
        },
      ],
      { code: 0, findings: 0 },
    ),
  ],
  negative: [
    ...["dependencies", "devDependencies"].map((field) =>
      rejected(
        `runner cannot declare test factories in ${field}`,
        [
          {
            "packages/runner/package.json": {
              name: "@titan/runner",
              [field]: { "@titan/test-factories": "workspace:*" },
            },
          },
          BoundaryRule.TestDirection,
        ],
        { code: 1, findings: 1 },
      ),
    ),
    ...["dependencies", "devDependencies"].map((field) =>
      rejected(
        `runner cannot declare a native vendor SDK in ${field}`,
        [
          {
            "packages/runner/package.json": {
              name: "@titan/runner",
              [field]: { "@anthropic-ai/claude-agent-sdk": "catalog:" },
            },
          },
          BoundaryRule.VendorIsolation,
        ],
        { code: 1, findings: 1 },
      ),
    ),
    negative("missing root metadata fails without replacement", [{ "package.json": null }], {
      code: "ENOENT",
    }),
    ...["dependencies", "devDependencies"].map((field) =>
      rejected(
        `runner cannot declare Claude in ${field}`,
        [
          {
            "packages/runner/package.json": {
              name: "@titan/runner",
              [field]: { "@titan/backend-claude": "workspace:*" },
            },
          },
          BoundaryRule.AdapterComposition,
        ],
        { code: 1, findings: 1 },
      ),
    ),
    rejected(
      "framework cannot acquire an upward test dependency",
      [
        {
          "testing/packages/framework/package.json": {
            name: "@titan/test-framework",
            dependencies: { "@titan/test-factories": "workspace:*" },
          },
        },
        BoundaryRule.TestDirection,
      ],
      { code: 1, findings: 1 },
    ),
    rejected(
      "factories cannot depend on aggregation",
      [
        {
          "testing/packages/factories/package.json": {
            name: "@titan/test-factories",
            dependencies: { "@titan/testing": "workspace:*" },
          },
        },
        BoundaryRule.TestDirection,
      ],
      { code: 1, findings: 1 },
    ),
    rejected(
      "product cannot gain adapter ownership by renaming",
      [
        { "packages/runner/package.json": { name: "@titan/backend-claude" } },
        BoundaryRule.PackageIdentity,
      ],
      { code: 1, findings: 1 },
    ),
    rejected(
      "product cannot gain runtime ownership by renaming",
      [
        { "packages/runner/package.json": { name: "@titan/runtime" } },
        BoundaryRule.PackageIdentity,
      ],
      { code: 1, findings: 1 },
    ),
    rejected(
      "missing runtime workspace dependency fails",
      [
        {
          "packages/runner/package.json": {
            name: "@titan/runner",
            dependencies: { "@titan/missing": "workspace:*" },
          },
        },
        BoundaryRule.MissingWorkspace,
      ],
      { code: 1, findings: 1 },
    ),
    rejected(
      "missing development workspace dependency fails",
      [
        {
          "packages/runner/package.json": {
            name: "@titan/runner",
            devDependencies: { "@titan/missing": "workspace:*" },
          },
        },
        BoundaryRule.MissingWorkspace,
      ],
      { code: 1, findings: 1 },
    ),
    negative(
      "root cannot remove testing workspace patterns",
      [{ "package.json": { name: "titan-workspace", workspaces: { packages: ["packages/*"] } } }],
      { name: "ZodError" },
    ),
    negative(
      "root cannot invent replacement workspace patterns",
      [
        {
          "package.json": {
            name: "titan-workspace",
            workspaces: { packages: ["apps/*", "packages/*", "missing", "testing/packages/*"] },
          },
        },
      ],
      { name: "ZodError" },
    ),
    negative("invalid limits cannot skip inspection", [{}, undefined, { max_workspaces: 0 }], {
      name: "ZodError",
    }),
    negative(
      "inventory exhaustion cannot skip workspaces",
      [{}, undefined, { max_workspaces: 2 }],
      { code: ErrorCode.VerificationBudget },
    ),
  ],
};
