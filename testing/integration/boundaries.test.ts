import { test } from "bun:test";
import {
  boundaryActualWorkspace,
  boundaryCommandScope,
  boundaryCoreDirection,
  boundaryImportViolation,
  boundaryLazyCycle,
  boundaryMissingContracts,
} from "../factories/boundary-contract.ts";

test("the real workspace obeys its public package contracts", boundaryActualWorkspace);
test.each([
  ["undeclared-import", 'import { value } from "@titan/core";', {}],
  [
    "private-export",
    'export { value } from "@titan/core/src/index.ts";',
    { "@titan/core": "workspace:*" },
  ],
  ["cross-package-path", 'import { value } from "../../core/src/index.ts";', {}],
  ["cross-package-path", 'import { response } from "../../../test/fixtures/response.ts";', {}],
  [
    "vendor-isolation",
    'const sdk = await import("@openai/codex-sdk");',
    { "@openai/codex-sdk": "catalog:" },
  ],
  [
    "vendor-isolation",
    'const cli = await import("@openai/codex");',
    { "@openai/codex": "catalog:" },
  ],
  ["undeclared-import", 'type Port = import("@titan/core").Port;', {}],
] as const)("boundary rejects %s", boundaryImportViolation);
test("declared dependency cycles fail even when imports are lazy", boundaryLazyCycle);
test("missing exports and missing workspaces fail", boundaryMissingContracts);
test("core cannot acquire a dependency on a product package", boundaryCoreDirection);
test("the boundary command reports its checked scope and succeeds", boundaryCommandScope);
