import { Development, HookCheckScope, HookLimit } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const guide = { path: "docs/guide.md", old_mode: "100644", new_mode: "100644", kind: "M" };
const readme = {
  path: "packages/runner/README.md",
  old_mode: "100644",
  new_mode: "100644",
  kind: "M",
};
const acceptance = { ...guide, path: Development.AcceptanceMap };
export const documentationGateCases = {
  positive: [
    positive(
      "acceptance evidence retains every non-product command",
      [[acceptance.path], [acceptance]],
      {
        code: 0,
        productTests: false,
      },
    ),
    positive(
      "acceptance evidence beside prose retains all checks",
      [
        [acceptance.path, guide.path],
        [acceptance, guide],
      ],
      {
        code: 0,
        productTests: false,
      },
    ),
    positive("guide edits retain all non-product checks", [[guide.path], [guide]], {
      code: 0,
      productTests: false,
    }),
    positive("owned package README edits stay bounded", [[readme.path], [readme]], {
      code: 0,
      productTests: false,
    }),
  ],
  negative: [
    rejected(
      "invalid acceptance evidence blocks delivery",
      [[acceptance.path], [acceptance], "check:specs"],
      { code: 1, productTests: false },
    ),
    rejected(
      "acceptance evidence credentials block before commands",
      [[acceptance.path], [acceptance], null, true],
      { code: 1, productTests: false },
    ),
    rejected(
      "compiler exit two stops later source checks",
      [
        ["packages/runner/src/engine.ts"],
        [{ ...guide, path: "packages/runner/src/engine.ts" }],
        "typecheck",
        false,
        2,
      ],
      { code: 1, productTests: false },
    ),
    rejected(
      "interrupted check stops later documentation commands",
      [[guide.path], [guide], "check:docs", false, 143],
      { code: 1, productTests: false },
    ),
    rejected(
      "formatting refusal stops before later source checks",
      [
        ["packages/runner/src/engine.ts"],
        [{ ...guide, path: "packages/runner/src/engine.ts" }],
        "biome",
      ],
      { code: 1, productTests: false },
    ),
    rejected(
      "type refusal stops before later source checks",
      [
        ["packages/runner/src/engine.ts"],
        [{ ...guide, path: "packages/runner/src/engine.ts" }],
        "typecheck",
      ],
      { code: 1, productTests: false },
    ),
    rejected(
      "source comments block source delivery",
      [
        ["packages/runner/src/engine.ts"],
        [{ ...guide, path: "packages/runner/src/engine.ts" }],
        "check:source-comments",
      ],
      { code: 1, productTests: false },
    ),
    rejected(
      "source comments block documentation delivery",
      [[guide.path], [guide], "check:source-comments"],
      { code: 1, productTests: false },
    ),
    rejected(
      "package policy also blocks source delivery",
      [
        ["packages/runner/src/engine.ts"],
        [{ ...guide, path: "packages/runner/src/engine.ts" }],
        "check:package-policy",
      ],
      { code: 1, productTests: false },
    ),
    rejected(
      "package policy also blocks documentation delivery",
      [[guide.path], [guide], "check:package-policy"],
      { code: 1, productTests: false },
    ),
    rejected(
      "flat tests also block source delivery",
      [
        ["packages/runner/src/engine.ts"],
        [{ ...guide, path: "packages/runner/src/engine.ts" }],
        "check:flat-tests",
      ],
      { code: 1, productTests: false },
    ),
    rejected(
      "flat tests also block documentation delivery",
      [[guide.path], [guide], "check:flat-tests"],
      { code: 1, productTests: false },
    ),
    rejected(
      "schema ownership also blocks source delivery",
      [
        ["packages/runner/src/engine.ts"],
        [{ ...guide, path: "packages/runner/src/engine.ts" }],
        "check:schemas",
      ],
      { code: 1, productTests: false },
    ),
    rejected(
      "schema ownership also blocks documentation delivery",
      [[guide.path], [guide], "check:schemas"],
      { code: 1, productTests: false },
    ),
    rejected(
      "lint policy also blocks source delivery",
      [
        ["packages/runner/src/engine.ts"],
        [{ ...guide, path: "packages/runner/src/engine.ts" }],
        "check:lint-policy",
      ],
      { code: 1, productTests: false },
    ),
    rejected(
      "lint policy also blocks documentation delivery",
      [[guide.path], [guide], "check:lint-policy"],
      { code: 1, productTests: false },
    ),
    rejected(
      "strict configuration policy also blocks documentation delivery",
      [[guide.path], [guide], "check:typescript-policy"],
      { code: 1, productTests: false },
    ),
    rejected(
      "documentation formatting failure blocks the gate",
      [[guide.path], [guide], "check:format:docs"],
      { code: 1, productTests: false },
    ),
    rejected(
      "documentation plain language failure blocks the gate",
      [[readme.path], [readme], "check:docs"],
      { code: 1, productTests: false },
    ),
    rejected(
      "documentation links failure blocks the gate",
      [[readme.path], [readme], "check:links"],
      { code: 1, productTests: false },
    ),
    rejected(
      "source delivery also checks document links",
      [
        ["packages/runner/src/engine.ts"],
        [{ ...guide, path: "packages/runner/src/engine.ts" }],
        "check:links",
      ],
      { code: 1, productTests: false },
    ),
    rejected(
      "guide credentials block before selected commands",
      [[guide.path], [guide], null, true],
      { code: 1, productTests: false },
    ),
    rejected(
      "README credentials block before selected commands",
      [[readme.path], [readme], null, true],
      { code: 1, productTests: false },
    ),
    rejected("unknown changed inventory keeps product tests", [[guide.path], null], {
      code: 0,
      productTests: true,
    }),
    rejected(
      "source hidden beside a guide keeps product tests",
      [
        [guide.path, "packages/runner/src/engine.ts"],
        [guide, { ...guide, path: "packages/runner/src/engine.ts" }],
      ],
      { code: 0, productTests: true },
    ),
  ],
};

const hash = "a".repeat(40);
const raw = `:100644 100644 ${hash} ${hash} M\0docs/guide.md\0`;
export const hookChangeParsingCases = {
  positive: [
    positive("regular raw modification", [raw], [guide]),
    positive("empty inventory remains explicit", [""], []),
    positive(
      "regular addition",
      [raw.replace(":100644", ":000000").replace(" M\0", " A\0")],
      [{ ...guide, old_mode: "000000", kind: "A" }],
    ),
    positive(
      "regular deletion",
      [raw.replace("100644 a", "000000 a").replace(" M\0", " D\0")],
      [{ ...guide, new_mode: "000000", kind: "D" }],
    ),
    positive(
      "spaces in a guide name remain one path",
      [raw.replace("guide.md", "two words.md")],
      [{ ...guide, path: "docs/two words.md" }],
    ),
    positive(
      "SHA256 repositories retain complete identities",
      [raw.replaceAll(hash, hash + "a".repeat(24))],
      [guide],
    ),
  ],
  negative: [
    rejected("truncated terminator", [raw.slice(0, -1)], null),
    rejected("unsupported rename status", [raw.replace(" M\0", " R100\0")], null),
    rejected("missing path", [`${raw.split("\0")[0]}\0`], null),
    rejected("invalid header marker", [raw.replace(":", "!")], null),
    rejected("parent path", [raw.replace("guide.md", "../guide.md")], null),
    rejected("absolute path", [raw.replace("docs/", "/docs/")], null),
    rejected("current directory alias", [raw.replace("docs/", "docs/./")], null),
    rejected("unknown file mode", [raw.replace("100644", "100600")], null),
    rejected("impossible modification modes", [raw.replaceAll("100644", "000000")], null),
    rejected("impossible addition modes", [raw.replace(" M\0", " A\0")], null),
    rejected("impossible deletion modes", [raw.replace(" M\0", " D\0")], null),
    rejected("extra field", [`${raw}surprise\0`], null),
    rejected("bounded changed inventory", [raw.repeat(HookLimit.ChangedFiles + 1)], null),
    rejected("bounded raw bytes", ["x".repeat(HookLimit.OutputBytes + 1)], null),
  ],
};
export const documentationScopeCases = {
  positive: [
    positive("canonical acceptance evidence", [[acceptance], []], HookCheckScope.Documentation),
    positive(
      "acceptance evidence and a guide",
      [[acceptance, guide], []],
      HookCheckScope.Documentation,
    ),
    positive("root README", [[{ ...guide, path: "README.md" }], []], HookCheckScope.Documentation),
    positive("owned README", [[readme], ["packages/runner"]], HookCheckScope.Documentation),
    positive(
      "added and deleted guides",
      [
        [
          { ...guide, old_mode: "000000", kind: "A" },
          { ...guide, new_mode: "000000", kind: "D" },
        ],
        [],
      ],
      HookCheckScope.Documentation,
    ),
    positive(
      "specification prose",
      [[{ ...guide, path: "openspec/changes/example/design.md" }], []],
      HookCheckScope.Documentation,
    ),
    positive(
      "agent skill files",
      [[{ ...guide, path: ".claude/skills/example/SKILL.md" }], []],
      HookCheckScope.Documentation,
    ),
    positive(
      "delivery plan yaml",
      [[{ ...guide, path: ".titan-delivery/delivery-example.yaml" }], []],
      HookCheckScope.Documentation,
    ),
  ],
  negative: [
    rejected(
      "a script inside a passive folder with an odd name",
      [[{ ...guide, path: ".claude/skills/$x/run.sh" }], []],
      HookCheckScope.Full,
    ),
    rejected(
      "unregistered map basename",
      [[{ ...guide, path: "docs/acceptance-map.tsv" }], []],
      HookCheckScope.Full,
    ),
    rejected(
      "another change map is not registered",
      [[{ ...guide, path: "openspec/changes/another-change/research/acceptance-map.tsv" }], []],
      HookCheckScope.Full,
    ),
    rejected(
      "unknown tabular evidence",
      [[{ ...guide, path: "docs/evidence.tsv" }], []],
      HookCheckScope.Full,
    ),
    rejected(
      "executable acceptance evidence",
      [[{ ...acceptance, new_mode: "100755" }], []],
      HookCheckScope.Full,
    ),
    rejected(
      "previously executable acceptance evidence",
      [[{ ...acceptance, old_mode: "100755" }], []],
      HookCheckScope.Full,
    ),
    rejected(
      "symbolic acceptance evidence",
      [[{ ...acceptance, new_mode: "120000" }], []],
      HookCheckScope.Full,
    ),
    rejected(
      "source beside acceptance evidence",
      [[acceptance, { ...guide, path: "packages/runner/src/engine.ts" }], []],
      HookCheckScope.Full,
    ),
    rejected("unknown owner README", [[readme], []], HookCheckScope.Full),
    rejected("root configuration", [[{ ...guide, path: "package.json" }], []], HookCheckScope.Full),
    rejected(
      "executable documentation",
      [[{ ...guide, new_mode: "100755" }], []],
      HookCheckScope.Full,
    ),
    rejected(
      "previously executable documentation",
      [[{ ...guide, old_mode: "100755" }], []],
      HookCheckScope.Full,
    ),
    rejected("empty comparison", [[], []], HookCheckScope.Full),
    rejected(
      "source rename keeps old path",
      [
        [
          { ...guide, path: "packages/runner/src/engine.ts", new_mode: "000000", kind: "D" },
          { ...guide, old_mode: "000000", kind: "A" },
        ],
        [],
      ],
      HookCheckScope.Full,
    ),
    rejected(
      "source below documentation",
      [[{ ...guide, path: "docs/example.ts" }], []],
      HookCheckScope.Full,
    ),
    rejected(
      "arbitrary root markdown",
      [[{ ...guide, path: "tools.md" }], []],
      HookCheckScope.Full,
    ),
  ],
};
export const hookTreeScopeCases = {
  positive: [
    positive(
      "staged acceptance evidence ignores unstaged source",
      ["staged-guide", Development.AcceptanceMap],
      HookCheckScope.Documentation,
    ),
    positive(
      "later acceptance evidence stays independently selectable",
      ["later-guide", Development.AcceptanceMap],
      HookCheckScope.Documentation,
    ),
    positive(
      "staged guide ignores unstaged source",
      ["staged-guide"],
      HookCheckScope.Documentation,
    ),
    positive(
      "later guide snapshot remains independently selectable",
      ["later-guide"],
      HookCheckScope.Documentation,
    ),
  ],
  negative: [
    rejected(
      "source ignores unstaged acceptance evidence",
      ["staged-source", Development.AcceptanceMap],
      HookCheckScope.Full,
    ),
    rejected(
      "earlier source cannot hide behind later acceptance evidence",
      ["earlier-source", Development.AcceptanceMap],
      HookCheckScope.Full,
    ),
    rejected("staged source ignores unstaged guide", ["staged-source"], HookCheckScope.Full),
    rejected(
      "source moved into documentation retains deletion",
      ["rename-source"],
      HookCheckScope.Full,
    ),
    rejected("missing comparison base", ["missing-base"], HookCheckScope.Full),
    rejected("new reference has no comparison base", ["new-reference"], HookCheckScope.Full),
    rejected("invalid proposed tree", ["invalid-tree"], HookCheckScope.Full),
    rejected("CI clean index keeps independent full gate", ["clean-index"], HookCheckScope.Full),
    rejected(
      "earlier source snapshot cannot hide behind later guide",
      ["earlier-source"],
      HookCheckScope.Full,
    ),
  ],
};
