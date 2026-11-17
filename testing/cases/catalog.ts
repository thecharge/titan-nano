import {
  ErrorCode,
  EventInspectionTransport,
  RunStatus,
  ServerLimit,
  ServerState,
} from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const all = {
  ids: ["run-5", "run-4", "run-3", "run-2", "run-1"],
  origins: ["codex", "claude", "codex", "claude", "codex"],
};
const codex = { ids: ["run-5", "run-3", "run-1"], origins: ["codex", "codex", "codex"] };
const claude = { ids: ["run-4", "run-2"], origins: ["claude", "claude"] };
export const catalogInspectionCases = {
  positive: [
    positive(
      "HTTP pages retain all older rows through insertion",
      [EventInspectionTransport.Http, 2],
      { ...all, pages: 3 },
    ),
    positive(
      "HTTP caller filter survives restart",
      [EventInspectionTransport.Http, 1, "codex", true],
      { ...codex, pages: 3 },
    ),
    positive("CLI pages retain both callers", [EventInspectionTransport.Cli, 3], {
      ...all,
      pages: 2,
    }),
    positive(
      "CLI caller filter survives restart",
      [EventInspectionTransport.Cli, 1, "claude", true],
      { ...claude, pages: 2 },
    ),
    positive("MCP pages retain both callers", [EventInspectionTransport.Mcp, 2], {
      ...all,
      pages: 3,
    }),
    positive(
      "MCP caller filter survives restart",
      [EventInspectionTransport.Mcp, 2, "codex", true],
      { ...codex, pages: 2 },
    ),
  ],
  negative: [
    negative("HTTP zero page size", [EventInspectionTransport.Http, 0], {
      code: ErrorCode.Arguments,
    }),
    negative(
      "HTTP excessive page size",
      [EventInspectionTransport.Http, ServerLimit.RunPageMaximum + 1],
      { code: ErrorCode.Arguments },
    ),
    negative("CLI zero page size", [EventInspectionTransport.Cli, 0], {
      code: ErrorCode.Arguments,
    }),
    negative(
      "CLI excessive page size",
      [EventInspectionTransport.Cli, ServerLimit.RunPageMaximum + 1],
      { code: ErrorCode.Arguments },
    ),
    negative("MCP zero page size", [EventInspectionTransport.Mcp, 0], {
      code: ErrorCode.Arguments,
    }),
    negative(
      "MCP excessive page size",
      [EventInspectionTransport.Mcp, ServerLimit.RunPageMaximum + 1],
      { code: ErrorCode.Arguments },
    ),
  ],
};

export const catalogSearchCases = {
  positive: [
    positive("default catalog range", [{}], {
      before: Number.MAX_SAFE_INTEGER,
      limit: ServerLimit.RunPageSize,
    }),
    positive(
      "explicit catalog range and caller",
      [{ before: "4", limit: "2", client_id: "codex" }],
      { before: 4, limit: 2, client_id: "codex" },
    ),
    positive(
      "opaque session and project selectors",
      [{ harness_session_id: "conversation / one", project_path: "/project" }],
      {
        before: Number.MAX_SAFE_INTEGER,
        limit: ServerLimit.RunPageSize,
        harness_session_id: "conversation / one",
        project_path: "/project",
      },
    ),
  ],
  negative: [
    negative("zero cursor", [{ before: "0" }], { code: ErrorCode.Arguments }),
    negative("unsafe cursor", [{ before: "9007199254740992" }], { code: ErrorCode.Arguments }),
    negative("unknown selector", [{ after: "1" }], { code: ErrorCode.Arguments }),
    negative("empty caller", [{ client_id: "" }], { code: ErrorCode.Arguments }),
    negative("empty session", [{ harness_session_id: "" }], { code: ErrorCode.Arguments }),
    negative(
      "excessive session",
      [{ harness_session_id: "x".repeat(ServerLimit.IdentityCharacters + 1) }],
      { code: ErrorCode.Arguments },
    ),
    negative("relative project", [{ project_path: "project" }], { code: ErrorCode.Arguments }),
    negative("unnormalized project", [{ project_path: "/project/../other" }], {
      code: ErrorCode.Arguments,
    }),
  ],
};

const row = {
  run_id: "run-one",
  client_id: "codex",
  state: ServerState.InitializationIncomplete,
  project: null,
};
const page = {
  schema_version: ServerLimit.RunPageVersion,
  runs: [row],
  before: Number.MAX_SAFE_INTEGER,
  next_before: 1,
  has_more: false,
};
const invalid = { code: ErrorCode.InvalidResponse };
export const catalogResponseCases = {
  positive: [
    positive("one bound catalog response", [page], 1),
    positive(
      "empty end cursor remains stable",
      [{ ...page, runs: [], before: 3, next_before: 3 }, { before: 3 }],
      0,
    ),
    positive(
      "filtered page can advance without a match",
      [
        { ...page, schema_version: 2, runs: [], has_more: true },
        { harness_session_id: "session-one" },
      ],
      0,
    ),
    positive(
      "filtered page retains exact session and project",
      [
        {
          ...page,
          schema_version: 2,
          runs: [{ ...row, harness_session_id: "session-one", project: "/project" }],
        },
        { harness_session_id: "session-one", project_path: "/project" },
      ],
      1,
    ),
  ],
  negative: [
    negative("response cannot change requested cursor", [{ ...page, before: 4 }], invalid),
    negative(
      "response cannot exceed requested count",
      [{ ...page, runs: [row, { ...row, run_id: "run-two" }] }, { limit: 1 }],
      invalid,
    ),
    negative("response cannot substitute a caller", [page, { client_id: "claude" }], invalid),
    negative(
      "empty page cannot claim more rows",
      [{ ...page, runs: [], has_more: true, next_before: Number.MAX_SAFE_INTEGER }],
      invalid,
    ),
    negative(
      "nonempty page cannot stall cursor",
      [{ ...page, next_before: Number.MAX_SAFE_INTEGER }],
      invalid,
    ),
    negative(
      "duplicate run identities cannot enter a page",
      [{ ...page, runs: [row, row] }],
      invalid,
    ),
    negative(
      "oversized project cannot enter a summary",
      [{ ...page, runs: [{ ...row, project: "x".repeat(ServerLimit.SummaryCharacters + 1) }] }],
      invalid,
    ),
    negative(
      "oversized diagnostic cannot enter a summary",
      [{ ...page, runs: [{ ...row, error: "x".repeat(ServerLimit.SummaryCharacters + 1) }] }],
      invalid,
    ),
    negative(
      "unfiltered response cannot switch protocol",
      [{ ...page, schema_version: 2 }],
      invalid,
    ),
    negative("unknown response version cannot pass", [{ ...page, schema_version: 3 }], invalid),
    negative(
      "filtered response cannot use legacy semantics",
      [page, { harness_session_id: "session-one" }],
      invalid,
    ),
    negative(
      "response cannot substitute session",
      [
        { ...page, schema_version: 2, runs: [{ ...row, harness_session_id: "session-two" }] },
        { harness_session_id: "session-one" },
      ],
      invalid,
    ),
    negative(
      "response cannot substitute project",
      [
        { ...page, schema_version: 2, runs: [{ ...row, project: "/other" }] },
        { project_path: "/project" },
      ],
      invalid,
    ),
    negative(
      "filtered empty page cannot stall",
      [
        { ...page, schema_version: 2, runs: [], has_more: true, next_before: page.before },
        { project_path: "/project" },
      ],
      invalid,
    ),
  ],
};

export const catalogScopeCases = {
  positive: [
    positive(
      "HTTP project filter includes unlabelled runs",
      [EventInspectionTransport.Http, { project_path: "first" }, true],
      [4, 3, 2, 0],
    ),
    positive(
      "CLI project filter includes unlabelled runs",
      [EventInspectionTransport.Cli, { project_path: "first" }, true],
      [4, 3, 2, 0],
    ),
    positive(
      "MCP project filter includes unlabelled runs",
      [EventInspectionTransport.Mcp, { project_path: "first" }, true],
      [4, 3, 2, 0],
    ),
    positive(
      "HTTP session spans projects through empty pages and restart",
      [EventInspectionTransport.Http, { harness_session_id: "session-one" }, true],
      [3, 1, 0],
    ),
    positive(
      "HTTP caller session and project intersect",
      [
        EventInspectionTransport.Http,
        { client_id: "codex", harness_session_id: "session-one", project_path: "first" },
      ],
      [3, 0],
    ),
    positive(
      "CLI session spans projects through empty pages and restart",
      [EventInspectionTransport.Cli, { harness_session_id: "session-one" }, true],
      [3, 1, 0],
    ),
    positive(
      "CLI caller session and project intersect",
      [
        EventInspectionTransport.Cli,
        { client_id: "codex", harness_session_id: "session-one", project_path: "first" },
      ],
      [3, 0],
    ),
    positive(
      "MCP session spans projects through empty pages and restart",
      [EventInspectionTransport.Mcp, { harness_session_id: "session-one" }, true],
      [3, 1, 0],
    ),
    positive(
      "MCP caller session, project and state intersect",
      [
        EventInspectionTransport.Mcp,
        {
          client_id: "codex",
          harness_session_id: "session-one",
          project_path: "first",
          state: RunStatus.Passed,
        },
      ],
      [3, 0],
    ),
  ],
  negative: [
    rejected(
      "HTTP absent session cannot select a legacy run",
      [EventInspectionTransport.Http, { harness_session_id: "absent" }],
      [],
    ),
    rejected(
      "HTTP crossed caller and project select nothing",
      [
        EventInspectionTransport.Http,
        { client_id: "claude", harness_session_id: "session-one", project_path: "first" },
        true,
      ],
      [],
    ),
    rejected(
      "CLI absent session cannot select a legacy run",
      [EventInspectionTransport.Cli, { harness_session_id: "absent" }],
      [],
    ),
    rejected(
      "CLI crossed caller and project select nothing",
      [
        EventInspectionTransport.Cli,
        { client_id: "claude", harness_session_id: "session-one", project_path: "first" },
        true,
      ],
      [],
    ),
    rejected(
      "MCP running selector excludes completed runs",
      [EventInspectionTransport.Mcp, { state: RunStatus.Running }],
      [],
    ),
    rejected(
      "MCP crossed caller and project select nothing",
      [
        EventInspectionTransport.Mcp,
        { client_id: "claude", harness_session_id: "session-one", project_path: "first" },
        true,
      ],
      [],
    ),
  ],
};

export const catalogQueryCases = {
  positive: [
    positive("SQL query limits the default listing", ["limit=1"], 1),
    positive("SQL caller filter limits returned rows", ["client_id=claude&limit=2"], 2),
    positive("unknown caller has an empty page", ["client_id=unknown"], 0),
  ],
  negative: [
    negative("duplicate selectors cannot pick a limit", ["limit=1&limit=2"], {
      code: ErrorCode.Arguments,
    }),
    negative("unknown selectors cannot be ignored", ["unknown=1"], { code: ErrorCode.Arguments }),
  ],
};
