import { strict as assert } from "node:assert";
import { createSecretScanner } from "@titan/config";
import { LogEvent, LogLevel } from "@titan/constants";
import { all } from "@titan/core";
import { createLogger } from "@titan/logger";
import { type LogInput, LogRecordSchema, LogStatisticsSchema } from "@titan/types";

export async function loggerRecord(
  settings: unknown,
  input: LogInput,
  secrets = {},
  native = false,
) {
  const records: Buffer[] = [];
  const scanner = createSecretScanner(secrets);
  const logger = await createLogger(
    settings,
    native
      ? undefined
      : async (bytes) => {
          records.push(Buffer.from(bytes));
          return bytes.length;
        },
    scanner.accept,
  );
  const started = Date.now();
  const accepted = await logger.write(input);
  for (const bytes of records) {
    assert.equal(bytes.at(-1), 10);
    const record = LogRecordSchema.parse(JSON.parse(bytes.toString()));
    assert.equal(record.pid, process.pid);
    assert.ok(record.time >= started && record.time <= Date.now());
  }
  return { accepted, ...LogStatisticsSchema.parse(await logger.statistics()) };
}

export async function loggerSink(mode: string) {
  let calls = 0;
  const logger = await createLogger({ write_timeout_ms: 10 }, async (bytes) => {
    calls++;
    if (mode === "partial") return bytes.length - 1;
    if (mode === "reject") throw new Error("private sink details");
    if (mode === "timeout") return new Promise<number>(() => {});
    return bytes.length;
  });
  let accepted = await logger.write({ level: LogLevel.Warn, event: LogEvent.RunSettled });
  if (mode === "repeat") {
    assert.equal(accepted, true);
    accepted = await logger.write({ level: LogLevel.Warn, event: LogEvent.RunSettled });
  }
  if (mode !== "complete" && mode !== "repeat") {
    assert.equal(await logger.write({ level: LogLevel.Error, event: LogEvent.RunFailed }), false);
    assert.equal(calls, 1);
  }
  return { accepted, ...(await logger.statistics()) };
}

export async function loggerQueue(limit: number, saturate: boolean) {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const order: string[] = [];
  const logger = await createLogger(
    { max_pending: limit, write_timeout_ms: 500 },
    async (bytes) => {
      const record = LogRecordSchema.parse(JSON.parse(bytes.toString()));
      order.push(record.run_id ?? "");
      entered.resolve();
      await release.promise;
      return bytes.length;
    },
  );
  const pending = Array.from({ length: limit }, (_, index) =>
    logger.write({
      level: LogLevel.Warn,
      event: LogEvent.RunSettled,
      run_id: String(index),
    }),
  );
  let accepted = false;
  try {
    await entered.promise;
    assert.equal(order.length, 1);
    if (saturate)
      accepted = await logger.write({
        level: LogLevel.Warn,
        event: LogEvent.RunSettled,
        run_id: "extra",
      });
  } finally {
    release.resolve();
    assert.deepEqual(await all(pending.map((work) => () => work)), Array(limit).fill(true));
  }
  if (!saturate)
    accepted = await logger.write({
      level: LogLevel.Warn,
      event: LogEvent.RunSettled,
      run_id: "extra",
    });
  assert.deepEqual(order, [
    ...Array.from({ length: limit }, (_, index) => String(index)),
    ...(saturate ? [] : ["extra"]),
  ]);
  assert.deepEqual(await logger.statistics(), {
    written: limit + (saturate ? 0 : 1),
    filtered: 0,
    rejected: saturate ? 1 : 0,
    failed: 0,
    disabled: false,
  });
  return accepted;
}

export async function loggerHostile(mode: string) {
  let writes = 0;
  const logger = await createLogger({}, async (bytes) => {
    writes++;
    return bytes.length;
  });
  const value: LogInput = { level: LogLevel.Warn, event: LogEvent.RunSettled };
  const input =
    mode === "plain"
      ? value
      : new Proxy(value, {
          get(target, property, receiver) {
            if (mode === "getter") throw new Error("private getter details");
            return Reflect.get(target, property, receiver);
          },
          ownKeys(target) {
            if (mode === "keys") throw new Error("private key details");
            return Reflect.ownKeys(target);
          },
        });
  const accepted = await logger.write(input);
  assert.equal(writes, accepted ? 1 : 0);
  assert.equal((await logger.statistics()).rejected, accepted ? 0 : 1);
  return accepted;
}

export async function loggerFraming(input: LogInput, fault: string) {
  const chunks: Buffer[] = [];
  let calls = 0;
  const logger = await createLogger({}, async (bytes) => {
    calls++;
    if (calls === 1 && fault !== "none") {
      chunks.push(Buffer.from(bytes.subarray(0, 8)));
      if (fault === "throw") throw new Error("Failed after a partial write");
      return 8;
    }
    chunks.push(Buffer.from(bytes));
    return bytes.length;
  });
  const first = await logger.write(input);
  const second = await logger.write(input);
  if (fault === "none") {
    assert.equal(first, true);
    assert.equal(second, true);
    assert.equal(calls, 2);
    for (const bytes of chunks)
      assert.equal(LogRecordSchema.parse(JSON.parse(bytes.toString())).level, input.level);
    assert.equal((await logger.statistics()).written, 2);
  } else {
    assert.equal(first, false);
    assert.equal(second, false, "A later record must not follow an incomplete JSON prefix");
    assert.equal(calls, 1);
    assert.equal(Buffer.concat(chunks).length, 8);
    assert.deepEqual(await logger.statistics(), {
      written: 0,
      filtered: 0,
      rejected: 1,
      failed: 1,
      disabled: true,
    });
  }
  return true;
}
