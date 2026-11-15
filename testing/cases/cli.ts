import { Backend, CliCommand, CliInvocationKind, ErrorCode } from "@titan/constants";
import { hash } from "@titan/core";
import { negative, positive, rejected } from "@titan/test-factories";

export const cliObservationCases = {
  positive: [
    positive("run observes completion by default", [["run", "workflow.yaml"]], {
      watch: true,
      detach: false,
    }),
    positive("explicit watch keeps observation", [["run", "workflow.yaml", "--watch"]], {
      watch: true,
      detach: false,
    }),
    positive("detach returns accepted work", [["run", "workflow.yaml", "--detach"]], {
      watch: false,
      detach: true,
    }),
    positive("dry run starts no observer", [["run", "workflow.yaml", "--dry-run"]], {
      watch: null,
      detach: false,
    }),
  ],
  negative: [
    negative(
      "watch and detach conflict before execution",
      [["run", "workflow.yaml", "--watch", "--detach"]],
      { code: ErrorCode.Arguments },
    ),
    negative(
      "dry run and detach conflict before execution",
      [["run", "workflow.yaml", "--dry-run", "--detach"]],
      { code: ErrorCode.Arguments },
    ),
    negative("detach is not a query flag", [["status", "run-one", "--detach"]], {
      code: ErrorCode.Arguments,
    }),
    negative("detach is not a recovery flag", [["resume", "run-one", "--detach"]], {
      code: ErrorCode.Arguments,
    }),
  ],
};

export const invocationCases = {
  positive: [
    positive(
      "release check accepts home and JSON selectors",
      [["update", "--check", "--home", "/tmp/titan", "--json"]],
      { kind: CliInvocationKind.Command, name: "update", argument: undefined },
    ),
    positive("release check help stays offline", [["update", "--help"]], {
      kind: CliInvocationKind.CommandHelp,
    }),
    positive(
      "knowledge history accepts an explicit project cursor",
      [
        [
          "kb",
          "show",
          "00000000-0000-4000-8000-000000000001",
          "--scope",
          "project",
          "--before",
          "3",
          "--limit",
          "1",
        ],
      ],
      {
        kind: CliInvocationKind.Command,
        name: "kb show",
        argument: "00000000-0000-4000-8000-000000000001",
      },
    ),
    positive(
      "knowledge history accepts a home cursor",
      [
        [
          "kb",
          "show",
          "00000000-0000-4000-8000-000000000001",
          "--scope",
          "home",
          "--before",
          "1",
          "--limit",
          "200",
        ],
      ],
      {
        kind: CliInvocationKind.Command,
        name: "kb show",
        argument: "00000000-0000-4000-8000-000000000001",
      },
    ),

    positive(
      "scripted fake accepts harness selection",
      [["run", "workflow.yaml", "--harness", "fake", "--fake-script", "answers.yaml"]],
      {
        kind: CliInvocationKind.Command,
        name: "run",
        argument: "workflow.yaml",
      },
    ),
    positive(
      "check accepts the Codex harness alias",
      [["check", "workflow.yaml", "--harness", "codex"]],
      {
        kind: CliInvocationKind.Command,
        name: "check",
        argument: "workflow.yaml",
      },
    ),
    positive("usage requires an exact run", [["usage", "run-one"]], {
      kind: CliInvocationKind.Command,
      name: "usage",
      argument: "run-one",
    }),
    positive(
      "usage retains home and machine output",
      [["usage", "run-two", "--home", "/tmp/home", "--json"]],
      { kind: CliInvocationKind.Command, name: "usage", argument: "run-two" },
    ),
    positive(
      "run accepts repeated typed settings",
      [
        [
          "run",
          "workflow.yaml",
          "--set",
          "limits.max_parallel=2",
          "--set",
          "recovery.max_retries=0",
        ],
      ],
      { kind: CliInvocationKind.Command, name: "run", argument: "workflow.yaml" },
    ),
    positive("config accepts run setting overrides", [["config", "--set", "limits.max_steps=4"]], {
      kind: CliInvocationKind.Command,
      name: "config",
      argument: undefined,
    }),
    positive(
      "export selects an absolute new output",
      [["artifacts", "export", "run-one", hash("source.txt"), "--output", "/tmp/review"]],
      { kind: CliInvocationKind.Command, name: "artifacts export", argument: "run-one" },
    ),
    positive(
      "export retains explicit home and JSON selectors",
      [
        [
          "artifacts",
          "export",
          "run-two",
          hash("report.txt"),
          "--output",
          "/tmp/report review",
          "--home",
          "/tmp/home",
          "--json",
        ],
      ],
      { kind: CliInvocationKind.Command, name: "artifacts export", argument: "run-two" },
    ),
    positive("nested artifact list resolves from the catalog", [["artifacts", "list", "run-one"]], {
      kind: CliInvocationKind.Command,
      name: "artifacts list",
      argument: "run-one",
    }),
    positive(
      "nested artifact show retains a run selector",
      [["artifacts", "show", "run-one", hash("source.txt"), "--offset", "1", "--limit", "2"]],
      { kind: CliInvocationKind.Command, name: "artifacts show", argument: "run-one" },
    ),
    positive("explicit run selector", [["status", "run-one", "--watch"]], {
      kind: CliInvocationKind.Command,
      name: "status",
      argument: "run-one",
    }),
    positive("update accepts managed release installation", [["update"]], {
      kind: CliInvocationKind.Command,
      name: "update",
      argument: undefined,
    }),
    positive("update accepts a local package", [["update", "--from", "package.tgz"]], {
      kind: CliInvocationKind.Command,
      name: "update",
      argument: undefined,
    }),
    positive("version without a command", [["--version", "--json"]], {
      kind: CliInvocationKind.Version,
    }),
  ],
  negative: [
    negative("release discovery refuses forced installation", [["update", "--check", "--force"]], {
      code: ErrorCode.Arguments,
    }),
    negative(
      "release discovery refuses a package selector",
      [["update", "--check", "--from", "package.tgz"]],
      { code: ErrorCode.Arguments },
    ),
    negative(
      "history refuses a zero cursor before service access",
      [["kb", "show", "00000000-0000-4000-8000-000000000001", "--before", "0"]],
      { code: ErrorCode.Arguments },
    ),
    negative(
      "history refuses a fractional cursor before service access",
      [["kb", "show", "00000000-0000-4000-8000-000000000001", "--before", "1.5"]],
      { code: ErrorCode.Arguments },
    ),
    negative(
      "history refuses an excessive page before service access",
      [["kb", "show", "00000000-0000-4000-8000-000000000001", "--limit", "201"]],
      { code: ErrorCode.Arguments },
    ),
    negative(
      "history refuses a crossed scope before service access",
      [["kb", "show", "00000000-0000-4000-8000-000000000001", "--scope", "other"]],
      { code: ErrorCode.Arguments },
    ),

    negative(
      "conflicting backend selectors are refused",
      [["run", "workflow.yaml", "--backend", "fake", "--harness", "codex"]],
      { code: ErrorCode.Arguments },
    ),
    negative(
      "unknown workflow harness is refused",
      [["run", "workflow.yaml", "--harness", "unknown"]],
      { code: ErrorCode.Backend },
    ),
    negative(
      "set cannot replace harness selection",
      [["run", "workflow.yaml", "--harness", "fake", "--set", "defaults.backend=codex"]],
      { code: ErrorCode.Arguments },
    ),
    negative("usage cannot infer a run", [["usage"]], { code: ErrorCode.Arguments }),
    negative("usage cannot ignore another run", [["usage", "one", "two"]], {
      code: ErrorCode.Arguments,
    }),
    negative("usage cannot accept watch", [["usage", "one", "--watch"]], {
      code: ErrorCode.Arguments,
    }),
    negative("usage cannot change backend", [["usage", "one", "--backend", "fake"]], {
      code: ErrorCode.Arguments,
    }),
    negative(
      "owner settings fail in parser",
      [["run", "workflow.yaml", "--set", "server.max_active_agents=2"]],
      { code: ErrorCode.Arguments },
    ),
    negative(
      "invalid typed setting fails in parser",
      [["check", "workflow.yaml", "--set", "limits.max_parallel=zero"]],
      { code: ErrorCode.Arguments },
    ),
    negative(
      "run setting rejects companion collision",
      [["run", "workflow.yaml", "--max-parallel", "2", "--set", "limits.max_parallel=3"]],
      { code: ErrorCode.Arguments },
    ),
    negative(
      "status rejects irrelevant setting override",
      [["status", "run", "--set", "limits.max_parallel=2"]],
      { code: ErrorCode.Arguments },
    ),
    negative(
      "export requires explicit output before client work",
      [["artifacts", "export", "run-one", hash("source.txt")]],
      { code: ErrorCode.Arguments },
    ),
    negative(
      "export refuses relative output before client work",
      [["artifacts", "export", "run-one", hash("source.txt"), "--output", "relative"]],
      { code: ErrorCode.Arguments },
    ),
    negative(
      "export refuses an extra positional selector",
      [["artifacts", "export", "run-one", hash("source.txt"), "extra", "--output", "/tmp/review"]],
      { code: ErrorCode.Arguments },
    ),
    negative(
      "file inspection does not accept export output",
      [["artifacts", "show", "run-one", hash("source.txt"), "--output", "/tmp/review"]],
      { code: ErrorCode.Arguments },
    ),
    negative("show needs its file identifier", [["artifacts", "show", "run-one"]], {
      code: ErrorCode.Arguments,
    }),
    negative("show refuses a path as identifier", [["artifacts", "show", "run-one", "../file"]], {
      code: ErrorCode.Arguments,
    }),
    negative(
      "show validates ranges before client work",
      [["artifacts", "show", "run-one", hash("source.txt"), "--limit", "0"]],
      { code: ErrorCode.ArtifactRange },
    ),
    negative(
      "list refuses show-only options",
      [["artifacts", "list", "run-one", "--offset", "1"]],
      { code: ErrorCode.Arguments },
    ),
    negative("unknown raw option", [["--not-a-titan-option"]], { code: ErrorCode.Arguments }),
    negative("missing option value", [["run", "workflow.yaml", "--backend"]], {
      code: ErrorCode.Arguments,
    }),
    negative("positional values cannot begin with an option", [["status", "--home"]], {
      code: ErrorCode.Arguments,
    }),
  ],
};

export const catalogContractCases = {
  positive: Object.values(CliCommand).map((name) =>
    positive(`preserves ${name} public metadata`, [name], true),
  ),
  negative: [
    rejected("prototype constructor is not a command", ["constructor"], true),
    rejected("prototype mutation key is not a command", ["__proto__"], true),
  ],
};

export const cliBackendCases = {
  positive: [
    positive(
      "Codex harness uses the Codex backend",
      [["check", "workflow.yaml", "--harness", "codex"]],
      Backend.Codex,
    ),
    positive(
      "Claude harness uses the Claude backend",
      [["check", "workflow.yaml", "--harness", "claude"]],
      Backend.Claude,
    ),
  ],
  negative: [
    negative(
      "unknown harness cannot select a backend",
      [["check", "workflow.yaml", "--harness", "other"]],
      { code: ErrorCode.Backend },
    ),
    negative(
      "two selectors cannot choose different backends",
      [["check", "workflow.yaml", "--harness", "codex", "--backend", "fake"]],
      { code: ErrorCode.Arguments },
    ),
  ],
};
