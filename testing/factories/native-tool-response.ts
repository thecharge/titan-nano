import { strict as assert } from "node:assert";
import { PassThrough, Writable } from "node:stream";
import { ErrorCode, IoLimit, LocalServer, NativeToolResponseFixture } from "@titan/constants";
import { NativeToolBridgeMessage } from "@titan/messages";
import { NativeStdioTransport, nativeToolFetch } from "@titan/server/native-tool-bridge";

export async function nativeToolResponse(mode: NativeToolResponseFixture, aborted: boolean) {
  await using resources = new AsyncDisposableStack();
  let calls = 0;
  const server = Bun.serve({
    hostname: LocalServer.Host,
    port: 0,
    fetch: (): Response => {
      calls++;
      if (mode === NativeToolResponseFixture.Empty) return new Response(null, { status: 204 });
      if (mode === NativeToolResponseFixture.Oversized)
        return new Response(Buffer.alloc(IoLimit.ResponseBytes + 1, 97));
      if (mode === NativeToolResponseFixture.Slow)
        return new Response(
          new ReadableStream({ start: (sink) => sink.enqueue(Buffer.from("{")) }),
        );
      if (mode === NativeToolResponseFixture.Redirect)
        return Response.redirect(new URL("/other", server.url));
      return Response.json({ ok: true }, { headers: { "x-native-test": "retained" } });
    },
  });
  resources.defer(() => server.stop(true));
  const fetch = nativeToolFetch(mode === NativeToolResponseFixture.Slow ? 100 : 2000);
  const fallback = new AbortController();
  const timer = setTimeout(fallback.abort.bind(fallback), 2000);
  resources.defer(() => clearTimeout(timer));
  const init = aborted
    ? { signal: AbortSignal.abort() }
    : mode === NativeToolResponseFixture.Slow
      ? { signal: fallback.signal }
      : undefined;
  if (
    aborted ||
    ![NativeToolResponseFixture.Json, NativeToolResponseFixture.Empty].includes(mode)
  ) {
    await assert.rejects(fetch(server.url, init), {
      code: ErrorCode.ServerUnavailable,
      message: NativeToolBridgeMessage.Startup,
    });
  } else {
    const response = await fetch(server.url, init);
    if (mode === NativeToolResponseFixture.Empty) {
      assert.equal(response.status, 204);
      assert.equal(await response.text(), "");
    } else {
      assert.deepEqual(await response.json(), { ok: true });
      assert.equal(response.headers.get("x-native-test"), "retained");
    }
  }
  assert.equal(fallback.signal.aborted, false);
  assert.equal(calls, aborted ? 0 : 1);
  return true;
}

export async function nativeStdioOutput(wide: boolean, oversized: boolean) {
  await using resources = new AsyncDisposableStack();
  const input = new PassThrough();
  resources.defer(() => {
    input.destroy();
  });
  const chunks: Buffer[] = [];
  const output = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(Buffer.from(chunk));
      done();
    },
  });
  resources.defer(() => {
    output.destroy();
  });
  const transport = new NativeStdioTransport(input, output);
  resources.defer(() => transport.close());
  const size = oversized ? Math.floor(IoLimit.ResponseBytes / (wide ? 4 : 6)) + 1 : 32;
  const message = {
    jsonrpc: "2.0" as const,
    id: 1,
    result: { text: (wide ? "🚀" : "\u0000").repeat(size) },
  };
  if (oversized) {
    await assert.rejects(transport.send(message), { code: ErrorCode.StreamLimit });
    assert.equal(chunks.length, 0);
  } else {
    await transport.send(message);
    const bytes = Buffer.concat(chunks);
    assert.equal(bytes.at(-1), 10);
    assert.deepEqual(JSON.parse(bytes.toString()), message);
  }
  return true;
}
