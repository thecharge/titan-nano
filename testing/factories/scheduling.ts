import { symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AgentHost,
  IoLimit,
  ProcessIo,
  TestConcurrencyArguments,
  type TestSchedule,
  TestScheduling,
} from "@titan/constants";
import { all } from "@titan/core";
import { readBytes, readFileBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { SchedulingProbeSchema, SchedulingResultSchema } from "@titan/types";

export async function schedulingProbe(schedule: TestSchedule, fail: boolean) {
  return withTemporaryDirectory(async (root) => {
    const result = resolve(root, TestScheduling.Result);
    const settings = SchedulingProbeSchema.parse({ schedule, fail, result });
    await writeFile(resolve(root, TestScheduling.Settings), Buffer.from(JSON.stringify(settings)));
    const program = resolve(root, TestScheduling.Probe);
    await writeFile(
      program,
      await readFileBytes(resolve(TestScheduling.Program), IoLimit.DataBytes),
    );
    await symlink(resolve(TestScheduling.Dependencies), resolve(root, "node_modules"));
    const child = Bun.spawn(
      [
        process.execPath,
        AgentHost.SmallHeap,
        "test",
        "--preload",
        resolve(TestScheduling.Guard),
        ...TestConcurrencyArguments,
        program,
      ],
      {
        cwd: root,
        stdin: ProcessIo.Ignore,
        stdout: ProcessIo.Pipe,
        stderr: ProcessIo.Pipe,
        timeout: TestScheduling.Timeout,
      },
    );
    try {
      const [, , code] = await all([
        () => readBytes(child.stdout, IoLimit.DataBytes),
        () => readBytes(child.stderr, IoLimit.DataBytes),
        () => child.exited,
      ]);
      return {
        code,
        ...SchedulingResultSchema.parse(
          JSON.parse((await readFileBytes(result, IoLimit.DataBytes)).toString()),
        ),
      };
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
      await child.exited;
    }
  });
}
