import {
  TypeScriptPolicy,
  UnusedConfiguration,
  UnusedFixture,
  UnusedToolBindings,
} from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const unusedCheckCases = {
  positive: [
    ...TypeScriptPolicy.SourceExtensions.map((extension) =>
      positive(`imported ${extension} file remains used`, [UnusedFixture.Used, extension], {
        code: 0,
        unchanged: true,
      }),
    ),
    positive("minimal declared workspace has no unused source", [UnusedFixture.Plain], {
      code: 0,
      unchanged: true,
    }),
    positive("imported internal file is used", [UnusedFixture.Used], { code: 0, unchanged: true }),
  ],
  negative: [
    ...TypeScriptPolicy.SourceExtensions.map((extension) =>
      rejected(`unused ${extension} source fails`, [UnusedFixture.File, extension], {
        code: 1,
        unchanged: true,
      }),
    ),
    rejected("unused internal source fails", [UnusedFixture.File], { code: 1, unchanged: true }),
    rejected("unused dependency fails", [UnusedFixture.Dependency], { code: 1, unchanged: true }),
    rejected("unused internal export fails", [UnusedFixture.Export], { code: 1, unchanged: true }),
    rejected("unresolved import fails", [UnusedFixture.Import], { code: 1, unchanged: true }),
    rejected("duplicate public export fails", [UnusedFixture.Duplicate], {
      code: 1,
      unchanged: true,
    }),
    rejected("git ignore cannot hide unused source", [UnusedFixture.Ignored], {
      code: 1,
      unchanged: true,
    }),
  ],
};

const configuration = UnusedConfiguration;
const root = configuration.workspaces["."];
const admitted = { admitted: true, spawned: 1 };
const refused = { admitted: false, spawned: 0 };
export const unusedAdmissionCases = {
  positive: [
    positive("canonical workspace policy", [configuration], admitted),
    positive("cloned policy", [structuredClone(configuration)], admitted),
  ],
  negative: [
    rejected(
      "dead dynamic tool binding stops execution",
      [configuration, false, UnusedToolBindings.map((binding) => ({ ...binding, used: false }))],
      refused,
    ),
    rejected(
      "extra dependency exemption cannot hide code",
      [
        {
          ...configuration,
          workspaces: {
            ...configuration.workspaces,
            ".": { ...root, ignoreDependencies: [...root.ignoreDependencies, "@fixture/unused"] },
          },
        },
      ],
      refused,
    ),
    rejected(
      "missing workspace cannot omit packages",
      [{ ...configuration, workspaces: { ".": root } }],
      refused,
    ),
    rejected(
      "extra export suppression cannot weaken the gate",
      [{ ...configuration, ignoreExportsUsedInFile: true }],
      refused,
    ),
    rejected("oversized configuration cannot be parsed", [configuration, true], refused),
  ],
};

export const unusedBindingsCases = {
  positive: [
    positive("every dynamic tool has a live binding", [UnusedToolBindings], true),
    positive("copied dynamic bindings stay valid", [structuredClone(UnusedToolBindings)], true),
  ],
  negative: [
    rejected(
      "missing tool reference cannot retain an exemption",
      [
        UnusedToolBindings.map((binding, index) =>
          index === 0 ? { ...binding, used: false } : binding,
        ),
      ],
      false,
    ),
    rejected(
      "extra dependency cannot invent a binding",
      [[...UnusedToolBindings, { dependency: "@fixture/unused", used: true }]],
      false,
    ),
    rejected("missing dependency binding fails", [UnusedToolBindings.slice(1)], false),
  ],
};
