import { join, resolve } from "node:path";
import { FileEncoding, OwnedSource } from "@titan/constants";
import { readFileBytes } from "@titan/streams";

export async function* ownedSources(root: string): AsyncGenerator<readonly [string, string]> {
  const patterns = OwnedSource.Roots.map((root) => new Bun.Glob(join(root, OwnedSource.Sources)));
  const excluded = OwnedSource.Excluded.map((pattern) => new Bun.Glob(pattern));
  for (const glob of patterns) {
    yield* scanOwned(root, glob, excluded);
  }
}

async function* scanOwned(
  root: string,
  glob: Bun.Glob,
  excluded: readonly Bun.Glob[],
): AsyncGenerator<readonly [string, string]> {
  for await (const file of glob.scan({ cwd: root, onlyFiles: true })) {
    if (excluded.some((pattern) => pattern.match(file))) continue;
    const bytes = await readFileBytes(resolve(root, file), OwnedSource.MaximumSourceBytes);
    yield [file, bytes.toString(FileEncoding.Utf8)];
  }
}
