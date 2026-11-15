import { resolve } from "node:path";
import {
  DocumentationFormat,
  FileEncoding,
  HookFile,
  IoLimit,
  UnusedCommand,
  UnusedPolicy,
  UnusedToolBindings,
} from "@titan/constants";
import { readFileBytes } from "@titan/streams";
import {
  DocumentationFormatSchema,
  type HookRunner,
  SecretPolicySchema,
  UnusedConfigurationSchema,
  UnusedToolBindingsSchema,
} from "@titan/types";
import { commandStatus } from "./hook-process.ts";

async function document(directory: string, file: string): Promise<unknown> {
  return JSON.parse(
    (await readFileBytes(resolve(directory, file), IoLimit.DataBytes)).toString(FileEncoding.Utf8),
  );
}

export async function checkUnused(
  directory = resolve(import.meta.dir, HookFile.RepositoryRoot),
  run: HookRunner = commandStatus,
  bindings: unknown = UnusedToolBindings,
): Promise<number> {
  UnusedConfigurationSchema.parse(await document(directory, UnusedPolicy.File));
  UnusedToolBindingsSchema.parse(bindings);
  DocumentationFormatSchema.parse(await document(directory, DocumentationFormat.File));
  SecretPolicySchema.parse(await document(directory, HookFile.Secrets));
  return run(UnusedCommand, directory);
}

if (import.meta.main) process.exitCode = await checkUnused();
