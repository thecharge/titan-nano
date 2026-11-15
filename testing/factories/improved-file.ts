import { strict as assert } from "node:assert";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { ImprovedFixture } from "@titan/constants";
import { saveImprovedFile } from "@titan/knowledge";
import { withTemporaryDirectory } from "@titan/test-framework/files";

export async function improvedSave(
  name: string,
  existing: readonly string[],
  kept: string,
): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    for (const file of existing) await writeFile(resolve(root, file), `${file}\n`);
    const saved = await saveImprovedFile(root, name, kept);
    let unchanged = true;
    for (const file of existing)
      unchanged = unchanged && (await readFile(resolve(root, file), "utf8")) === `${file}\n`;
    assert.equal(await readFile(saved, "utf8"), kept);
    const count = (await readdir(root)).length;
    return [basename(saved), unchanged, count - existing.length].join(ImprovedFixture.Separator);
  });
}
