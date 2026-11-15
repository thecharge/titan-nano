import {
  DependencyReadFixture,
  ErrorCode,
  HookCheckCommands,
  HookLimit,
  HookRevisionFixture,
  HookSnapshotFixture,
} from "@titan/constants";
import { HookMessage } from "@titan/messages";
import { negative, positive, rejected } from "@titan/test-factories";

const zero = "0".repeat(40);
const object = "a".repeat(40);

export const pushInputCases = {
  positive: [
    positive(
      "branch update",
      [`refs/heads/main ${object} refs/heads/main ${object}\n`],
      [
        {
          localRef: "refs/heads/main",
          localObject: object,
          remoteRef: "refs/heads/main",
          remoteObject: object,
        },
      ],
    ),
    positive(
      "branch deletion",
      [`(delete) ${zero} refs/heads/topic ${object}\n`],
      [
        {
          localRef: "(delete)",
          localObject: zero,
          remoteRef: "refs/heads/topic",
          remoteObject: object,
        },
      ],
    ),
  ],
  negative: [
    negative("malformed field count", ["refs/heads/main invalid"], {
      message: "Git supplied an invalid push update",
    }),
    negative("invalid object", [`refs/heads/main invalid refs/heads/main ${zero}`], {
      name: "ZodError",
    }),
    negative("option in place of reference", [`--exec ${object} refs/heads/main ${zero}`], {
      name: "ZodError",
    }),
  ],
};

export const hookSnapshotCases = {
  positive: [
    positive("unstaged fix cannot change staged content", [HookSnapshotFixture.StagedContent], {
      result: "staged",
      cleaned: true,
      indexUnchanged: true,
      working: "unstaged",
    }),
    positive("staged deletion survives unstaged recreation", [HookSnapshotFixture.StagedDeletion], {
      result: null,
      cleaned: true,
      indexUnchanged: true,
      working: "unstaged",
    }),
  ],
  negative: [
    negative("tracked symbolic link cannot escape snapshot", [HookSnapshotFixture.SymbolicLink], {
      message: "Hook snapshots do not accept tracked symbolic links or submodules",
    }),
    negative(
      "failed checker cannot produce a successful result",
      [HookSnapshotFixture.CallbackFailure],
      { message: "snapshot callback failed" },
    ),
  ],
};

export const hookRevisionCases = {
  positive: [
    positive("earlier outgoing defects remain in inventory", [HookRevisionFixture.Range], [1, 2]),
    positive(
      "new branch conservatively includes history",
      [HookRevisionFixture.NewBranch],
      [0, 1, 2],
    ),
    positive("branch deletion has no content to certify", [HookRevisionFixture.Deletion], []),
  ],
  negative: [
    negative(
      "unavailable remote cannot silently narrow checks",
      [HookRevisionFixture.MissingRemote],
      {
        message:
          "The advertised remote commit is unavailable locally. Fetch the remote, then retry.",
      },
    ),
    negative("unvalidated revision is rejected", [HookRevisionFixture.InvalidLocal], {
      name: "ZodError",
    }),
  ],
};

export const hookDependencyCases = {
  positive: [
    positive("workspace source resolves inside exported snapshot", [false, "1.0.0", true], {
      local: true,
      external: true,
    }),
    positive("pinned external dependency resolves to prepared cache", [false, "1.0.0", false], {
      local: true,
      external: true,
    }),
    positive(
      "older outgoing commit with changed version uses installed tools",
      [false, "2.0.0", false, DependencyReadFixture.Normal, false],
      { local: true, external: true },
    ),
    positive(
      "older outgoing commit with changed lock uses installed tools",
      [true, "1.0.0", false, DependencyReadFixture.Normal, false],
      { local: true, external: true },
    ),
  ],
  negative: [
    negative(
      "tip commit with changed version still requires preparation",
      [false, "2.0.0", false, DependencyReadFixture.Normal, true],
      { message: HookMessage.MissingDependencies },
    ),
    negative(
      "tip commit with changed lock still requires preparation",
      [true, "1.0.0", false, DependencyReadFixture.Normal, true],
      { message: HookMessage.MissingDependencies },
    ),
    negative("root lock read is bounded", [false, "1.0.0", false, DependencyReadFixture.RootLock], {
      code: ErrorCode.StreamLimit,
    }),
    negative(
      "snapshot lock read is bounded",
      [false, "1.0.0", false, DependencyReadFixture.SnapshotLock],
      { code: ErrorCode.StreamLimit },
    ),
    negative(
      "cache manifest read is bounded",
      [false, "1.0.0", false, DependencyReadFixture.CachedManifest],
      { message: HookMessage.MissingDependencies },
    ),
    negative("changed lock requires explicit dependency preparation", [true, "1.0.0", false], {
      message:
        "Hook dependencies are missing or changed. Run bun install --frozen-lockfile, then retry.",
    }),
    negative("installed version cannot substitute for pinned version", [false, "2.0.0", false], {
      message:
        "Hook dependencies are missing or changed. Run bun install --frozen-lockfile, then retry.",
    }),
  ],
};

export const outgoingTipCases = {
  positive: [
    positive("newest outgoing commit is the tip", [["a", "b", "c"], "c"], true),
    positive("only outgoing commit is the tip", [["a"], "a"], true),
  ],
  negative: [
    rejected("oldest of several outgoing commits is not the tip", [["a", "b", "c"], "a"], false),
    rejected("middle outgoing commit is not the tip", [["a", "b", "c"], "b"], false),
    rejected("empty range has no tip", [[], "a"], false),
    rejected("unrelated commit is never the tip", [["a"], "z"], false),
  ],
};

export const hookSecretCases = {
  positive: [
    positive("ordinary tracked file", ["entry.txt", false], 0),
    positive("ignored tracked file without secrets", [".env", false], 0),
  ],
  negative: [
    rejected("force-added ignored file is still scanned", [".env", true], 1),
    rejected(
      "option-shaped filename cannot change scanner arguments",
      ["--output=result.json", true],
      1,
    ),
  ],
};

export const hookMessageCases = {
  positive: [
    positive("conventional subject", ["fix: retain workflow progress", false], 0),
    positive(
      "scoped subject with body",
      ["feat(engine): recover interrupted work\n\nKeep the same attempt.", false],
      0,
    ),
  ],
  negative: [
    rejected("nonconventional subject", ["updated stuff", false], 1),
    rejected(
      "valid subject cannot hide a secret in its body",
      ["fix: retain workflow progress", true],
      1,
    ),
  ],
};

export const hookGateCases = {
  positive: [
    positive("all registered checks execute", [null, "entry.txt", false], {
      code: 0,
      complete: true,
      stages: HookCheckCommands.length,
    }),
    positive("safe ignored file does not change gate selection", [null, ".env", false], {
      code: 0,
      complete: true,
      stages: HookCheckCommands.length,
    }),
  ],
  negative: [
    rejected("failed document links cannot produce success", ["check:links", "entry.txt", false], {
      code: 1,
      complete: false,
      stages: 17,
    }),
    rejected(
      "package metadata policy cannot fail silently",
      ["check:package-policy", "entry.txt", false],
      { code: 1, complete: false, stages: 14 },
    ),
    rejected(
      "failed strict configuration policy cannot produce success",
      ["check:typescript-policy", "entry.txt", false],
      { code: 1, complete: false, stages: 3 },
    ),
    rejected(
      "failed unused-code check cannot produce success",
      ["check:unused", "entry.txt", false],
      { code: 1, complete: false, stages: 12 },
    ),
    rejected("failed type check cannot produce success", ["typecheck", "entry.txt", false], {
      code: 1,
      complete: false,
      stages: 2,
    }),
    rejected(
      "failed documentation formatting cannot produce success",
      ["check:format:docs", "entry.txt", false],
      {
        code: 1,
        complete: false,
        stages: 8,
      },
    ),
    rejected("failed spelling cannot produce success", ["check:spelling", "entry.txt", false], {
      code: 1,
      complete: false,
      stages: 9,
    }),
    rejected("failed offline tests cannot produce success", ["test", "entry.txt", false], {
      code: 1,
      complete: true,
      stages: HookCheckCommands.length,
    }),
    rejected(
      "failed async filesystem check cannot produce success",
      ["check:async-fs", "entry.txt", false],
      {
        code: 1,
        complete: false,
        stages: 11,
      },
    ),
    rejected("secret stops diagnostics before source can be displayed", [null, ".env", true], {
      code: 1,
      complete: false,
      stages: 0,
    }),
  ],
};

export const hookMessageFileCases = {
  positive: [
    positive("empty message is preserved for semantic validation", [0, true], 0),
    positive("message spans stream chunks", [131_073, true], 131_073),
  ],
  negative: [
    negative("missing input cannot certify an empty message", [0, false], { code: "ENOENT" }),
    negative("oversized input stops at the bounded byte limit", [HookLimit.OutputBytes + 1, true], {
      message: "Hook command exceeded its bounded output limit",
    }),
  ],
};

export const hookVerificationEnvironmentCases = {
  positive: [
    positive("unset development mode runs complete verification", [undefined], 0),
    positive("empty development mode runs complete verification", [""], 0),
  ],
  negative: [
    rejected("inherited fast mode cannot omit required coverage", ["1"], 0),
    rejected("other inherited development flags are cleared", ["other"], 0),
    rejected("failed full verification propagates its status", ["1", 1], 1),
    rejected("a distinct verification failure is preserved", [undefined, 7], 7),
  ],
};
