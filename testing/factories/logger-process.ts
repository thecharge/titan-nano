import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { verificationEnvironment } from "@titan/config";
import { IoLimit, ProcessIo, ProcessSignal } from "@titan/constants";
import { all } from "@titan/core";
import { readBytes } from "@titan/streams";
import { LogRecordSchema, LogStatisticsSchema, ObjectSchema } from "@titan/types";

export async function loggerProcess(
  input: unknown,
  settings: unknown = {},
  secret = "",
  nativeFailure = false,
) {
  const child = Bun.spawn(
    [
      process.execPath,
      resolve("testing/fixtures/logger-output.mjs"),
      JSON.stringify(input),
      JSON.stringify(settings),
      String(nativeFailure),
    ],
    {
      stdin: ProcessIo.Ignore,
      stdout: ProcessIo.Pipe,
      stderr: ProcessIo.Pipe,
      timeout: 4000,
      env: verificationEnvironment(process.cwd(), { TITAN_TEST_API_KEY: secret }),
    },
  );
  try {
    const [output, error, code] = await all([
      () => readBytes(child.stdout, IoLimit.AddressBytes),
      () => readBytes(child.stderr, IoLimit.AddressBytes),
      () => child.exited,
    ]);
    assert.equal(code, 0, error.toString());
    const result = ObjectSchema.parse(JSON.parse(output.toString()));
    const statistics = LogStatisticsSchema.parse(result.statistics);
    assert.equal(statistics.failed, nativeFailure ? 1 : 0, output.toString() + error.toString());
    assert.equal(statistics.disabled, nativeFailure);
    const lines = error.toString().split("\n").filter(Boolean);
    for (const line of lines) LogRecordSchema.parse(JSON.parse(line));
    assert.equal(lines.length, statistics.written);
    if (secret) assert.ok(!error.includes(Buffer.from(secret)));
    return { accepted: result.accepted, records: lines.length, rejected: statistics.rejected };
  } finally {
    if (child.exitCode === null) child.kill(ProcessSignal.Kill);
    await child.exited;
  }
}
