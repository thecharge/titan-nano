import { DashboardPageExercise, DashboardSession, ErrorCode } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const packedPage = {
  path: "/",
  body: '<script src="./app.js"></script>',
  type: "text/html; charset=utf-8",
};

export const dashboardConfigurationQueryCases = {
  positive: [
    positive("authenticated frozen configuration", ["", true, true], {
      handled: true,
      status: 200,
      received: "run one",
    }),
    positive("empty query retains the exact decoded run", ["?", true, true], {
      handled: true,
      status: 200,
      received: "run one",
    }),
  ],
  negative: [
    rejected("configuration requires a session", ["", false, true], {
      handled: true,
      status: 401,
      received: null,
    }),
    rejected("legacy source reports unavailable", ["", true, false], {
      handled: true,
      status: 404,
      received: null,
    }),
    rejected("configuration refuses selectors", ["?scope=project", true, true], {
      handled: true,
      status: 400,
      received: null,
    }),
    rejected("duplicate selectors cannot read settings", ["?sources=1&sources=0", true, true], {
      handled: true,
      status: 400,
      received: null,
    }),
  ],
};

export const renderedConfigurationCases = {
  positive: [
    positive("settings, hash and source strings render literally", [200, false], true),
    positive("legacy settings without sources remain readable", [200, true], true),
  ],
  negative: [
    rejected("expired configuration session offers recovery", [401, false], true),
    rejected("unavailable configuration offers retry", [500, false], true),
  ],
};

export const renderedArtifactCases = {
  positive: [
    positive("verified file metadata and output text link to bounded content", [false, false], {
      empty: false,
      literal: true,
      binary: false,
      next: false,
      first: false,
      fileLink: true,
      stream: 0,
    }),
    positive("UTF-8 content stays literal", [true, false], {
      empty: false,
      literal: true,
      binary: false,
      next: false,
      first: false,
      fileLink: false,
      stream: 0,
    }),
  ],
  negative: [
    rejected("an empty verified delivery explains the missing files", [false, true], {
      empty: true,
      literal: true,
      binary: false,
      next: false,
      first: false,
      fileLink: false,
      stream: 0,
    }),
    rejected("binary bytes stay encoded with next and first page links", [true, true], {
      empty: false,
      literal: true,
      binary: true,
      next: true,
      first: true,
      fileLink: false,
      stream: 0,
    }),
  ],
};

export const dashboardArtifactQueryCases = {
  positive: [
    positive("a cookie can inspect a delivery with a decoded run id", ["", false, true], {
      handled: true,
      status: 200,
      received: { id: "run one" },
    }),
    positive("a cookie can read a bounded artifact range", ["?offset=4&limit=2", true, true], {
      handled: true,
      status: 200,
      received: { id: "run one", file: "a".repeat(64), range: { offset: 4, limit: 2 } },
    }),
  ],
  negative: [
    rejected("a source without artifact inspection returns unavailable", ["", false, true, false], {
      handled: true,
      status: 404,
      received: null,
    }),
    rejected("a source without file inspection returns unavailable", ["", true, true, false], {
      handled: true,
      status: 404,
      received: null,
    }),
    rejected("a missing cookie cannot inspect a delivery", ["", false, false], {
      handled: true,
      status: 401,
      received: null,
    }),
    rejected("a missing cookie cannot read file content", ["", true, false], {
      handled: true,
      status: 401,
      received: null,
    }),
    rejected("duplicate offsets are refused before reading", ["?offset=0&offset=1", true, true], {
      handled: true,
      status: 400,
      received: null,
    }),
    rejected("an unknown file query is refused", ["?path=secret", true, true], {
      handled: true,
      status: 400,
      received: null,
    }),
    rejected("a manifest query is refused", ["?limit=1", false, true], {
      handled: true,
      status: 400,
      received: null,
    }),
    rejected("negative file offsets are refused", ["?offset=-1", true, true], {
      handled: true,
      status: 400,
      received: null,
    }),
  ],
};
const packedScript = {
  path: "/app.js",
  body: "window.ready = true",
  type: "text/javascript; charset=utf-8",
};

export const packedDashboardAssetsCases = {
  positive: [
    positive(
      "installed HTML uses shipped browser assets",
      [JSON.stringify([packedPage, packedScript])],
      {
        paths: ["/", "/app.js"],
        page: '<script src="/app.js"></script>',
        script: packedScript.body,
      },
    ),
    positive(
      "an asset-free installed page can load without source files",
      [JSON.stringify([{ ...packedPage, body: "Titan" }])],
      {
        paths: ["/"],
        page: "Titan",
        script: undefined,
      },
    ),
  ],
  negative: [
    negative(
      "duplicate paths cannot replace a shipped asset",
      [JSON.stringify([packedPage, packedPage])],
      { name: "ZodError" },
    ),
    negative("a package without its root page is rejected", [JSON.stringify([packedScript])], {
      name: "ZodError",
    }),
    negative("invalid JSON cannot become a dashboard page", ["invalid JSON"], {
      name: "SyntaxError",
    }),
  ],
};

export const codeOutcomeCases = {
  positive: [
    positive("fresh code opens a session", [0, 1], "session"),
    positive("code one millisecond before the limit opens a session", [59_999, 1], "session"),
  ],
  negative: [
    rejected("code at the 60 s limit is refused", [60_000, 1], "refused"),
    rejected("used code is refused on the second try", [0, 2], "refused"),
    rejected("wrong code is refused", [0, 1, "not-a-code"], "refused"),
    rejected("missing code is refused", [0, 1, null], "refused"),
  ],
};

export const mintedCodeCases = {
  positive: [
    positive("one code is minted", [1], 1),
    positive("sixteen different codes fit", [16], 16),
  ],
  negative: [
    negative("seventeenth live code is refused", [17], { code: ErrorCode.Arguments }),
    negative("a hundred live codes are refused", [100], { code: ErrorCode.Arguments }),
  ],
};

export const sessionValidCases = {
  positive: [
    positive("issued session is valid", ["issued", 0], true),
    positive("issued session is valid among other sessions", ["issued", 3], true),
  ],
  negative: [
    rejected("missing session is not valid", [undefined, 0], false),
    rejected("guessed session is not valid", ["guess", 2], false),
  ],
};

export const sessionRetentionCases = {
  positive: [
    positive("oldest session survives at capacity", [DashboardSession.MaximumSessions, 0], true),
    positive(
      "second session survives one eviction",
      [DashboardSession.MaximumSessions + 1, 1],
      true,
    ),
  ],
  negative: [
    rejected(
      "oldest session is evicted at overflow",
      [DashboardSession.MaximumSessions + 1, 0],
      false,
    ),
    rejected(
      "second session is evicted after two replacements",
      [DashboardSession.MaximumSessions + 2, 1],
      false,
    ),
  ],
};

export const dashboardFallbackCases = {
  positive: [
    positive("minimal source can list runs", ["/ui/api/runs"], 200),
    positive("minimal source can load the dashboard page", ["/"], 200),
  ],
  negative: [
    rejected("missing browser asset has no content", ["/missing.js"], 404),
    rejected("source without knowledge reports unavailable", ["/ui/api/knowledge"], 404),
    rejected("unknown dashboard route reports missing", ["/unknown"], 404),
    negative("operational run failure stays visible", ["/ui/api/runs/run"], {
      message: "Injected dashboard source failure",
    }),
  ],
};

export const cookieSessionCases = {
  positive: [
    positive("single cookie", ["titan_session=abc"], "abc"),
    positive("cookie among others", ["a=b; titan_session=xyz; c=d"], "xyz"),
  ],
  negative: [
    rejected("no cookie header", [null], "none"),
    rejected("other cookie only", ["other=1"], "none"),
    rejected("name that only ends the same", ["other_titan_session=abc"], "none"),
  ],
};

export const rewrittenSourceCases = {
  positive: [
    positive(
      "script from the build folder points at the root",
      ['<script src="./chunk-1.js"></script>', ["chunk-1.js"]],
      '<script src="/chunk-1.js"></script>',
    ),
    positive(
      "style from a parent folder points at the root",
      ['<link href="../app.css">', ["app.css"]],
      '<link href="/app.css">',
    ),
  ],
  negative: [
    rejected(
      "a file of another host is left alone when titan has no such file",
      ['<script src="https://cdn.example.com/a.js"></script>', []],
      '<script src="https://cdn.example.com/a.js"></script>',
    ),
    rejected(
      "an unknown local file is left alone",
      ['<script src="./other.js"></script>', ["chunk-1.js"]],
      '<script src="./other.js"></script>',
    ),
  ],
};

export const streamedIdCases = {
  positive: [
    positive("two pages are joined in order", [[[1, 2], [3]], false], "1,2,3"),
    positive("one page", [[[1, 2, 3]], false], "1,2,3"),
  ],
  negative: [
    negative("a failing second page rejects", [[[1], [2]], true], { message: "read failed" }),
    rejected("no events gives an empty list", [[], false], ""),
  ],
};

const started = ["attempt_started", { step_id: "build", attempt: 1 }] as [string, unknown];
const passed = ["step_passed", { step_id: "build", attempt: 1 }] as [string, unknown];
const refuted = ["result_refuted", { step_id: "build", attempt: 2 }] as [string, unknown];
const failed = ["step_failed", { step_id: "build" }] as [string, unknown];
const check = ["check_answered", { step_id: "build", phase: "tests", answer: "proven" }] as [
  string,
  unknown,
];

export const stepReportCases = {
  positive: [
    positive("a passed attempt survives", [[started, passed], 0], "1:survived:0 |  | "),
    positive(
      "a refuted attempt gets the evidence on the last one and a failed step closes the open one",
      [[started, ["attempt_started", { step_id: "build", attempt: 2 }], refuted, failed], 0],
      "1:refuted:0 2:refuted:1 |  | ",
    ),
    positive("a check answer is listed", [[started, check], 0], "1:open:0 | tests=proven | "),
    positive(
      "an open request gets its answer command",
      [[started], 1],
      "1:open:0 |  | titan answer run request-0 approve --request-version 1",
    ),
  ],
  negative: [
    rejected(
      "an event of another step is ignored",
      [[["step_passed", { step_id: "other", attempt: 1 }]], 0],
      " |  | ",
    ),
    rejected("an event without a step is ignored", [[["step_passed", null]], 0], " |  | "),
  ],
};

const sorry = "Illegal axiom detected: 'sorryAx'";
const proveStart = (attempt: number) =>
  ["attempt_started", { step_id: "prove", attempt }] as [string, unknown];
const proveCheck = ["check_answered", { step_id: "prove", phase: "lean", answer: "proven" }] as [
  string,
  unknown,
];

export const provedStepCases = {
  positive: [
    positive(
      "attempt 1 refuted keeps its evidence and attempt 2 is proven",
      [
        [
          proveStart(1),
          ["result_refuted", { step_id: "prove", attempt: 2 }],
          proveStart(2),
          ["step_passed", { step_id: "prove", attempt: 2 }],
          proveCheck,
        ],
        "prove",
        [sorry],
      ],
      `prove 1:refuted:${sorry} 2:survived: lean=proven`,
    ),
    positive(
      "a refuted check answer is shown as given",
      [
        [proveStart(1), ["check_answered", { step_id: "prove", phase: "lean", answer: "refuted" }]],
        "prove",
        [],
      ],
      "prove 1:open: lean=refuted",
    ),
  ],
  negative: [
    rejected(
      "a proof answer of another step is not shown",
      [[proveStart(1), ["check_answered", { step_id: "other", answer: "proven" }]], "prove", []],
      "prove 1:open:",
    ),
    rejected("a step without events has no attempts", [[], "prove", [sorry]], "prove"),
  ],
};

export const liveFramesCases = {
  positive: [
    positive(
      "an event written after the page connected arrives within 2 s",
      [[1, 2, 3], 3, [4]],
      "4 true",
    ),
    positive(
      "a page that connects again with 3 first gets event 4",
      [[1, 2, 3, 4, 5], 3, []],
      "4 true",
    ),
  ],
  negative: [
    rejected("a cursor at the last event gets nothing to replay", [[1, 2, 3], 3, []], "none"),
    rejected("events up to the cursor are not sent again", [[1, 2], 2, []], "none"),
  ],
};

export const keepAliveFrameCases = {
  positive: [
    positive("a stream idle for 15 s sends a keep-alive line", [15_000], ": keep-alive"),
    positive("a stream idle for a minute sends a keep-alive line", [60_000], ": keep-alive"),
  ],
  negative: [
    rejected("a stream idle for 14.999 s sends nothing", [14_999], "none"),
    rejected("a stream that was just written to sends nothing", [0], "none"),
  ],
};

const columns = "run|workflow|state|stage|persona|started|cost USD";
const runText = `run-1 passed|Run numbers|started|1970-01-01T00:00:00.001Z|elapsed ms|2|attempts|3|agents at once|1|input tokens|5 (complete)|output tokens|5 (complete)|cost USD|not reported|survived|1|refuted|1|proven|1|refuted checks|0|not proven|0|answer in a terminal|steps|build (script) passed|attempt 1: refuted|evidence text|tests: proven|open requests|request-1 approval: titan answer run|board|1 attempt_started {"step_id":"build"}|2 step_passed {"step_id":"build"}`;

export const renderedPageCases = {
  positive: [
    positive(
      "the list shows current work, start time and cost or blanks",
      ["", [], false],
      `3 Knowledge|Client|Session|Project path|Filter runs|Clear filters|Recent runs|${columns}|run-1|flow|passed|build|builder|1970-01-01T00:00:00.001Z|not reported|All measurements|Run numbers|started|1970-01-01T00:00:00.001Z|elapsed ms|2|attempts|3|agents at once|1|input tokens|5 (complete)|output tokens|5 (complete)|cost USD|not reported|survived|1|refuted|1|proven|1|refuted checks|0|not proven|0|run-2|queued no stream`,
    ),
    positive(
      "the run page lists steps, evidence, checks, requests and board",
      ["#/run/run-1", [], false],
      `13 All runs|Knowledge|Run configuration|${runText}|Connecting to live events… /ui/api/runs/run-1/events?after=2`,
    ),
    positive(
      "a streamed event is added once and a repeated one is skipped",
      ["#/run/run-1", [2, 3], false],
      `13 All runs|Knowledge|Run configuration|${runText}|3 x null|Live events connected /ui/api/runs/run-1/events?after=2`,
    ),
  ],
  negative: [
    rejected(
      "a run without board messages keeps the cursor of the earlier visit",
      ["#/run/run-1", [], true],
      `13 All runs|Knowledge|Run configuration|${runText.split("|open requests")[0]}|open requests|No open requests|board|Connecting to live events… /ui/api/runs/run-1/events?after=3`,
    ),
    rejected(
      "a run page with no stream events shows only the loaded board",
      ["#/run/run-1", [1], false],
      `13 All runs|Knowledge|Run configuration|${runText}|Connecting to live events… /ui/api/runs/run-1/events?after=3`,
    ),
  ],
};

export const renderedDashboardFiltersCases = {
  positive: [
    positive(
      "the current URL populates labelled fields",
      [DashboardPageExercise.PreserveFilters],
      true,
    ),
    positive(
      "submission encodes changed filters and starts the latest page",
      [DashboardPageExercise.ApplyFilters],
      true,
    ),
  ],
  negative: [
    rejected(
      "blank fields remove earlier filters and cursors",
      [DashboardPageExercise.ClearRunFilters],
      true,
    ),
    rejected(
      "refresh cannot interrupt an unfinished filter edit",
      [DashboardPageExercise.FocusedFilters],
      true,
    ),
  ],
};

export const renderedDashboardPaginationCases = {
  positive: [
    positive("the latest page links to older runs", ["#/", true, false], {
      links: ["#/runs?before=40"],
      emptyPage: false,
    }),
    positive(
      "navigation retains client filters",
      ["#/runs?client_id=client&before=42", true, false],
      {
        links: ["#/runs?client_id=client", "#/runs?client_id=client&before=40"],
        emptyPage: false,
      },
    ),
  ],
  negative: [
    rejected("the last page has no older link", ["#/runs?before=42", false, false], {
      links: ["#/runs?"],
      emptyPage: false,
    }),
    rejected("an empty older page retains a return path", ["#/runs?before=42", false, true], {
      links: ["#/runs?"],
      emptyPage: true,
    }),
  ],
};

export const dashboardListQueryCases = {
  positive: [
    positive("the default page retains the dashboard limit", [""], {
      status: 200,
      query: { before: Number.MAX_SAFE_INTEGER, limit: 200 },
    }),
    positive(
      "cursor and client filters reach the catalog",
      ["?before=42&limit=2&client_id=client"],
      {
        status: 200,
        query: { before: 42, limit: 2, client_id: "client" },
      },
    ),
  ],
  negative: [
    rejected("duplicate cursors cannot be interpreted differently", ["?before=42&before=40"], {
      status: 400,
      query: null,
    }),
    rejected("a zero cursor is refused", ["?before=0"], { status: 400, query: null }),
    rejected("unknown query fields are refused", ["?unknown=1"], { status: 400, query: null }),
    rejected("oversized page limits are refused", ["?limit=201"], { status: 400, query: null }),
  ],
};

const detailContext = {
  backend: "codex-sdk",
  runtime_version: null,
  project: "/project",
  max_parallel: 2,
  error: null,
  artifacts: null,
};
const phaseRecovery = {
  phase: "worker",
  executions: 2,
  retries: 1,
  next_retry: 1000,
  capture_pending: false,
  error: null,
};

export const dashboardRunDetailsCases = {
  positive: [
    positive(
      "dependencies and pending capture survive projection",
      [["research"], true, false, "capture changed"],
      {
        context: detailContext,
        needs: ["research"],
        recovery: [{ ...phaseRecovery, capture_pending: true, error: "capture changed" }],
      },
    ),
    positive("retry timing and execution counts survive projection", [[], false, false, null], {
      context: detailContext,
      needs: [],
      recovery: [phaseRecovery],
    }),
  ],
  negative: [
    rejected("completed phases do not appear as recovery work", [[], false, true, null], {
      context: detailContext,
      needs: [],
      recovery: [],
    }),
    rejected(
      "completed errors do not suggest another pending retry",
      [["prepare"], false, true, "earlier failure"],
      {
        context: detailContext,
        needs: ["prepare"],
        recovery: [],
      },
    ),
  ],
};

export const renderedCapacityCases = {
  positive: [
    positive(
      "native backend slots and queued work are visible",
      [
        {
          max_active_agents: 4,
          max_pending_agents: 8,
          active: 2,
          pending: 3,
          backends: { "codex-sdk": 2 },
          backend_limits: { "codex-sdk": 2 },
        },
      ],
      "2 of 4 agent slots active|3 of 8 queue slots waiting|codex-sdk · 2 active · 2 slots",
    ),
    positive(
      "an uncapped backend uses the shared limit",
      [
        {
          max_active_agents: 4,
          max_pending_agents: 8,
          active: 1,
          pending: 0,
          backends: { "claude-sdk": 1 },
          backend_limits: { "claude-sdk": null },
        },
      ],
      "1 of 4 agent slots active|0 of 8 queue slots waiting|claude-sdk · 1 active · shared agent limit",
    ),
  ],
  negative: [
    rejected(
      "idle configured slots remain visible",
      [
        {
          max_active_agents: 2,
          max_pending_agents: 0,
          active: 0,
          pending: 0,
          backends: {},
          backend_limits: { "codex-sdk": 1 },
        },
      ],
      "0 of 2 agent slots active|0 of 0 queue slots waiting|codex-sdk · 0 active · 1 slots",
    ),
    rejected(
      "absent backend caps do not invent a slot count",
      [
        {
          max_active_agents: 2,
          max_pending_agents: 0,
          active: 0,
          pending: 0,
          backends: {},
          backend_limits: {},
        },
      ],
      "0 of 2 agent slots active|0 of 0 queue slots waiting",
    ),
  ],
};

export const renderedRunDetailsCases = {
  positive: [
    positive("pending capture and retry timing are visible", [true, "Capture changed", false], {
      context: true,
      dependencies: true,
      recovery: true,
      pending: true,
      retry: true,
      error: true,
    }),
    positive("error text stays literal", [false, "<img src=x onerror=alert(1)>", false], {
      context: true,
      dependencies: true,
      recovery: true,
      pending: false,
      retry: false,
      error: true,
    }),
  ],
  negative: [
    rejected("older responses retain their existing view", [false, null, true], {
      context: false,
      dependencies: false,
      recovery: false,
      pending: false,
      retry: false,
      error: false,
    }),
    rejected("absent errors and retry times add no failure text", [false, null, false], {
      context: true,
      dependencies: true,
      recovery: true,
      pending: false,
      retry: false,
      error: false,
    }),
  ],
};

export const renderedDashboardRecoveryCases = {
  positive: [
    positive("server failure offers a retry", [500, false], true),
    positive("bad response data offers a retry", [200, true], true),
  ],
  negative: [
    rejected("expired session explains login recovery", [401, false], true),
    rejected("refused session explains login recovery", [403, false], true),
  ],
};

export const renderedDashboardInteractionCases = {
  positive: [
    positive(
      "old cursor entries are evicted at the navigation bound",
      [DashboardPageExercise.BoundedCursors],
      true,
    ),
    positive(
      "late run responses preserve the selected page",
      [DashboardPageExercise.DelayedRun],
      true,
    ),
    positive(
      "late catalog responses preserve the selected page",
      [DashboardPageExercise.DelayedList],
      true,
    ),
    positive(
      "an empty catalog explains how to start a run",
      [DashboardPageExercise.EmptyRuns],
      true,
    ),
    positive("an empty plan explains the missing steps", [DashboardPageExercise.EmptySteps], true),
    positive("retry restores a failed detail page", [DashboardPageExercise.Retry], true),
    positive(
      "stream reconnect reports the restored connection",
      [DashboardPageExercise.Reconnect],
      true,
    ),
    positive(
      "long streams retain a bounded event window",
      [DashboardPageExercise.BoundedEvents],
      true,
    ),
  ],
  negative: [
    rejected(
      "late knowledge responses preserve the selected page",
      [DashboardPageExercise.DelayedKnowledge],
      true,
    ),
    rejected(
      "late failed requests preserve the selected page",
      [DashboardPageExercise.DelayedFailure],
      true,
    ),
    rejected(
      "invalid stream data shows reconnection feedback",
      [DashboardPageExercise.InvalidEvent],
      true,
    ),
    rejected("refresh failure offers recovery", [DashboardPageExercise.RefreshFailure], true),
    rejected(
      "navigation closes streams and ignores late messages",
      [DashboardPageExercise.Navigation],
      true,
    ),
  ],
};
