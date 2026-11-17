import { BoardLimit, ServerLimit } from "@titan/constants";

export const ServerMessage = {
  CompactBusy: "Run requests changed during inspection. Retry compact status",
  BuildMismatch: "The running Titan server uses a different build. Finish active work and retry.",
  MaintenancePerson: "Stopping the local server requires the home owner's credential",
  MaintenanceBusy:
    "The local server has active work. The update can continue after it becomes idle",
  MaintenanceRequest: "Server shutdown requires an idle_only boolean and no query parameters",
  Maintenance: "Another update or server startup owns this Titan home. Retry after it completes",
  Stopping: "The local server is stopping. Retry after shutdown completes",
  AdmissionCapacity: "The local server has reached its request admission limit",
  SummaryUnavailable: "The stored run summary is unavailable or does not match the journal",
  StartupFailed:
    "Titan could not start its local server. Run titan serve with the same home to inspect the startup failure",
  Config: "Inspect the committed configuration and setting sources for an exact run.",
  RunQuery: `Run selectors require a positive safe integer before, a limit from 1 to ${ServerLimit.RunPageMaximum}, optional client_id and harness_session_id of 1 to ${ServerLimit.IdentityCharacters} characters, and an absolute normalized project_path`,
  RunPage:
    "Run listing page does not match the requested version, cursor, count, caller, session or project",
  Artifact: "Read a bounded verified byte page from one kept artifact file.",
  EventQuery: `Event selectors require a nonnegative safe integer after and a limit from 1 to ${BoardLimit.EventPageSize}`,
  DuplicateQuery: "Selectors must not repeat a query parameter",
  Lock: "Server lock exists; inspect its owner before removing a stale lock",
  RunNotFound: "Run not found",
  Authentication: "Local client authentication required",
  Project: "Project must be an existing directory with an absolute normalized path",
  SubmissionConflict: "Submission ID already belongs to different input",
  Route: "Route not found",
  Operation: "Unknown run operation",
  Method: "Method not supported",
  Schema: "Read the supported preview workflow schema before writing a plan",
  Check: "Validate a workflow without starting an agent",
  Run: "Submit a checked workflow to the local engine. Only Codex, Claude Code and stubs are implemented. External actions and scripts are blocked.",
  Runs: "List runs visible to this engine home",
} as const;
export const runOperationDescription = (action: string): string =>
  `${action} a run by its exact ID`;
export const localServerUrl = (port: number): string => `http://127.0.0.1:${port}`;

export const serverVersionMismatch = (actual: string, required: string): string =>
  `The running server uses Titan ${actual}. This command requires Titan ${required}. Complete the server update before retrying`;
