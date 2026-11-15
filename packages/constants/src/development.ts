import { TestConcurrencyArguments } from "./testing.ts";

export const Development = {
  SourceGlob: "src/**/*.{ts,tsx,mts,cts}",
  Apps: "apps",
  Packages: "packages",
  SourceFile: "source.ts",
  Require: "require",
  NodePrefix: "node:",
  BunPrefix: "bun:",
  Workspace: "workspace",
  Scope: "@",
  DependencyCycleSeparator: " -> ",
  Python: "python3",
  IsolatedPython: "-I",
  PlainCheck: "tooling/scripts/check-plain.py",
  SpecCheck: "tooling/scripts/check-specs.py",
  Specs: "openspec",
  Docs: "docs",
  CodexSkills: ".agents/skills",
  ClaudeSkills: ".titan/plugin/skills",
  AcceptanceMap: "openspec/changes/resilient-agent-blackboard-bun/research/acceptance-map.tsv",
  RepairAcceptanceMap: "openspec/changes/repair-harness-delivery/research/acceptance-map.tsv",
  PendingSuffix: "\tpending",
  ReleaseFlag: "--release",
  BoundaryVariable: "TITAN_TEST_BOUNDARY",
  LoopbackResponse: "loopback",
  ExternalProbe: "http://1.1.1.1",
  CoverageCheck: "tooling/scripts/check-coverage.ts",
} as const;
export const TestCoverageArguments = [
  "test",
  ...TestConcurrencyArguments,
  "--timeout",
  String(60000),
  "--coverage",
  "--coverage-reporter=lcov",
] as const;
export enum BoundaryRule {
  DuplicatePackage = "duplicate-package",
  MissingWorkspace = "missing-workspace",
  CoreDirection = "core-direction",
  AdapterDirection = "adapter-direction",
  AdapterComposition = "adapter-composition",
  TestDirection = "test-direction",
  PackageIdentity = "package-identity",
  PublicContract = "public-contract",
  MissingExport = "missing-export",
  CrossPackagePath = "cross-package-path",
  VendorIsolation = "vendor-isolation",
  UndeclaredImport = "undeclared-import",
  PrivateExport = "private-export",
  DependencyCycle = "dependency-cycle",
}
export enum TitanPackage {
  Core = "@titan/core",
  Constants = "@titan/constants",
  Types = "@titan/types",
  Errors = "@titan/errors",
  Messages = "@titan/messages",
  Codex = "@titan/backend-codex",
  Claude = "@titan/backend-claude",
  EmbedderLocal = "@titan/embedder-local",
}

export const PromiseRule = {
  Object: "Promise",
  Methods: ["all", "allSettled"],
} as const;

export const OwnedSource = {
  Roots: ["apps", "packages", "testing", "tooling/scripts"],
  Sources: "**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}",
  Excluded: ["**/node_modules/**", "**/dist/**", "**/coverage/**"],
  MaximumSourceBytes: 1_048_576,
} as const;

export const AsyncFileSystemRule = {
  Modules: ["node:fs", "fs"],
  SynchronousSuffix: "Sync",
  Loaders: ["require", "getBuiltinModule"],
} as const;

export const BoundaryReadLimit = {
  ManifestBytes: 1_048_576,
  SourceBytes: 1_048_576,
  TotalBytes: 64 * 1_048_576,
  Workspaces: 256,
  Sources: 16_384,
} as const;
