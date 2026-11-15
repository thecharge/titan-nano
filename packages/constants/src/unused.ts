import { DocumentationFormat } from "./formatting.ts";
import { HookCommitMessageCommand, HookPreset, HookSecretCommand } from "./hooks.ts";
import { SpellingCommand } from "./spelling.ts";

export const UnusedPolicy = { File: "knip.json" } as const;
export enum UnusedWorkspace {
  Root = ".",
  Apps = "apps/*",
}
const rootWorkspace = {
  entry: [
    "tooling/scripts/inside-offline.ts",
    "tooling/scripts/probe-package.ts",
    "tooling/scripts/bootstrap-install.ts",
  ],
  project: ["tooling/scripts/**/*.{ts,tsx,mts,cts}"],
  ignoreDependencies: [
    "@commitlint/cli",
    "@dprint/dockerfile",
    "@dprint/markdown",
    "@dprint/toml",
    "@secretlint/secretlint-rule-preset-recommend",
    "cspell",
    "dprint-plugin-yaml",
    "secretlint",
  ],
} as const;
const sourceWorkspace = { project: ["src/**/*.{ts,tsx,mts,cts}"] } as const;
const testingWorkspace = {
  entry: ["**/*{.test,_test,.spec,_spec}.{ts,tsx,js,jsx,mjs,cjs,mts,cts}", "fixtures/**/*.mjs"],
  project: ["**/*.{ts,tsx,mts,cts}", "fixtures/**/*.mjs"],
} as const;
const workspaces = {
  ".": rootWorkspace,
  "apps/*": sourceWorkspace,
  "packages/*": sourceWorkspace,
  testing: testingWorkspace,
  "testing/packages/*": sourceWorkspace,
} as const;
export const UnusedConfiguration = { workspaces } as const;

export const UnusedToolBindings = [
  {
    dependency: "@commitlint/cli",
    used: HookCommitMessageCommand.some((part) => part === "commitlint"),
  },
  {
    dependency: "@dprint/dockerfile",
    used: DocumentationFormat.Plugins.some(
      (part) => part === "./node_modules/@dprint/dockerfile/plugin.wasm",
    ),
  },
  {
    dependency: "@dprint/markdown",
    used: DocumentationFormat.Plugins.some(
      (part) => part === "./node_modules/@dprint/markdown/plugin.wasm",
    ),
  },
  {
    dependency: "@dprint/toml",
    used: DocumentationFormat.Plugins.some(
      (part) => part === "./node_modules/@dprint/toml/plugin.wasm",
    ),
  },
  {
    dependency: "@secretlint/secretlint-rule-preset-recommend",
    used: HookPreset.Secrets === "@secretlint/secretlint-rule-preset-recommend",
  },
  {
    dependency: "cspell",
    used: SpellingCommand.some((part) => part === "./node_modules/cspell/bin.mjs"),
  },
  {
    dependency: "dprint-plugin-yaml",
    used: DocumentationFormat.Plugins.some(
      (part) => part === "./node_modules/dprint-plugin-yaml/plugin.wasm",
    ),
  },
  { dependency: "secretlint", used: HookSecretCommand.some((part) => part === "secretlint") },
] as const;

export const UnusedCommand = [
  "bun",
  "--no-install",
  "./node_modules/knip/bin/knip-bun.js",
  "--config",
  UnusedPolicy.File,
  "--no-gitignore",
  "--no-progress",
  "--treat-config-hints-as-errors",
] as const;

export enum UnusedFixture {
  Plain = "plain",
  Used = "used",
  File = "file",
  Dependency = "dependency",
  Export = "export",
  Import = "import",
  Duplicate = "duplicate",
  Ignored = "ignored",
}
