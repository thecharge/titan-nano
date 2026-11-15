import { ScriptCheckFixture } from "@titan/constants";
import { scriptCheck } from "@titan/runner";
import type { ScriptCheck } from "@titan/types";

export async function scriptAnswer(
  first: boolean,
  codes: readonly number[],
): Promise<readonly [string, string, number]> {
  let calls = 0;
  const run: ScriptCheck = async () => {
    const code = codes[calls] ?? 0;
    calls++;
    return { exit_code: code, stdout: Buffer.from(String(code)), stderr: Buffer.alloc(0) };
  };
  const checked = await scriptCheck(
    run,
    ScriptCheckFixture.Script,
    ScriptCheckFixture.Folder,
    first,
    new AbortController().signal,
  );
  return [checked.answer, checked.evidence, calls];
}
