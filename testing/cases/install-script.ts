import { resolve } from "node:path";
import { negative, positive, rejected } from "@titan/test-factories";

const AssertionFailure = { code: "ERR_ASSERTION" };
const FailingScript = resolve(import.meta.dir, "../fixtures/exit-one.sh");
const EmptyScript = "/dev/null";

export const installScriptCases = {
  positive: [
    positive("Bun absent: exit 2, names bun and offers --install-bun", [null, false], {
      namesBun: true,
      namesGit: true,
      offersFlag: true,
    }),
    positive("Git absent: exit 2 and names git", [null, true], {
      namesBun: false,
      namesGit: true,
      offersFlag: false,
    }),
  ],
  negative: [
    negative("a script that exits 1 is not accepted", [FailingScript, false], AssertionFailure),
    negative("a script that exits 0 is not accepted", [EmptyScript, false], AssertionFailure),
  ],
};

export const installBootstrapCases = {
  positive: [
    positive(
      "one command installs Titan and connects Codex in the caller project",
      ["setup-codex"],
      { code: 0, preserved: true },
    ),
    positive("one command installs Titan and connects Claude", ["setup-claude"], {
      code: 0,
      preserved: true,
    }),
    positive("both agents receive the selected project with spaces", ["setup-both"], {
      code: 0,
      preserved: true,
    }),
    positive("a relative destination resolves from the caller directory", ["relative-target"], {
      code: 0,
      preserved: true,
    }),
    positive("concurrent installations retain archives in the shared source", ["concurrent"], {
      code: 0,
      preserved: true,
    }),
    positive("a legacy managed launcher switches after the staged checks pass", ["legacy"], {
      code: 0,
      preserved: true,
    }),
    positive("a fresh installation creates a private manifest", ["fresh"], {
      code: 0,
      preserved: true,
    }),
    positive("reinstallation keeps the managed launcher working", ["repeat"], {
      code: 0,
      preserved: true,
    }),
    positive("the default installation has a working launcher", ["default"], {
      code: 0,
      preserved: true,
    }),
    positive("an abandoned legacy directory lock cannot block installation", ["stale-install"], {
      code: 0,
      preserved: true,
    }),
    positive("a killed first installer releases ownership before retry", ["killed-install"], {
      code: 0,
      preserved: true,
    }),
    positive(
      "a killed reinstall retains its launcher and releases ownership",
      ["killed-reinstall"],
      {
        code: 0,
        preserved: true,
      },
    ),
    positive("a chosen folder with spaces preserves the caller directory", ["spaces"], {
      code: 0,
      preserved: true,
    }),
  ],
  negative: [
    rejected("failed agent setup retains the installed launcher for retry", ["setup-failure"], {
      code: 1,
      preserved: true,
    }),
    rejected("an unknown agent fails before installation", ["setup-invalid"], {
      code: 2,
      preserved: true,
    }),
    rejected("an omitted agent value fails before installation", ["missing-harness"], {
      code: 2,
      preserved: true,
    }),
    rejected("a project selector requires an agent selection", ["project-without-harness"], {
      code: 2,
      preserved: true,
    }),
    rejected("an absent selected project fails before installation", ["missing-project"], {
      code: 2,
      preserved: true,
    }),
    rejected("repeated agent selectors fail before installation", ["repeated-harness"], {
      code: 2,
      preserved: true,
    }),
    rejected("an existing user command file survives installation", ["command-file"], {
      code: 0,
      preserved: true,
    }),
    rejected("an existing user command link survives installation", ["command-link"], {
      code: 0,
      preserved: true,
    }),
    rejected("failed installation checks retain the previous working release", ["repeat-failure"], {
      code: 1,
      preserved: true,
    }),
    rejected("failed first installation checks cannot publish a launcher", ["doctor-failure"], {
      code: 1,
      preserved: true,
    }),
    rejected("failed package installation cannot publish a launcher", ["add-failure"], {
      code: 1,
      preserved: true,
    }),
    rejected("another install owner retains its lock", ["held-install"], {
      code: 2,
      preserved: true,
    }),
    rejected("a linked release folder cannot redirect installation", ["linked-releases"], {
      code: 2,
      preserved: true,
    }),
    rejected("an existing user launcher is preserved", ["collision"], { code: 2, preserved: true }),
    rejected("unknown options fail before installation", ["unknown-option"], {
      code: 2,
      preserved: true,
    }),
    rejected("multiple targets fail before installation", ["multiple-targets"], {
      code: 2,
      preserved: true,
    }),
    rejected("invalid tool versions are refused", ["invalid-version"], {
      code: 2,
      preserved: true,
    }),
    rejected("a failed build cannot install a launcher", ["build-failure"], {
      code: 1,
      preserved: true,
    }),
    rejected("ambiguous build archives are refused", ["multiple-archives"], {
      code: 1,
      preserved: true,
    }),
  ],
};
