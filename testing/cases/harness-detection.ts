import { positive, rejected } from "@titan/test-factories";

const pair = [
  { harness: "claude", variable: "CLAUDECODE", value: "1" },
  { harness: "codex", variable: "TEST_CODEX_MARK", value: "yes" },
];
const claudeEnv = { CLAUDECODE: "1" };

export const harnessDetectionCases = {
  positive: [
    positive("Claude Code is found from CLAUDECODE=1", [{ env: claudeEnv, found: [] }], {
      ok: true,
      harness: "claude",
      detectedBy: "env:CLAUDECODE",
    }),
    positive(
      "one of two signals set is enough",
      [{ env: { TEST_CODEX_MARK: "yes" }, found: [] }, pair],
      {
        ok: true,
        harness: "codex",
        detectedBy: "env:TEST_CODEX_MARK",
      },
    ),
    positive("the flag wins over the environment", [{ flag: "codex", env: claudeEnv, found: [] }], {
      ok: true,
      harness: "codex",
      detectedBy: "flag",
    }),
    positive(
      "the workflow field names Antigravity",
      [{ workflow: "antigravity", env: {}, found: [] }],
      {
        ok: true,
        harness: "antigravity",
        detectedBy: "workflow",
      },
    ),
    positive(
      "the flag wins over the workflow field",
      [{ flag: "claude", workflow: "codex", env: {}, found: [] }],
      {
        ok: true,
        harness: "claude",
        detectedBy: "flag",
      },
    ),
    positive(
      "auto in the workflow falls back to the environment",
      [{ workflow: "auto", env: claudeEnv, found: [] }],
      {
        ok: true,
        harness: "claude",
        detectedBy: "env:CLAUDECODE",
      },
    ),
  ],
  negative: [
    rejected(
      "two harness variables ask for --harness",
      [{ env: { CLAUDECODE: "1", TEST_CODEX_MARK: "yes" }, found: [] }, pair],
      {
        ok: false,
        code: "arguments",
        message:
          "More than one agent tool was detected (CLAUDECODE, TEST_CODEX_MARK). Use --harness claude|codex|antigravity",
      },
    ),
    rejected(
      "a plain shell lists what is on the PATH",
      [{ workflow: "auto", env: {}, found: ["claude", "codex"] }],
      {
        ok: false,
        code: "arguments",
        message:
          "No agent tool was detected. Found on the PATH: claude, codex. Not found: agy. Use --harness claude|codex|antigravity",
      },
    ),
    rejected(
      "CLAUDECODE with another value is not Claude Code",
      [{ env: { CLAUDECODE: "0" }, found: [] }],
      {
        ok: false,
        code: "arguments",
        message:
          "No agent tool was detected. Found on the PATH: none. Not found: claude, codex, agy. Use --harness claude|codex|antigravity",
      },
    ),
    rejected("an unknown flag value is refused", [{ flag: "gemini", env: {}, found: [] }], {
      ok: false,
      code: "arguments",
      message: "Unknown agent tool: gemini",
    }),
    rejected("an unknown workflow value is refused", [{ workflow: "gemini", env: {}, found: [] }], {
      ok: false,
      code: "arguments",
      message: "Unknown agent tool: gemini",
    }),
  ],
};

export const doctorCases = {
  positive: [
    positive(
      "doctor inside Claude Code names the variable and every tool",
      [{ CLAUDECODE: "1" }, ["claude", "codex"], ["@anthropic-ai/claude-agent-sdk"]],
      {
        harness: "claude (env:CLAUDECODE)",
        claude: "command: found, sdk: found",
        codex: "command: found, sdk: missing",
        antigravity: "command: missing, sdk: missing",
      },
    ),
    positive(
      "doctor in a plain shell says none was detected",
      [{}, ["agy"], ["@openai/codex-sdk"]],
      {
        harness: "none detected",
        claude: "command: missing, sdk: missing",
        codex: "command: missing, sdk: found",
        antigravity: "command: found, sdk: missing",
      },
    ),
  ],
  negative: [
    rejected("a wrong CLAUDECODE value is not Claude Code", [{ CLAUDECODE: "0" }, [], []], {
      harness: "none detected",
      claude: "command: missing, sdk: missing",
      codex: "command: missing, sdk: missing",
      antigravity: "command: missing, sdk: missing",
    }),
    rejected("a bare name is not enough", [{ claude: "1" }, ["claude"], []], {
      harness: "none detected",
      claude: "command: found, sdk: missing",
      codex: "command: missing, sdk: missing",
      antigravity: "command: missing, sdk: missing",
    }),
  ],
};

export const bundledSdkLookupCases = {
  positive: [
    positive(
      "a bundled Codex SDK is recognized through its shipped runtime",
      ["@openai/codex-sdk", true],
      true,
    ),
    positive(
      "an explicit Codex runtime manifest resolves",
      ["@openai/codex/package.json", true],
      true,
    ),
  ],
  negative: [
    rejected("an absent bundled runtime is missing", ["@openai/codex-sdk", false], false),
    rejected(
      "Codex cannot stand in for the Claude SDK",
      ["@anthropic-ai/claude-agent-sdk", true],
      false,
    ),
  ],
};

export const sdkLookupCases = {
  positive: [
    positive(
      "the Claude SDK is found through its backend package",
      ["@anthropic-ai/claude-agent-sdk"],
      true,
    ),
    positive("the Codex SDK is found", ["@openai/codex-sdk"], true),
  ],
  negative: [
    rejected("the Antigravity SDK is not installed", ["google-antigravity"], false),
    rejected("an unknown package is not installed", ["no-such-package-xyz"], false),
  ],
};

export const backendForCases = {
  positive: [
    positive(
      "Claude Code gives the Claude SDK backend",
      [{ CLAUDECODE: "1" }, undefined, undefined],
      {
        ok: true,
        backend: "claude-sdk",
      },
    ),
    positive("the workflow field Codex gives the Codex SDK backend", [{}, "codex", undefined], {
      ok: true,
      backend: "codex-sdk",
    }),
    positive("the flag Codex wins over Claude Code", [{ CLAUDECODE: "1" }, undefined, "codex"], {
      ok: true,
      backend: "codex-sdk",
    }),
  ],
  negative: [
    rejected("Antigravity has no adapter yet", [{}, "antigravity", undefined], {
      ok: false,
      code: "backend",
      message: "Unsupported backend: antigravity",
    }),
    rejected(
      "a tool on the PATH without a signal still needs guidance",
      [{ TITAN_TEST_FOUND: "claude" }, "auto", undefined],
      {
        ok: false,
        code: "arguments",
        message:
          "No agent tool was detected. Found on the PATH: claude. Not found: codex, agy. Use --harness claude|codex|antigravity",
      },
    ),
    rejected("a plain shell stops with exit-2 guidance", [{}, "auto", undefined], {
      ok: false,
      code: "arguments",
      message:
        "No agent tool was detected. Found on the PATH: none. Not found: claude, codex, agy. Use --harness claude|codex|antigravity",
    }),
  ],
};
