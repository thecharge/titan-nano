export const CliDescription = {
  Persona: "Inspect saved persona definitions and quality history",
  PersonaShow: "Inspect saved versions and quality history, newest first",
  Update: "Check or install a release with a verified backup and managed launcher",
  Request: "List scoped requests or inspect exact run and request IDs",
  Answer: "Answer an exact request or pass it to the person with --to-person",
  Approve: "Approve an exact request with the person credential",
  Deny: "Deny an exact request with the person credential",
  Pending: "Not implemented",
  Lessons: "Print the kept lessons, newest first, or only those that contain the given words",
  Plans: "Print the 3 saved plans of a kind with the highest rewards",
  Dashboard: "Print a one-time login link for the read-only dashboard",
  Guide: "Read the agent workflow guide",
  Schema: "Inspect an input schema",
  Install: "Install a project skill",
  Check: "Validate one or more workflow files without execution",
  Run: "Run a validated workflow and watch until it settles. Use --detach for accepted submission",
  Resume: "Continue an existing run",
  Improve: "Run the improve loop for a finished run",
  Backends: "Inspect backend availability",
  Doctor: "Inspect local runtime prerequisites",
  Serve: "Run the local engine",
  Mcp: "Serve the stdio MCP protocol",
  Config: "Inspect resolved settings and their sources",
  ConfigShow: "Inspect scoped or committed run settings with optional setting sources",
  Runs: "List known runs",
  Status: "Inspect an exact run",
  Events: "Read run events",
  Usage: "Inspect committed usage totals and missing reports for an exact run",
  Pause: "Pause an exact run",
  Cancel: "Cancel an exact run",
  Artifacts: "Inspect verified kept delivery files and outputs",
  Artifact: "Read a bounded verified byte page from one kept file",
  ArtifactExport: "Export one verified kept file and its metadata into a new directory",
} as const;

export const CliDiagnostic = {
  BackendConflict: "Use either --backend or --harness for workflow backend selection",
  VersionOptions: "--version accepts only --json",
  CommandRequired: "Choose a command before using command options",
  ParallelLimit: "--max-parallel requires a positive safe integer",
  ArgumentLimit:
    "Command positional arguments must be nonempty and within the supported count limit",
  DryRunWatch: "--dry-run and --watch cannot be combined",
  DryRunDetach: "--dry-run and --detach cannot be combined",
  RunObservation: "--detach and --watch cannot be combined",
  DryRunIdentity: "Submission identities cannot be used with --dry-run",
  RunConfig: "Run submission uses project .titan/config.yaml; config-file override is pending",
  StepLimit: "Plan exceeds max_steps",
  Release: "experimental preview",
  Stub: "stub only",
  LivePending: "experimental; live validation pending",
  NotRun: "not run",
  UnknownError: "error",
  InstallNext:
    "Start a new session in this project. Use $titan in Codex or /titan in Claude Code. Read titan guide for CLI use.",
  PluginDescription: "Plan, run and recover Titan workflows with independent falsification",
  McpSkipped: "codex was not found, so titan mcp is not registered",
  McpFailed: "codex mcp add failed",
  ClaudeMcpSkipped: "claude was not found, so titan mcp is not registered",
  ClaudeMcpFailed: "claude mcp add failed",
  ImportSkipped: "agy was not found, so the plug-in is not imported",
  ImportFailed: "agy plugin import failed",
  McpReady: "Titan MCP connection is registered.",
  ModelSetup:
    "Local meaning model needs setup. Run titan doctor --fetch-model with the same --home option.",
} as const;

export const installedGuideLine = (path: string): string => `Agent guide saved at ${path}`;
export const readyModelLine = (name: string): string => `Local meaning model ${name} is ready.`;
export const prerequisiteLine = (name: string, ready: boolean, repair: string | null): string =>
  ready ? `${name} is ready.` : `${name} needs setup. ${repair ?? "Check its installation."}`;
export const doctorHomeLine = (home: string): string => `Titan home is ${home}`;
export const doctorProjectLine = (project: string): string => `Project is ${project}`;
export const doctorHarnessLine = (harness: string): string => `Selected agent is ${harness}`;
export const doctorLiveLine = (status: string): string => `Live backend checks ${status}.`;
export const doctorBackendsLine = (backends: readonly string[]): string =>
  `Available backends ${backends.join(", ")}`;
export const doctorRuntimeLine = (name: string, path: string | null): string =>
  `${name} ${path ?? "was not found"}`;
export const doctorToolLine = (name: string, status: string): string => `${name} ${status}`;
export const doctorBackupLine = (version: string, runs: number, projects: number): string =>
  `Backup for Titan ${version} verified. Recorded runs ${runs}. Recorded projects ${projects}.`;

export const staticPlanLine = (agents: number): string => `static plan: at most ${agents} agents`;
export const addableStepsLine = (steps: number): string =>
  `agents can add up to ${steps} more steps`;
export const unknownCommand = (name: string): string => `Unknown command: ${name}`;
export const unsupportedOption = (name: string, option: string): string =>
  `${name} does not accept --${option}`;
export const extraArguments = (name: string): string =>
  `${name} received extra positional arguments`;
export const pendingCommand = (name: string): string => `${name}: not built yet in this preview`;
export const requiredArgument = (name: string): string => `Supply a ${name}`;
export const unknownArgument = (name: string, value: string): string => `Unknown ${name}: ${value}`;
export const unsupportedBackend = (backend: string): string => `Unsupported backend: ${backend}`;
export const existingSkill = (path: string): string => `Refusing to replace ${path}`;
export const experimentalBackend = (backend: string): string => `${backend} (experimental)`;
export const cliFailure = (code: string, reason: string): string => `${code}: ${reason}`;
export const cliRunEvent = (id: number, type: string, data: unknown): string =>
  `${id} ${type} ${JSON.stringify(data)}`;
export const installedSkill = (guide: string): string =>
  `---\nname: titan\ndescription: Plan, run and recover local Titan workflows with independent falsification for Codex or Claude Code.\n---\n\n${guide}`;
