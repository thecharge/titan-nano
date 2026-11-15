import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { verificationEnvironment } from "@titan/config";
import {
  FileEncoding,
  HookFile,
  SpellingCommand,
  SpellingConfiguration,
  SpellingPolicy,
} from "@titan/constants";
import { SpellingMessage } from "@titan/messages";
import { readFileBytes } from "@titan/streams";
import {
  type EnvironmentHookRunner,
  SpellingConfigurationSchema,
  type SpellingLimits,
  SpellingLimitsSchema,
} from "@titan/types";
import { environmentCommandStatus } from "./hook-process.ts";

async function* patternSources(
  directory: string,
  pattern: Bun.Glob,
  previous: Bun.Glob[],
  excluded: Bun.Glob[],
): AsyncGenerator<readonly [string, number]> {
  for await (const file of pattern.scan({ cwd: directory, onlyFiles: true, dot: true })) {
    if (excluded.some((glob) => glob.match(file)) || previous.some((glob) => glob.match(file)))
      continue;
    const bytes = await readFileBytes(resolve(directory, file), SpellingPolicy.MaximumBytes);
    if (SpellingPolicy.Directive.test(bytes.toString(FileEncoding.Utf8)))
      throw new Error(SpellingMessage.Directive);
    yield [file, bytes.byteLength];
  }
}

async function* spellingSources(directory: string): AsyncGenerator<readonly [string, number]> {
  const excluded = SpellingConfiguration.ignorePaths.map((pattern) => new Bun.Glob(pattern));
  const patterns = SpellingConfiguration.files.map((pattern) => new Bun.Glob(pattern));
  for (const [index, pattern] of patterns.entries())
    yield* patternSources(directory, pattern, patterns.slice(0, index), excluded);
}

async function* spellingBatches(directory: string, limits: SpellingLimits) {
  let batch: string[] = [];
  let bytes = 0;
  for await (const [file, size] of spellingSources(directory)) {
    if (size > limits.batch_bytes) throw new Error(SpellingMessage.Batch);
    if (
      batch.length &&
      (batch.length === limits.batch_files || bytes + size > limits.batch_bytes)
    ) {
      yield batch;
      batch = [];
      bytes = 0;
    }
    batch.push(file);
    bytes += size;
  }
  if (batch.length) yield batch;
}

async function checkBatches(
  directory: string,
  limits: SpellingLimits,
  run: EnvironmentHookRunner,
  environment: NodeJS.ProcessEnv,
): Promise<number> {
  for await (const batch of spellingBatches(directory, limits)) {
    const code = await run(
      [
        ...SpellingCommand,
        SpellingPolicy.FileArgument,
        ...batch.map((file) => resolve(directory, file)),
      ],
      directory,
      environment,
    );
    if (code !== 0) return code;
  }
  return 0;
}

export async function checkSpelling(
  directory = resolve(import.meta.dir, HookFile.RepositoryRoot),
  run: EnvironmentHookRunner = environmentCommandStatus,
  inherited?: NodeJS.ProcessEnv,
  input: unknown = {},
): Promise<number> {
  const limits = SpellingLimitsSchema.parse(input);
  SpellingConfigurationSchema.parse(
    JSON.parse(
      (
        await readFileBytes(resolve(directory, SpellingPolicy.File), SpellingPolicy.MaximumBytes)
      ).toString(FileEncoding.Utf8),
    ),
  );
  for await (const batch of spellingBatches(directory, limits)) void batch;
  const home = await mkdtemp(join(tmpdir(), SpellingPolicy.TemporaryPrefix));
  try {
    return await checkBatches(directory, limits, run, verificationEnvironment(home, inherited));
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

if (import.meta.main) process.exitCode = await checkSpelling();
