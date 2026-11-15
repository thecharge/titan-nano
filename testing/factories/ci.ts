import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { HookCheckCommands, IoLimit, ProcessIo } from "@titan/constants";
import { all } from "@titan/core";
import { HookMessage } from "@titan/messages";
import { readBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { checkHookSnapshot } from "../../tooling/scripts/hook-checks.ts";
import { hookPolicyFixture } from "../cases/hook-policy.ts";
import { prepareTools } from "./hooks.ts";

export async function ciTestFailure(failure: boolean, title: string) {
  return withTemporaryDirectory(async (directory) => {
    await prepareTools(directory);
    await writeFile(
      resolve(directory, "lefthook.yml"),
      Buffer.from(Bun.YAML.stringify(hookPolicyFixture)),
    );
    const file = "ci-fixture.test.ts";
    await writeFile(
      resolve(directory, file),
      Buffer.from(
        `import {test,expect} from "bun:test";test(${JSON.stringify(title)},()=>expect(${!failure}).toBe(true));`,
      ),
    );
    let observed = false;
    let stages = 0;
    const reports: string[] = [];
    const code = await checkHookSnapshot(
      directory,
      [file],
      async (command) => {
        stages++;
        if (command.at(-1) !== "test") return 0;
        const child = Bun.spawn([process.execPath, "test", file], {
          cwd: directory,
          stdin: ProcessIo.Ignore,
          stdout: ProcessIo.Pipe,
          stderr: ProcessIo.Pipe,
          timeout: 5000,
        });
        try {
          const [out, err, result] = await all([
            () => readBytes(child.stdout, IoLimit.DataBytes),
            () => readBytes(child.stderr, IoLimit.DataBytes),
            () => child.exited,
          ]);
          observed = Buffer.concat([out, err]).toString().includes(title);
          return result;
        } finally {
          if (child.exitCode === null) child.kill();
          await child.exited;
        }
      },
      (report) => reports.push(report),
    );
    assert.equal(stages, HookCheckCommands.length);
    assert.equal(reports.shift(), HookMessage.FullScope);
    assert.equal(reports.length, HookCheckCommands.length);
    assert.equal(observed, true);
    return code;
  });
}
