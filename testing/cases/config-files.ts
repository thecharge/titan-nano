import { ConfigScope, ErrorCode } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const configFileReadCases = {
  positive: [
    positive("existing owner configuration has a version", [ConfigScope.User, "file"], true),
    positive("existing project configuration has a version", [ConfigScope.Project, "file"], true),
    positive("missing owner configuration is a new document", [ConfigScope.User, "missing"], true),
    positive(
      "missing project configuration is a new document",
      [ConfigScope.Project, "missing"],
      true,
    ),
  ],
  negative: [
    negative(
      "owner configuration directory retains its read error",
      [ConfigScope.User, "directory"],
      { code: "EISDIR" },
    ),
    negative(
      "project configuration directory retains its read error",
      [ConfigScope.Project, "directory"],
      { code: "EISDIR" },
    ),
    negative("owner configuration link loop retains its read error", [ConfigScope.User, "loop"], {
      code: "ELOOP",
    }),
    negative(
      "project configuration link loop retains its read error",
      [ConfigScope.Project, "loop"],
      { code: "ELOOP" },
    ),
  ],
};

export const configFileEditCases = {
  positive: [
    positive(
      "owner can change native capacity",
      [ConfigScope.User, "server.max_active_agents", "2"],
      { error: null, changed: true },
    ),
    positive(
      "project can change workflow parallelism",
      [ConfigScope.Project, "limits.max_parallel", "2"],
      { error: null, changed: true },
    ),
  ],
  negative: [
    rejected(
      "project cannot enlarge inherited request capacity",
      [ConfigScope.Project, "requests.max_per_run", "3"],
      { error: ErrorCode.InvalidConfig, changed: false },
    ),
    rejected(
      "project cannot lower inherited human approval",
      [ConfigScope.Project, "approvals.tool", "main"],
      { error: ErrorCode.InvalidConfig, changed: false },
    ),
    rejected(
      "project cannot acquire owner capacity",
      [ConfigScope.Project, "server.max_active_agents", "2"],
      { error: ErrorCode.OwnerSetting, changed: false },
    ),
    rejected(
      "invalid count preserves the prior file",
      [ConfigScope.User, "limits.max_parallel", "0"],
      { error: ErrorCode.InvalidConfig, changed: false },
    ),
    rejected(
      "unsafe property cannot enter the file",
      [ConfigScope.User, "constructor.prototype", "{}"],
      { error: ErrorCode.InvalidConfig, changed: false },
    ),
    rejected("invalid setting name preserves the file", [ConfigScope.Project, "bad-name", "1"], {
      error: ErrorCode.Arguments,
      changed: false,
    }),
  ],
};

export const configFileConcurrencyCases = {
  positive: [
    positive("user writers share one expected version", [ConfigScope.User, false], {
      successes: 1,
      conflicts: 1,
      changed: true,
    }),
    positive("project writers share one expected version", [ConfigScope.Project, false], {
      successes: 1,
      conflicts: 1,
      changed: true,
    }),
  ],
  negative: [
    rejected("stale user writers preserve the file", [ConfigScope.User, true], {
      successes: 0,
      conflicts: 2,
      changed: false,
    }),
    rejected("stale project writers preserve the file", [ConfigScope.Project, true], {
      successes: 0,
      conflicts: 2,
      changed: false,
    }),
  ],
};

export const configFileLeaseCases = {
  positive: [
    positive("released owner lease admits another write", [ConfigScope.User, false], {
      error: null,
      changed: true,
    }),
    positive("released project lease admits another write", [ConfigScope.Project, false], {
      error: null,
      changed: true,
    }),
  ],
  negative: [
    rejected("held owner lease refuses bounded admission", [ConfigScope.User, true], {
      error: ErrorCode.ConfigLocked,
      changed: false,
    }),
    rejected("held project lease refuses bounded admission", [ConfigScope.Project, true], {
      error: ErrorCode.ConfigLocked,
      changed: false,
    }),
    rejected("corrupt lease cannot permit a write", [ConfigScope.Project, false, true], {
      error: ErrorCode.ConfigLocked,
      changed: false,
    }),
  ],
};

export const configFileBoundaryCases = {
  positive: [
    positive("a fresh owner lease admits a write", [ConfigScope.User, "fresh"], {
      error: null,
      changed: true,
    }),
    positive(
      "an existing ordinary project lease admits a write",
      [ConfigScope.Project, "existing"],
      {
        error: null,
        changed: true,
      },
    ),
  ],
  negative: [
    rejected("a symbolic owner lease preserves its target", [ConfigScope.User, "symbolic"], {
      error: ErrorCode.ConfigLocked,
      changed: false,
    }),
    rejected("a hard-linked project lease preserves its target", [ConfigScope.Project, "hard"], {
      error: ErrorCode.ConfigLocked,
      changed: false,
    }),
    rejected(
      "a symbolic lease companion preserves its target",
      [ConfigScope.User, "symbolic-companion"],
      {
        error: ErrorCode.ConfigLocked,
        changed: false,
      },
    ),
    rejected(
      "a hard-linked lease companion preserves its target",
      [ConfigScope.Project, "hard-companion"],
      {
        error: ErrorCode.ConfigLocked,
        changed: false,
      },
    ),
    rejected("a directory cannot become a writer lease", [ConfigScope.Project, "directory"], {
      error: ErrorCode.ConfigLocked,
      changed: false,
    }),
  ],
};

export const configFileArgumentCases = {
  positive: [
    positive("schema export needs no selected scope", [["config", "schema"]], {
      error: null,
      output: true,
    }),
    positive("write help needs no selected scope", [["config", "init", "--help"]], {
      error: null,
      output: true,
    }),
  ],
  negative: [
    rejected("write scope is explicit", [["config", "init"]], {
      error: ErrorCode.Arguments,
      output: false,
    }),
    rejected("unknown scope is refused", [["config", "validate", "--scope", "other"]], {
      error: ErrorCode.Arguments,
      output: false,
    }),
    rejected(
      "set requires expected version",
      [["config", "set", "limits.max_parallel", "2", "--scope", "project"]],
      { error: ErrorCode.Arguments, output: false },
    ),
    rejected(
      "malformed expected version is refused",
      [
        [
          "config",
          "set",
          "limits.max_parallel",
          "2",
          "--scope",
          "user",
          "--expected-version",
          "old",
        ],
      ],
      { error: ErrorCode.Arguments, output: false },
    ),
  ],
};
