import { strict as assert } from "node:assert";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { OwnedDataShape } from "@titan/constants";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  CommandPositionalSchema,
  CommandResultSchema,
  PhaseTurnSchema,
  RequestInventorySchema,
  RequestListRunSchema,
  WorkspaceTraversalSchema,
} from "@titan/types";
import { checkSchemas } from "../../tooling/scripts/check-schemas.ts";
import { inspectDataSchemas } from "../../tooling/scripts/schema-shapes.ts";

export async function dataShapeNames(files: Record<string, string>, declarations = 0, chain = 0) {
  const sources = { ...files };
  if (declarations)
    sources["many.ts"] = Array.from(
      { length: declarations },
      (_, index) => `type Value${index} = number;`,
    ).join("\n");
  if (chain)
    sources["chain.ts"] = [
      ...Array.from({ length: chain }, (_, index) => `type Link${index} = Link${index + 1};`),
      `type Link${chain} = () => void; export interface Deep { run: Link0; }`,
    ].join("\n");
  return (await inspectDataSchemas(sources)).map((finding) => finding.name);
}

async function writeSources(root: string, files: Record<string, string>) {
  for (const [file, text] of Object.entries(files)) {
    const path = resolve(root, file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from(text));
  }
}

async function assertSources(root: string, files: Record<string, string>) {
  for (const [file, text] of Object.entries(files))
    assert.deepEqual(await readFile(resolve(root, file)), Buffer.from(text));
}

export async function dataShapeTree(files: Record<string, string>, limits: unknown = {}) {
  return withTemporaryDirectory(async (root) => {
    await writeSources(root, files);
    const findings: string[] = [];
    try {
      const code = await checkSchemas(root, (finding) => findings.push(finding), limits);
      return { code, findings: findings.length, unchanged: true };
    } finally {
      await assertSources(root, files);
    }
  });
}

export async function ownedDataShape(target: OwnedDataShape, value: unknown) {
  const schemas = {
    [OwnedDataShape.Traversal]: WorkspaceTraversalSchema,
    [OwnedDataShape.RequestInventory]: RequestInventorySchema,
    [OwnedDataShape.RequestListRun]: RequestListRunSchema,
    [OwnedDataShape.PhaseTurn]: PhaseTurnSchema,
    [OwnedDataShape.CommandResult]: CommandResultSchema,
    [OwnedDataShape.CommandPositional]: CommandPositionalSchema,
  };
  const before = structuredClone(value);
  const result = schemas[target].safeParse(value).success;
  assert.deepEqual(value, before);
  return result;
}
