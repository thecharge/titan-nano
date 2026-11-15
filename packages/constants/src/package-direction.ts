import { TitanPackage } from "./development.ts";
import { VendorPackage } from "./packaging.ts";

export const PackageArchitecture = {
  Scope: "@titan/",
  WorkspacePatterns: ["apps/*", "packages/*", "testing", "testing/packages/*"],
  TestDirectory: "testing",
  TestDirectoryPrefix: "testing/",
  AdapterPrefixes: ["@titan/backend-", "@titan/embedder-"],
  Foundation: [
    TitanPackage.Constants,
    TitanPackage.Types,
    TitanPackage.Errors,
    TitanPackage.Messages,
  ],
  Runtime: "@titan/runtime",
  ProductDirectory: "packages",
  NamedWorkspaces: {
    "@titan/runtime": "packages/runtime",
    "@titan/cli": "apps/cli",
    "@titan/test-framework": "testing/packages/framework",
    "@titan/test-factories": "testing/packages/factories",
    "@titan/testing": "testing",
    "titan-workspace": ".",
  },
  TestPrefixes: ["@titan/test-"],
  TestAggregation: "@titan/testing",
  TestOrder: ["@titan/test-framework", "@titan/test-factories", "@titan/testing"],
  AdapterVendors: {
    [TitanPackage.Codex]: [VendorPackage.Codex, VendorPackage.CodexCli],
    [TitanPackage.Claude]: [VendorPackage.Claude],
    [TitanPackage.EmbedderLocal]: [VendorPackage.Transformers],
  },
} as const;

export enum PackageLayer {
  Product = "product",
  Test = "test",
}
