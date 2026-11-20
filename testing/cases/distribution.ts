import {
  ErrorCode,
  IoLimit,
  KnowledgeMeaningLocal,
  PackageRegistryGate,
  Packaging,
} from "@titan/constants";
import { VerificationMessage } from "@titan/messages";
import { negative, positive, rejected } from "@titan/test-factories";

export const distributionVersionCases = {
  positive: [
    positive(
      "SDK native version is retained exactly",
      ['{"dependencies":{"@openai/codex":"0.171.0"}}'],
      "0.171.0",
    ),
    positive(
      "SDK native prerelease stays pinned",
      ['{"dependencies":{"@openai/codex":"1.2.3-preview.1"},"name":"sdk"}'],
      "1.2.3-preview.1",
    ),
  ],
  negative: [
    negative(
      "a native range cannot enter the archive",
      ['{"dependencies":{"@openai/codex":"^0.171.0"}}'],
      {},
    ),
    negative("a missing native dependency cannot disappear silently", ['{"dependencies":{}}'], {}),
    negative("an invalid SDK manifest is refused", ["invalid"], {}),
    negative("a missing dependency map is refused", ["{}"], {}),
  ],
};

export const distributionOutputCases = {
  positive: [
    positive(
      "binary output retains exact bytes at the limit",
      [7, 3, 0, 0, { maximum_bytes: 7 }],
      true,
    ),
    positive(
      "both full pipes drain without waiting for the other to close",
      [IoLimit.DataBytes, IoLimit.DataBytes, 0, 0, {}],
      true,
    ),
  ],
  negative: [
    negative("one extra stdout byte is refused", [8, 0, 0, 0, { maximum_bytes: 7 }], {
      code: ErrorCode.StreamLimit,
    }),
    negative("one extra stderr byte is refused", [0, 8, 0, 0, { maximum_bytes: 7 }], {
      code: ErrorCode.StreamLimit,
    }),
    negative(
      "stdout overflow stops and reaps the held generator",
      [IoLimit.ChunkBytes, 0, 0, 10000, { maximum_bytes: 1024, timeout_ms: 1000 }],
      { code: ErrorCode.StreamLimit },
    ),
    negative(
      "stderr overflow stops and reaps the held generator",
      [0, IoLimit.ChunkBytes, 0, 10000, { maximum_bytes: 1024, timeout_ms: 1000 }],
      { code: ErrorCode.StreamLimit },
    ),
    negative("an unsuccessful generator cannot return its output", [7, 3, 1, 0, {}], {
      message: VerificationMessage.PackageOutputFailed,
    }),
    negative("another failure does not expose captured diagnostics", [7, 128, 2, 0, {}], {
      message: VerificationMessage.PackageOutputFailed,
    }),
    negative(
      "a short deadline kills a generator that ignores termination",
      [7, 3, 0, 10000, { timeout_ms: 500 }],
      { message: VerificationMessage.PackageOutputTimeout },
    ),
    negative(
      "another deadline drains both pipes before refusal",
      [7, 3, 0, 10000, { timeout_ms: 750 }],
      { message: VerificationMessage.PackageOutputTimeout },
    ),
  ],
};

export const distributionOutputOptionsCases = {
  positive: [
    positive("default output budgets stay central", [{}], {
      maximum_bytes: Packaging.OutputBytes,
      timeout_ms: Packaging.OutputMilliseconds,
    }),
    positive("smaller output budgets are accepted", [{ maximum_bytes: 1, timeout_ms: 1 }], {
      maximum_bytes: 1,
      timeout_ms: 1,
    }),
  ],
  negative: [
    negative("zero output bytes cannot disable the bound", [{ maximum_bytes: 0 }], {
      name: "ZodError",
    }),
    negative("zero deadline cannot disable cleanup", [{ timeout_ms: 0 }], { name: "ZodError" }),
    negative(
      "an enlarged output allowance is refused",
      [{ maximum_bytes: Packaging.OutputBytes + 1 }],
      { name: "ZodError" },
    ),
    negative(
      "an enlarged deadline is refused",
      [{ timeout_ms: Packaging.OutputMilliseconds + 1 }],
      { name: "ZodError" },
    ),
    negative("fractional bytes are refused", [{ maximum_bytes: 1.5 }], { name: "ZodError" }),
    negative("fractional time is refused", [{ timeout_ms: 1.5 }], { name: "ZodError" }),
    negative("unknown capture settings are refused", [{ stdin: "inherit" }], { name: "ZodError" }),
    negative("string budgets are not coerced", [{ timeout_ms: "1000" }], { name: "ZodError" }),
  ],
};

export const distributionOutputAdmissionCases = {
  positive: [
    positive("default settings reach the actual generator", [{}], true),
    positive(
      "smaller valid settings reach the actual generator",
      [{ maximum_bytes: 1, timeout_ms: 500 }],
      true,
    ),
  ],
  negative: distributionOutputOptionsCases.negative,
};

const optionalVector = { name: KnowledgeMeaningLocal.SqliteVec, required: false };

export const nativeDistributionCases = {
  positive: [
    positive("loads the SQLite vector extension in memory", ["native"], {
      ...optionalVector,
      ready: true,
      repair: null,
    }),
    positive("closes the probe after the extension opens", ["close"], {
      ...optionalVector,
      ready: true,
      repair: null,
    }),
  ],
  negative: [
    rejected("reports a fault-injected SQLite vector loader failure", ["load-fault"], {
      ...optionalVector,
      ready: false,
      repair: true,
    }),
    rejected("reports a fault-injected SQLite vector probe cleanup failure", ["close-fault"], {
      ...optionalVector,
      ready: false,
      repair: true,
    }),
  ],
};

export const archiveDistributionCases = {
  positive: [
    positive("accepts a clean package archive", ["clean"], true),
    positive("accepts public first-use files", ["example"], true),
  ],
  negative: [
    negative("rejects a synthetic secret in a shipped file", ["secret"], {
      message: PackageRegistryGate.Secret,
    }),
    negative("rejects a private run record in a public directory", ["private-run"], {
      message: PackageRegistryGate.InvalidArchive,
    }),
  ],
};
