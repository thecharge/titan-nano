import { strict as assert } from "node:assert";
import { PassThrough, Writable } from "node:stream";
import { ErrorCode, NativeToolOutputFixture, SignalEvent } from "@titan/constants";
import { NativeToolBridgeMessage } from "@titan/messages";
import { NativeStdioTransport } from "@titan/server/native-tool-bridge";

export async function nativeStdioLifecycle(mode: NativeToolOutputFixture) {
  await using resources = new AsyncDisposableStack();
  const input = new PassThrough();
  resources.defer(() => {
    input.destroy();
  });
  let written: Buffer | undefined;
  let accepted = false;
  const output = new Writable({
    highWaterMark: 1,
    write(chunk, _encoding, done) {
      written = Buffer.from(chunk);
      if (mode === NativeToolOutputFixture.Immediate) {
        accepted = true;
        done();
      }
      if (mode === NativeToolOutputFixture.Backpressure)
        setTimeout(() => {
          accepted = true;
          done();
        }, 20);
      if (mode === NativeToolOutputFixture.Error) done(new Error("private-output-diagnostic"));
      if (mode === NativeToolOutputFixture.Throw) throw new Error("private-output-diagnostic");
      if (mode === NativeToolOutputFixture.Close)
        setTimeout(() => {
          output.destroy();
        }, 10);
    },
  });
  resources.defer(() => {
    output.destroy();
  });
  const transport = new NativeStdioTransport(
    input,
    output,
    mode === NativeToolOutputFixture.Stalled ? 100 : 2000,
  );
  resources.defer(() => transport.close());
  const fallback = new AbortController();
  fallback.signal.addEventListener(SignalEvent.Abort, transport.close.bind(transport), {
    once: true,
  });
  const timer = setTimeout(fallback.abort.bind(fallback), 500);
  resources.defer(() => clearTimeout(timer));
  let closed = 0;
  transport.onclose = () => {
    closed++;
  };
  await transport.start();
  const message = { jsonrpc: "2.0" as const, id: 1, result: { ok: true } };
  if (mode === NativeToolOutputFixture.Ended) output.end();
  if (mode === NativeToolOutputFixture.Closed) await transport.close();
  const pending = transport.send(message);
  if (mode === NativeToolOutputFixture.Cancelled) await transport.close();
  if ([NativeToolOutputFixture.Immediate, NativeToolOutputFixture.Backpressure].includes(mode)) {
    await pending;
    assert.equal(accepted, true);
    assert.deepEqual(JSON.parse(written?.toString() ?? "null"), message);
  } else {
    await assert.rejects(pending, {
      code: ErrorCode.ServerUnavailable,
      message: NativeToolBridgeMessage.Output,
    });
  }
  assert.equal(fallback.signal.aborted, false);
  await transport.close();
  await transport.close();
  assert.equal(closed, 1);
  assert.equal(input.listenerCount("end"), 0);
  assert.equal(input.listenerCount("data"), 0);
  assert.equal(output.listenerCount("close"), 0);
  assert.equal(output.listenerCount("error"), 0);
  return true;
}
