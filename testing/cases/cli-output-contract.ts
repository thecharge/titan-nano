import {
  BoardLimit,
  CliCommand,
  CliOutput,
  CliOutputOperation,
  CliRecoveryAction,
  ErrorCode,
  ExitCode,
  HarnessPlugin,
  RunStatus,
} from "@titan/constants";
import {
  OperationalError,
  RunObservationError,
  SubmissionUncertainError,
  TitanError,
} from "@titan/errors";
import { positive, rejected } from "@titan/test-factories";

const installation = {
  installed: "/project/.agents/skills/titan/SKILL.md",
  mcp: HarnessPlugin.Server,
  model: {
    name: "local-model",
    revision: "a".repeat(40),
    directory: "/home/model",
    bytes: 1,
    ready: true,
    missing: [],
    fetch_command: ["titan", "doctor", "--fetch-model"],
  },
  prerequisites: [{ name: "bun", required: true, ready: true, repair: null }],
  next: "Start a new session in this project.",
};

const installedText = [
  "Agent guide saved at /project/.agents/skills/titan/SKILL.md",
  "Titan MCP connection is registered.",
  "Local meaning model local-model is ready.",
  "bun is ready.",
  "Start a new session in this project.",
].join("\n");

const doctor = {
  model: installation.model,
  harness: "claude (environment)",
  tools: { claude: "command found, sdk found" },
  prerequisites: installation.prerequisites,
  bun: "1.3.10",
  node: null,
  codex: null,
  claude: "/bin/claude",
  home: "/home/titan",
  project: "/project",
  live_checks: "not run",
  supported: ["claude-sdk (experimental)"],
};

const doctorText = [
  "Titan home is /home/titan",
  "Project is /project",
  "Selected agent is claude (environment)",
  "bun 1.3.10",
  "node was not found",
  "codex was not found",
  "claude /bin/claude",
  "claude command found, sdk found",
  "bun is ready.",
  "Local meaning model local-model is ready.",
  "Live backend checks not run.",
  "Available backends claude-sdk (experimental)",
].join("\n");

const backup = {
  backup: {
    schema_version: 1,
    version: "0.1.0-alpha.1",
    created_at: 1,
    roots: [
      { source: "/home/titan", copy: "home", digest: "a".repeat(64), identity: "b".repeat(64) },
    ],
  },
  catalog: { projects: ["/project"], runs: ["run"] },
};

const run = {
  run_id: "run",
  workflow_id: "workflow",
  client_id: "caller",
  submission_id: "submission",
  harness_session_id: "conversation",
  state: RunStatus.Blocked,
  root: "/kept/run",
  artifacts: null,
  nodes: {},
};
const page = {
  schema_version: BoardLimit.EventPageVersion,
  run_id: "run",
  after: 0,
  events: [{ id: 1, time: 1, type: "created", data: null }],
  next_cursor: 1,
  has_more: true,
};
const envelope = {
  schema_version: CliOutput.Version,
  operation: CliCommand.Events,
  identifiers: {
    run_id: "run",
    workflow_id: null,
    client_id: null,
    submission_id: null,
    harness_session_id: null,
  },
  state: null,
  data: page,
  error: null,
  events: page.events,
  after: page.after,
  next_cursor: page.next_cursor,
  has_more: page.has_more,
  truncated: true,
};

export const cliOutputRendererCases = {
  positive: [
    positive(
      "doctor explains local readiness",
      [doctor, false, CliCommand.Doctor, undefined, doctorText],
      true,
    ),
    positive("doctor JSON retains complete report", [doctor, true, CliCommand.Doctor], true),
    positive(
      "doctor retains verified backup summary",
      [
        { ...doctor, backup },
        false,
        CliCommand.Doctor,
        undefined,
        `${doctorText}\nBackup for Titan 0.1.0-alpha.1 verified. Recorded runs 1. Recorded projects 1.`,
      ],
      true,
    ),
    positive(
      "human installation gives setup instructions",
      [installation, false, CliCommand.Install, undefined, installedText],
      true,
    ),
    positive(
      "installation JSON keeps its envelope",
      [installation, true, CliCommand.Install],
      true,
    ),
    positive(
      "ordinary data uses the named operation",
      [{ version: "preview" }, true, CliOutputOperation.Version],
      true,
    ),
    positive(
      "blocked snapshot has recovery and its bounded page",
      [run, true, CliCommand.Run, page],
      true,
    ),
    positive(
      "blocked reason is preserved",
      [{ ...run, error: "Credentials absent" }, true, CliCommand.Status, page],
      true,
    ),
    positive("finite event query carries its ordered page", [page, true, CliCommand.Events], true),
    positive("undefined result has explicit null data", [undefined, true, CliCommand.Config], true),
  ],
  negative: [
    rejected(
      "doctor explains missing optional prerequisites",
      [
        {
          ...doctor,
          model: { ...doctor.model, ready: false },
          prerequisites: [{ name: "z3", required: false, ready: false, repair: null }],
        },
        false,
        CliCommand.Doctor,
        undefined,
        doctorText
          .replace("bun is ready.", "z3 needs setup. Check its installation.")
          .replace(
            "Local meaning model local-model is ready.",
            "Local meaning model needs setup. Run titan doctor --fetch-model with the same --home option.",
          ),
      ],
      true,
    ),
    rejected(
      "malformed doctor data stays inspectable",
      [{ home: "/incomplete" }, false, CliCommand.Doctor],
      true,
    ),
    rejected(
      "unavailable native command stays visible",
      [
        {
          ...installation,
          mcp: "claude was not found",
          prerequisites: [
            { name: "claude", required: false, ready: false, repair: "Install Claude Code" },
          ],
        },
        false,
        CliCommand.Install,
        undefined,
        installedText
          .replace("Titan MCP connection is registered.", "claude was not found")
          .replace("bun is ready.", "claude needs setup. Install Claude Code"),
      ],
      true,
    ),
    rejected(
      "missing model gives repair instructions",
      [
        {
          ...installation,
          model: { ...installation.model, ready: false, missing: ["config.json"] },
        },
        false,
        CliCommand.Install,
        undefined,
        installedText.replace(
          "Local meaning model local-model is ready.",
          "Local meaning model needs setup. Run titan doctor --fetch-model with the same --home option.",
        ),
      ],
      true,
    ),
    rejected(
      "malformed install data stays inspectable",
      [{ installed: "incomplete" }, false, CliCommand.Install],
      true,
    ),
    rejected(
      "other commands preserve structured output",
      [installation, false, CliCommand.Doctor],
      true,
    ),
    rejected(
      "serve readiness retains its protocol object",
      [{ ready: true }, true, CliCommand.Serve],
      true,
    ),
    rejected("human text remains a diagnostic line", ["Ready", false, CliCommand.Check], true),
    rejected(
      "unframed renderer call keeps its direct JSON contract",
      [{ ready: true }, true],
      true,
    ),
  ],
};

export const cliOutputOperationCases = {
  positive: [
    positive("version has its own operation", [["--version"]], CliOutputOperation.Version),
    positive("empty invocation is help", [[]], CliOutputOperation.Help),
    positive(
      "nested command retains its full name",
      [[CliCommand.Knowledge, "get", "entry"]],
      "kb get",
    ),
  ],
  negative: [
    rejected(
      "invalid options have a bounded unknown operation",
      [["--unknown"]],
      CliOutputOperation.Unknown,
    ),
    rejected(
      "oversized unknown command is not copied into output",
      [["x".repeat(CliOutput.OperationCharacters + 1)]],
      CliOutputOperation.Unknown,
    ),
  ],
};

export const cliOutputContractCases = {
  positive: [
    positive("bounded event page is coherent", [envelope], true),
    positive(
      "complete event page discloses no truncation",
      [{ ...envelope, has_more: false, truncated: false }],
      true,
    ),
  ],
  negative: [
    rejected(
      "unsupported envelope version fails",
      [{ ...envelope, schema_version: CliOutput.Version + 1 }],
      false,
    ),
    rejected("crossed event cursor fails", [{ ...envelope, next_cursor: 2 }], false),
    rejected("hidden truncation fails", [{ ...envelope, truncated: false }], false),
    rejected("omitted data fails", [{ ...envelope, data: undefined }], false),
    rejected("events without page metadata fail", [{ ...envelope, after: null }], false),
  ],
};

export const cliOutputFailureCases = {
  positive: [
    positive(
      "uncertain submission retains retry identity",
      [
        new SubmissionUncertainError("caller", "submission", "/home/receipts", "Response lost"),
        CliCommand.Run,
      ],
      {
        code: ErrorCode.SubmissionUncertain,
        retryable: true,
        action: CliRecoveryAction.RetrySubmission,
        run_id: null,
        submission_id: "submission",
        state: null,
      },
    ),
    positive(
      "observation failure retains its selected run",
      [
        new RunObservationError(
          "run",
          new TitanError(ErrorCode.ServerUnavailable, "Unavailable", ExitCode.Transport),
        ),
        CliCommand.Status,
      ],
      {
        code: ErrorCode.ServerUnavailable,
        retryable: true,
        action: CliRecoveryAction.Observe,
        run_id: "run",
        submission_id: null,
        state: null,
      },
    ),
    positive(
      "retryable operational error retains its policy",
      [new OperationalError(ErrorCode.RateLimited, "Wait", true), CliCommand.Run],
      {
        code: ErrorCode.RateLimited,
        retryable: true,
        action: null,
        run_id: null,
        submission_id: null,
        state: null,
      },
    ),
  ],
  negative: [
    rejected(
      "input failure grants no blind retry",
      [
        new TitanError(ErrorCode.Arguments, "Invalid", ExitCode.Input, ["steps.0.do"]),
        CliCommand.Run,
      ],
      {
        code: ErrorCode.Arguments,
        retryable: false,
        action: null,
        run_id: null,
        submission_id: null,
        state: null,
      },
    ),
    rejected(
      "unidentified transport mutation grants no retry",
      [
        new TitanError(ErrorCode.ServerUnavailable, "Unavailable", ExitCode.Transport),
        CliCommand.Run,
      ],
      {
        code: ErrorCode.ServerUnavailable,
        retryable: false,
        action: null,
        run_id: null,
        submission_id: null,
        state: null,
      },
    ),
    rejected(
      "unknown thrown value cannot claim a failed run",
      ["Unexpected", CliOutputOperation.Unknown],
      {
        code: "error",
        retryable: false,
        action: null,
        run_id: null,
        submission_id: null,
        state: null,
      },
    ),
  ],
};
