import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CoverageFile, Development, IoLimit, ProcessIo, TestProcessLimit } from "@titan/constants";
import { all } from "@titan/core";
import { readBytes } from "@titan/streams";
import { withProcessDeadline } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";

export async function coverageSourceScope(extension: string, included: boolean, hits: number) {
  return withTemporaryDirectory(async (root) => {
    const file = `packages/probe/src/candidate.${extension}`;
    await mkdir(resolve(root, "packages/probe/src"), { recursive: true });
    await mkdir(resolve(root, "coverage"));
    await writeFile(resolve(root, file), Buffer.from("export const value = 1;"));
    const report = ["SF:packages/probe/src/anchor.ts", "FNF:1", "FNH:1", "DA:1,1", "end_of_record"];
    await writeFile(
      resolve(root, "packages/probe/src/anchor.ts"),
      Buffer.from("export const anchor = 1;"),
    );
    if (included)
      report.push(`SF:${file}`, "FNF:1", `FNH:${hits}`, `DA:1,${hits}`, "end_of_record");
    await writeFile(resolve(root, CoverageFile), Buffer.from(report.join("\n")));
    const child = Bun.spawn([process.execPath, resolve(Development.CoverageCheck)], {
      cwd: root,
      stdin: ProcessIo.Ignore,
      stdout: ProcessIo.Pipe,
      stderr: ProcessIo.Pipe,
    });
    return withProcessDeadline(child, TestProcessLimit.DefaultMilliseconds, async () => {
      const [output, error, code] = await all([
        () => readBytes(child.stdout, IoLimit.ResponseBytes),
        () => readBytes(child.stderr, IoLimit.ResponseBytes),
        () => child.exited,
      ]);
      const gaps = included ? (hits ? 0 : 2) : 1;
      assert.deepEqual(JSON.parse(output.toString()), { sources: 2, gaps });
      const findings = error
        .toString()
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      assert.equal(findings.length, gaps);
      for (const finding of findings) assert.equal(finding.file, file);
      return code;
    });
  });
}
