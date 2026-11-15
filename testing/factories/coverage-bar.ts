import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withTemporaryDirectory } from "@titan/test-framework/files";

const bunfig = `[test]
coverageThreshold = { lines = 0.9, functions = 0.9 }
coverageSkipTestFiles = true
`;
const covered = "export const used = (): number => 1;\n";
const uncovered = `${covered}export const unused = (): number => {
  const a = 1;
  const b = 2;
  const c = 3;
  const d = 4;
  return a + b + c + d;
};
`;
const suite = `import { expect, test } from "bun:test";
import { used } from "./lib.ts";
test("used", () => expect(used()).toBe(1));
`;

export async function coverageRun(untested: boolean): Promise<number> {
  return withTemporaryDirectory(async (directory) => {
    await writeFile(join(directory, "bunfig.toml"), bunfig);
    await writeFile(join(directory, "lib.ts"), untested ? uncovered : covered);
    await writeFile(join(directory, "lib.test.ts"), suite);
    const child = Bun.spawn([process.execPath, "test", "--coverage"], {
      cwd: directory,
      stdout: "ignore",
      stderr: "ignore",
    });
    return child.exited;
  });
}
