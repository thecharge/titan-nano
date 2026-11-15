import { strict as assert } from "node:assert";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { verificationEnvironment } from "@titan/config";
import {
  SpellingCommand,
  SpellingConfiguration,
  SpellingFixture,
  SpellingPolicy,
} from "@titan/constants";
import { all } from "@titan/core";
import { readFileBytes } from "@titan/streams";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { SpellingFixtureSchema, type SpellingLimits, SpellingLimitsSchema } from "@titan/types";
import { checkSpelling } from "../../tooling/scripts/check-spelling.ts";

export async function spellingCheck(
  file: string,
  source: string,
  mode = SpellingFixture.Plain,
  input: unknown = {},
) {
  const policy = SpellingFixtureSchema.parse(mode);
  return withTemporaryDirectory(async (root) => {
    await writeFile(
      resolve(root, SpellingPolicy.File),
      Buffer.from(JSON.stringify(SpellingConfiguration)),
    );
    await symlink(resolve(import.meta.dir, "../../node_modules"), resolve(root, "node_modules"));
    if (policy === SpellingFixture.GitIgnored)
      await writeFile(resolve(root, ".gitignore"), Buffer.from(file));
    const path = resolve(root, file);
    await mkdir(dirname(path), { recursive: true });
    if (policy === SpellingFixture.ChildPolicy)
      await writeFile(
        resolve(dirname(path), ".cspell.json"),
        Buffer.from(JSON.stringify({ enabled: false })),
      );
    const before = Buffer.from(source);
    await writeFile(path, before);
    const globalHome = resolve(root, "host");
    if (policy === SpellingFixture.GlobalPolicy) {
      await mkdir(resolve(globalHome, "cspell"), { recursive: true });
      const path = resolve(globalHome, "dictionary.json");
      await writeFile(
        path,
        Buffer.from(JSON.stringify({ words: ["mistake".repeat(3), "delivery".repeat(3)] })),
      );
      await writeFile(
        resolve(globalHome, "cspell", SpellingPolicy.File),
        Buffer.from(JSON.stringify({ import: [path] })),
      );
    }
    const code = await checkSpelling(
      root,
      undefined,
      policy === SpellingFixture.GlobalPolicy ? verificationEnvironment(globalHome) : undefined,
      input,
    );
    return { code, unchanged: before.equals(await readFile(path)) };
  });
}

export async function spellingAdmission(
  policy: unknown,
  source = "",
  oversized = false,
  entries = 0,
  input: unknown = {},
  file = "guide.md",
) {
  return withTemporaryDirectory(async (root) => {
    await writeFile(resolve(root, SpellingPolicy.File), Buffer.from(JSON.stringify(policy)));
    const path = resolve(root, file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(
      path,
      oversized ? Buffer.alloc(SpellingPolicy.MaximumBytes + 1) : Buffer.from(source),
    );
    await all(
      Array.from(
        { length: entries },
        (_, index) => () => writeFile(resolve(root, `${index}.md`), Buffer.from("A guide.")),
      ),
    );
    let spawned = 0;
    const error = await thrownBy(() =>
      checkSpelling(
        root,
        async () => {
          spawned++;
          return 0;
        },
        undefined,
        input,
      ),
    );
    return { admitted: !(error instanceof Error), spawned };
  });
}

async function assertSpellingBatch(
  root: string,
  command: readonly string[],
  limits: SpellingLimits,
) {
  assert.deepEqual(command.slice(0, SpellingCommand.length), [...SpellingCommand]);
  assert.equal(command[SpellingCommand.length], SpellingPolicy.FileArgument);
  const batch = command.slice(SpellingCommand.length + 1);
  assert.ok(batch.length > 0 && batch.length <= limits.batch_files);
  let bytes = 0;
  for (const file of batch) {
    assert.ok(isAbsolute(file));
    bytes += (await readFileBytes(file, SpellingPolicy.MaximumBytes)).byteLength;
  }
  assert.ok(bytes <= limits.batch_bytes);
  return batch.map((file) => relative(root, file));
}

export async function spellingBatchCheck(
  entries: number,
  input: unknown,
  failure = 0,
  sourceBytes = 0,
) {
  const limits = SpellingLimitsSchema.parse(input);
  return withTemporaryDirectory(async (root) => {
    await writeFile(
      resolve(root, SpellingPolicy.File),
      Buffer.from(JSON.stringify(SpellingConfiguration)),
    );
    const files = Array.from({ length: entries }, (_, index) => `${index}.md`);
    await all(
      files.map(
        (file) => () => writeFile(resolve(root, file), Buffer.from("A".repeat(sourceBytes))),
      ),
    );
    const checked: string[] = [];
    let calls = 0;
    const code = await checkSpelling(
      root,
      async (command) => {
        calls++;
        const batch = await assertSpellingBatch(root, command, limits);
        checked.push(...batch);
        return calls === failure ? 7 : 0;
      },
      undefined,
      limits,
    );
    assert.equal(new Set(checked).size, checked.length);
    if (code === 0) assert.deepEqual(checked.sort(), [...files, SpellingPolicy.File].sort());
    return { code, calls, files: checked.length };
  });
}
