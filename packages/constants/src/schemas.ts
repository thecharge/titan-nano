export const DataSchemaRule = {
  Glob: "packages/types/src/**/*.{ts,tsx,mts,cts}",
  MaximumFiles: 256,
  MaximumBytes: 67_108_864,
  MaximumDeclarations: 8192,
  MaximumDepth: 128,
  Inferred: ["z.infer", "z.input", "z.output"],
  Executable: [
    "Function",
    "Promise",
    "PromiseLike",
    "Generator",
    "AsyncGenerator",
    "AsyncIterable",
  ],
  Anonymous: "anonymous",
  MemberSeparator: ".",
  Default: "default",
  DeclarationPattern: /\.d(\.[cm]?ts)$/,
  DeclarationReplacement: "$1",
  KeySeparator: ":",
} as const;

export enum OwnedDataShape {
  Traversal = "traversal",
  RequestInventory = "request-inventory",
  RequestListRun = "request-list-run",
  PhaseTurn = "phase-turn",
  CommandResult = "command-result",
  CommandPositional = "command-positional",
}
