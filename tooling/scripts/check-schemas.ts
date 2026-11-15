import { resolve } from "node:path";
import { DataSchemaRule, FileEncoding, HookFile } from "@titan/constants";
import { dataSchemaReadLimit, dataSchemasSummary, dataSchemaViolation } from "@titan/messages";
import { readFileBytes } from "@titan/streams";
import { type DataSchemaReadLimits, DataSchemaReadLimitsSchema } from "@titan/types";
import { inspectDataSchemas } from "./schema-shapes.ts";

async function typeSources(
  root: string,
  limits: DataSchemaReadLimits,
): Promise<Record<string, string>> {
  const sources: Record<string, string> = {};
  let count = 0;
  let bytes = 0;
  for await (const path of new Bun.Glob(DataSchemaRule.Glob).scan({ cwd: root, onlyFiles: true })) {
    if (count >= limits.max_files || bytes >= limits.total_bytes)
      throw new Error(dataSchemaReadLimit);
    const content = await readFileBytes(
      resolve(root, path),
      Math.min(limits.source_bytes, limits.total_bytes - bytes),
    );
    count++;
    bytes += content.length;
    sources[path] = content.toString(FileEncoding.Utf8);
  }
  if (!count) throw new Error(dataSchemaReadLimit);
  return sources;
}

export async function checkSchemas(
  root = resolve(import.meta.dir, HookFile.RepositoryRoot),
  report = console.error,
  input: unknown = {},
): Promise<number> {
  const limits = DataSchemaReadLimitsSchema.parse(input);
  const findings = await inspectDataSchemas(await typeSources(root, limits));
  for (const finding of findings)
    report(dataSchemaViolation(finding.file, finding.line, finding.name));
  console.log(dataSchemasSummary);
  return findings.length ? 1 : 0;
}

if (import.meta.main) process.exitCode = await checkSchemas();
