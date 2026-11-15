import { strict as assert } from "node:assert";
import { ProcessIo, ProcessScopeMode, TestProcessFixture } from "@titan/constants";
import { testProcessActionFailure } from "@titan/messages";
import { processExited, withProcessDeadline } from "@titan/test-framework";

export async function processScope(mode: ProcessScopeMode, milliseconds: number, delay: number) {
  const child = Bun.spawn(
    [process.execPath, TestProcessFixture.Eval, TestProcessFixture.Script, String(delay)],
    {
      stdout: ProcessIo.Ignore,
      stderr: ProcessIo.Ignore,
    },
  );
  try {
    return await withProcessDeadline(child, milliseconds, async () => {
      if (mode === ProcessScopeMode.Throw) throw new Error(testProcessActionFailure);
      return (await child.exited) === 0;
    });
  } finally {
    assert.equal(await processExited(child.pid), true);
    if (mode !== ProcessScopeMode.Complete) assert.notEqual(child.exitCode, 0);
  }
}
