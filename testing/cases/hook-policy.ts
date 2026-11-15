import { positive, rejected } from "@titan/test-factories";

const formatCode = {
  name: "format-code",
  run: "bunx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true {staged_files}",
  glob: "*.{ts,tsx,js,json,jsonc}",
  stage_fixed: true,
};
const formatDocs = {
  name: "format-docs",
  run: "bun run format:docs",
  glob: "*.{md,yaml,yml}",
  stage_fixed: true,
};
const snapshot = { name: "staged-snapshot", run: "bun tooling/scripts/check-hook.ts commit" };
const commit = { jobs: [formatCode, formatDocs, snapshot] };
const message = {
  jobs: [{ name: "message-policy", run: 'bun tooling/scripts/check-message.ts "{1}"' }],
};
const push = {
  jobs: [
    { name: "outgoing-snapshots", run: "bun tooling/scripts/check-hook.ts push", use_stdin: true },
  ],
};
export const hookPolicyFixture = { "pre-commit": commit, "commit-msg": message, "pre-push": push };
const policy = hookPolicyFixture;

export const hookPolicyCases = {
  positive: [
    positive("canonical snapshot jobs", [policy], true),
    positive(
      "immutable configuration with different property order",
      [Object.freeze({ "pre-push": push, "commit-msg": message, "pre-commit": commit })],
      true,
    ),
  ],
  negative: [
    rejected("missing push gate", [{ "pre-commit": commit, "commit-msg": message }], false),
    rejected(
      "push cannot receive no revision input",
      [{ ...policy, "pre-push": { jobs: [{ ...push.jobs[0], use_stdin: false }] } }],
      false,
    ),
    rejected(
      "working tree cannot replace staged content",
      [
        {
          ...policy,
          "pre-commit": {
            jobs: [formatCode, formatDocs, { name: "staged-snapshot", run: "bun run check" }],
          },
        },
      ],
      false,
    ),
    rejected(
      "failure cannot become nonblocking",
      [
        {
          ...policy,
          "pre-commit": { jobs: [formatCode, formatDocs, { ...snapshot, fail_text: "ignore" }] },
        },
      ],
      false,
    ),
    rejected(
      "code formatter cannot be dropped",
      [{ ...policy, "pre-commit": { jobs: [formatDocs, snapshot] } }],
      false,
    ),
    rejected(
      "formatters cannot run after verification",
      [{ ...policy, "pre-commit": { jobs: [snapshot, formatCode, formatDocs] } }],
      false,
    ),
    rejected(
      "formatted files must be staged again",
      [
        {
          ...policy,
          "pre-commit": {
            jobs: [formatCode, { ...formatDocs, stage_fixed: false }, snapshot],
          },
        },
      ],
      false,
    ),
    rejected(
      "document formatter must cover markdown and yaml",
      [
        {
          ...policy,
          "pre-commit": { jobs: [formatCode, { ...formatDocs, glob: "*.md" }, snapshot] },
        },
      ],
      false,
    ),
    rejected(
      "secret message scan cannot be dropped",
      [
        {
          ...policy,
          "commit-msg": {
            jobs: [{ name: "message-policy", run: 'bun x --no-install commitlint --edit "{1}"' }],
          },
        },
      ],
      false,
    ),
  ],
};
