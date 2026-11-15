import { CliInvocationKind, ConfigScope, ErrorCode } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const configShowInvocationCases = {
  positive: [
    positive(
      "frozen configuration keeps its run and source selectors",
      [["config", "show", "--run-id", "run-one", "--sources"]],
      { kind: CliInvocationKind.Command, name: "config show", argument: undefined },
    ),
    positive(
      "frozen configuration accepts explicit home and JSON",
      [["config", "show", "--run-id", "run-two", "--home", "/tmp/home", "--json"]],
      { kind: CliInvocationKind.Command, name: "config show", argument: undefined },
    ),
    positive(
      "project scope selects current file settings",
      [["config", "show", "--scope", "project", "--project", "/tmp/project", "--sources"]],
      { kind: CliInvocationKind.Command, name: "config show", argument: undefined },
    ),
    positive("user scope selects owner settings", [["config", "show", "--scope", "user"]], {
      kind: CliInvocationKind.Command,
      name: "config show",
      argument: undefined,
    }),
  ],
  negative: [
    negative("missing run selector is refused", [["config", "show"]], {
      code: ErrorCode.Arguments,
    }),
    negative("unsafe run selector is refused", [["config", "show", "--run-id", "../other"]], {
      code: ErrorCode.InvalidId,
    }),
    negative(
      "frozen configuration refuses changed setting overrides",
      [["config", "show", "--run-id", "run-one", "--set", "limits.max_parallel=2"]],
      { code: ErrorCode.Arguments },
    ),
    negative(
      "frozen configuration refuses a replacement backend",
      [["config", "show", "--run-id", "run-one", "--backend", "fake"]],
      { code: ErrorCode.Arguments },
    ),
    negative("unknown scope is refused", [["config", "show", "--scope", "other"]], {
      code: ErrorCode.Arguments,
    }),
    negative(
      "run and file scope cannot be combined",
      [["config", "show", "--run-id", "run", "--scope", "user"]],
      {
        code: ErrorCode.Arguments,
      },
    ),
    negative(
      "run and project cannot be combined",
      [["config", "show", "--run-id", "run", "--project", "/tmp/project"]],
      {
        code: ErrorCode.Arguments,
      },
    ),
  ],
};

export const scopedConfigShowCases = {
  positive: [
    positive(
      "owner inspection excludes the project layer",
      [ConfigScope.User, true, false, false],
      true,
    ),
    positive(
      "project inspection retains inherited sources",
      [ConfigScope.Project, false, false, false],
      true,
    ),
    positive("absent owner file remains absent", [ConfigScope.User, false, false, true], true),
    positive(
      "absent project file retains owner settings",
      [ConfigScope.Project, true, false, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "invalid owner file is refused without replacement",
      [ConfigScope.User, true, true, false],
      true,
    ),
    rejected(
      "invalid project file is refused without replacement",
      [ConfigScope.Project, false, true, false],
      true,
    ),
  ],
};
