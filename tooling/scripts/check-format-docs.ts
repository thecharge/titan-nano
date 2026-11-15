import { resolve } from "node:path";
import {
  DocumentationFormat,
  DocumentationFormatCommand,
  FileEncoding,
  HookFile,
  IoLimit,
} from "@titan/constants";
import { readFileBytes } from "@titan/streams";
import { DocumentationFormatSchema, type HookRunner } from "@titan/types";
import { commandStatus } from "./hook-process.ts";

export async function checkDocumentationFormat(
  directory = resolve(import.meta.dir, HookFile.RepositoryRoot),
  run: HookRunner = commandStatus,
): Promise<number> {
  DocumentationFormatSchema.parse(
    JSON.parse(
      (
        await readFileBytes(resolve(directory, DocumentationFormat.File), IoLimit.DataBytes)
      ).toString(FileEncoding.Utf8),
    ),
  );
  return run(DocumentationFormatCommand, directory);
}

if (import.meta.main) process.exitCode = await checkDocumentationFormat();
