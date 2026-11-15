export const VerificationMessage = {
  BoundaryBudget:
    "Package boundary inventory exceeded its byte or entry budget; no successful verification is recorded.",
  DuplicatePackage: "Workspace package names must be unique",
  PublicContract: "Package needs public exports or an executable",
  PodmanRequired: "Install rootless Podman; see docs/preview.md",
  BoundaryRequired: "Use bun run test; the OS network boundary is required",
  ExternalInterface: "Offline boundary exposes a non-loopback interface",
  MissingLoopback: "Boundary has no loopback",
  ExternalConnection: "Boundary allowed an external connection",
  PackageOutputTimeout: "Package asset generation exceeded its time budget",
  PackageOutputFailed: "Package asset generation failed",
  ServerNotReady: "Installed server did not become ready",
} as const;
export const boundaryFinding = (name: string, file: string, rule: string, detail: string): string =>
  `${name}/${file}: ${rule}: ${detail}`;
export const boundarySummary = (workspaces: number, findings: number): string =>
  `Package boundaries: ${workspaces} workspaces, ${findings} findings`;
export const pendingScenarios = (pending: number): string =>
  `Acceptance map checked; ${pending} scenarios pending. This is not a full release gate pass.`;
export const packageCheckFailure = (args: string[]): string =>
  `Package check failed: ${args.join(" ")}`;
export const packageCommandFailure = (args: string[], error: string): string =>
  `${args.join(" ")}: ${error}`;
export const serverExited = (error: string): string => `Server exited: ${error}`;

export const promiseViolation = (file: string, line: number): string =>
  `${file}:${line}: unbounded Promise aggregation; use lazy tasks with all or settle from @titan/core`;

export const asyncFileSystemViolation = (file: string, line: number): string =>
  `${file}:${line}: synchronous or opaque filesystem access; use explicit async imports or named stream APIs`;

export const invalidTypeScriptPolicy = (path: string): string =>
  `${path}: TypeScript settings must retain root strictness and the canonical root inheritance`;
export const typeScriptPolicySummary = (count: number): string =>
  `TypeScript policy checked root and ${count} workspace configurations`;

export const invalidLintPolicy =
  "Lint policy must retain ownership plugins, complete source scopes, project analysis, promise checks and import-cycle checks";
export const lintPolicySummary = "Lint policy and source ownership scopes verified";

export const dataSchemaReadLimit = "Type schema inventory is missing or exceeds its read allowance";
export const dataSchemasSummary = "Type data shapes checked against schema ownership";
export const invalidDataSource = (file: string) => `Invalid type source: ${file}`;
export const dataSchemaViolation = (file: string, line: number, name: string) =>
  `${file}:${line} ${name}: data shape requires a Zod schema`;

export const flatTestReadLimit = "Test inventory is missing or exceeds its read allowance";
export const invalidTestSource = (file: string) => `Invalid test source: ${file}`;
export const flatTestViolation = (file: string, line: number) =>
  `${file}:${line}: move test control flow into shared factories and use flat case tables`;

export const testProcessActionFailure = "Test child action failed";

export const packagePolicySummary = (workspaces: number, findings: number): string =>
  `Package policy: ${workspaces} workspaces, ${findings} findings`;

export const testLayoutViolation = (file: string) =>
  `${file}: keep tests in testing/unit, testing/integration or testing/e2e and test helpers under testing`;
