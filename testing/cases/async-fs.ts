import { negative, positive, rejected } from "@titan/test-factories";

export const asyncFileSystemSyntaxCases = {
  positive: [
    positive(
      "async filesystem import",
      ['import { readFile } from "node:fs/promises"; await readFile(path);'],
      [],
    ),
    positive(
      "named stream API",
      ['import { createReadStream } from "node:fs"; createReadStream(path);'],
      [],
    ),
    positive(
      "named async promises API",
      ['import { promises as files } from "fs"; await files.readFile(path);'],
      [],
    ),
    positive(
      "fixture strings are reference data",
      ["const fixture = 'import { readFileSync } from \"node:fs\";';"],
      [],
    ),
    positive("named stream reexport", ['export { createReadStream } from "node:fs";'], []),
    positive("ordinary filesystem text argument", ['consume("fs");'], []),
    positive("side effect import has no callable binding", ['import "node:fs";'], []),
    positive("unrelated import assignment", ['import value = require("node:path");'], []),
  ],
  negative: [
    rejected(
      "computed builtin module access is opaque",
      ['process["getBuiltinModule"]("fs");'],
      [1],
    ),
    rejected("global require access is opaque", ['globalThis.require("fs");'], [1]),
    rejected("computed global require access is opaque", ['globalThis["require"]("fs");'], [1]),
    rejected("parentheses cannot hide a loader", ['(require)("fs");'], [1]),
    rejected("type assertions cannot hide a loader", ['(require as Function)("fs");'], [1]),
    rejected("non-null assertions cannot hide a loader", ['require!("fs");'], [1]),
    rejected(
      "satisfies expression cannot hide a loader",
      ['(require satisfies Function)("fs");'],
      [1],
    ),
    rejected(
      "multiline diagnostics retain source lines",
      ['const value = 1;\nimport { readFileSync } from "fs";'],
      [2],
    ),
    rejected("synchronous read import", ['import { readFileSync } from "node:fs";'], [1]),
    rejected(
      "aliased synchronous write import",
      ['import { writeFileSync as write } from "fs";'],
      [1],
    ),
    rejected("default namespace hides synchronous members", ['import fs from "node:fs";'], [1]),
    rejected("namespace import hides synchronous members", ['import * as fs from "fs";'], [1]),
    rejected(
      "reexport cannot hide a synchronous alias",
      ['export { readFileSync as read } from "node:fs";'],
      [1],
    ),
    rejected("star export hides synchronous members", ['export * from "fs";'], [1]),
    rejected(
      "namespace export hides synchronous members",
      ['export * as files from "node:fs";'],
      [1],
    ),
    rejected("CommonJS access is opaque", ['const fs = require("node:fs");'], [1]),
    rejected("import assignment is opaque", ['import fs = require("fs");'], [1]),
    rejected("dynamic access is opaque", ['const fs = await import("node:fs");'], [1]),
    rejected(
      "builtin module access is opaque",
      ['const fs = process.getBuiltinModule("fs");'],
      [1],
    ),
  ],
};

export const asyncFileSystemRepositoryCases = {
  positive: [
    positive(
      "product uses async imports",
      ["packages/example/src/index.ts", 'import { readFile } from "node:fs/promises";'],
      { code: 0, findings: 0 },
    ),
    positive(
      "dependencies are outside owned source",
      ["packages/example/node_modules/vendor/index.ts", 'import { readFileSync } from "node:fs";'],
      { code: 0, findings: 0 },
    ),
    positive("empty source is valid", ["apps/example/src/empty.ts", ""], { code: 0, findings: 0 }),
  ],
  negative: [
    rejected(
      "nested product source is checked",
      ["packages/example/src/nested/index.ts", 'import { readFileSync } from "node:fs";'],
      { code: 1, findings: 1 },
    ),
    rejected(
      "vendor executables are checked",
      ["testing/fixtures/vendor.mjs", 'import fs from "node:fs";'],
      { code: 1, findings: 1 },
    ),
    rejected("tooling is checked", ["tooling/scripts/check.ts", 'const fs = require("fs");'], {
      code: 1,
      findings: 1,
    }),
    negative("oversized source fails closed", ["apps/example/src/large.ts", "", true], {}),
  ],
};
