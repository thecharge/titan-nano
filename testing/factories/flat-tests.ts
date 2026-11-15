import { strict as assert } from "node:assert";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { FlatTestRule, IoLimit, TestProcessLimit } from "@titan/constants";
import { all } from "@titan/core";
import { readBytes } from "@titan/streams";
import { withProcessDeadline } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { checkFlatTests, inspectFlatTests } from "../../tooling/scripts/check-flat-tests.ts";

export async function flatTestSyntax(source: string, file = "subject.test.ts") {
  return inspectFlatTests(source, file);
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

export async function flatTestTree(files: Record<string, string>, limits: unknown = {}) {
  return withTemporaryDirectory(async (root) => {
    await writeSources(root, files);
    const findings: string[] = [];
    try {
      const code = await checkFlatTests(root, (finding) => findings.push(finding), limits);
      return { code, findings: findings.length, unchanged: true };
    } finally {
      await assertSources(root, files);
    }
  });
}

export async function flatTestDiscovery(file: string) {
  return withTemporaryDirectory(async (root) => {
    await writeFile(
      resolve(root, file),
      Buffer.from(
        'import {expect, test} from "bun:test"; test("discovered", () => expect(true).toBe(true));',
      ),
    );
    const child = Bun.spawn([process.execPath, "test"], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
    });
    return withProcessDeadline(child, TestProcessLimit.DefaultMilliseconds, async () => {
      await all([
        () => readBytes(child.stdout, IoLimit.DataBytes),
        () => readBytes(child.stderr, IoLimit.DataBytes),
      ]);
      return { exitCode: await child.exited, checked: FlatTestRule.File.test(file) };
    });
  });
}
