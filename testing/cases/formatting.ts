import { DocumentationFormat, DocumentationFormatConfiguration } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const valid = { code: 0, unchanged: true };
const unformatted = { code: DocumentationFormat.UnformattedExitCode, unchanged: true };
export const documentationFormattingCases = {
  positive: [
    positive(
      "Markdown heading and paragraph",
      ["guide.md", "# A heading\n\nA paragraph.\n"],
      valid,
    ),
    positive("Markdown list", ["guide.md", "- First\n- Second\n"], valid),
    positive("TOML scalar", ["settings.toml", 'name = "titan"\n'], valid),
    positive("TOML section", ["settings.toml", "[limits]\nmax_parallel = 2\n"], valid),
    positive("YAML scalar", ["workflow.yaml", "name: titan\n"], valid),
    positive("YAML list", ["workflow.yaml", "steps:\n  - check\n"], valid),
    positive("Container base", ["Containerfile", "FROM scratch\n"], valid),
    positive(
      "Container working path",
      ["Containerfile", "FROM scratch\nWORKDIR /workspace\n"],
      valid,
    ),
  ],
  negative: [
    rejected(
      "Markdown heading needs separation",
      ["guide.md", "# A heading\nA paragraph.\n"],
      unformatted,
    ),
    rejected(
      "Markdown list needs consistent spacing",
      ["guide.md", "-    First\n- Second\n"],
      unformatted,
    ),
    rejected("TOML scalar spacing", ["settings.toml", 'name="titan"\n'], unformatted),
    rejected("TOML section spacing", ["settings.toml", "[limits]\nmax_parallel=2\n"], unformatted),
    rejected("YAML scalar spacing", ["workflow.yaml", "name:  titan\n"], unformatted),
    rejected("YAML flow spacing", ["workflow.yaml", "steps: [check,review]\n"], unformatted),
    rejected("Container instruction case", ["Containerfile", "from scratch\n"], unformatted),
    rejected("Container instruction spacing", ["Containerfile", "FROM    scratch\n"], unformatted),
  ],
};

const configuration = DocumentationFormatConfiguration;
const admitted = { admitted: true, spawned: 1, code: 0 };
const refused = { admitted: false, spawned: 0, code: null };
export const documentationAdmissionCases = {
  positive: [
    positive("canonical local plugins", [configuration], admitted),
    positive(
      "property order does not change policy",
      [
        {
          plugins: configuration.plugins,
          excludes: configuration.excludes,
          includes: configuration.includes,
          markdown: configuration.markdown,
          dockerfile: configuration.dockerfile,
          newLineKind: configuration.newLineKind,
          lineWidth: configuration.lineWidth,
        },
      ],
      admitted,
    ),
  ],
  negative: [
    rejected(
      "remote plugin cannot download during a hook",
      [{ ...configuration, plugins: ["https://example.invalid/plugin.wasm"] }],
      refused,
    ),
    rejected(
      "extra plugin cannot execute commands",
      [{ ...configuration, plugins: [...configuration.plugins, "plugin.json"] }],
      refused,
    ),
    rejected(
      "documentation cannot disappear behind an exclusion",
      [{ ...configuration, excludes: [...configuration.excludes, "docs/**"] }],
      refused,
    ),
    rejected("missing grammar cannot pass", [{ ...configuration, includes: ["**/*.md"] }], refused),
    rejected("oversized configuration is refused before parsing", [configuration, true], refused),
  ],
};
