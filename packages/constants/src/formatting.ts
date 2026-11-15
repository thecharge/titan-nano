export const DocumentationFormat = {
  File: "dprint.json",
  LineWidth: 100,
  Newline: "lf",
  TextWrap: "never",
  ContainerAssociations: ["**/Containerfile", "**/Dockerfile"],
  UnformattedExitCode: 20,
  Plugins: [
    "./node_modules/@dprint/markdown/plugin.wasm",
    "./node_modules/@dprint/toml/plugin.wasm",
    "./node_modules/@dprint/dockerfile/plugin.wasm",
    "./node_modules/dprint-plugin-yaml/plugin.wasm",
  ],
  Includes: ["**/*.{md,toml,yaml,yml}", "**/Containerfile", "**/Dockerfile"],
  Excludes: [
    "**/node_modules",
    "**/dist",
    "**/coverage",
    ".git/**",
    ".agent/**",
    ".agents/**",
    ".claude/**",
    ".codex/**",
    ".titan/**",
    "openspec/changes/*/research/probes/**",
    "openspec/changes/*/research/sources/**",
  ],
} as const;

export const DocumentationFormatConfiguration = {
  lineWidth: DocumentationFormat.LineWidth,
  newLineKind: DocumentationFormat.Newline,
  markdown: { textWrap: DocumentationFormat.TextWrap, "codeBlock.skipFormat": true },
  dockerfile: { associations: [...DocumentationFormat.ContainerAssociations] },
  includes: [...DocumentationFormat.Includes],
  excludes: [...DocumentationFormat.Excludes],
  plugins: [...DocumentationFormat.Plugins],
} as const;

export const DocumentationFormatCommand = [
  "bun",
  "x",
  "--no-install",
  "dprint",
  "check",
  "--config",
  DocumentationFormat.File,
  "--config-discovery=false",
  "--incremental=false",
  "--no-gitignore",
] as const;
