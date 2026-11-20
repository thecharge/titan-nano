import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { join } from "node:path";
import { ApprovalLevel, Backend, CliCommand, RequestDecision, WebResource } from "@titan/constants";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { ObjectSchema, OperationRequestSchema } from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import {
  dialPublicResource,
  publicResourceURL,
  readPublicResource,
} from "../../packages/server/src/web-resource.ts";
import { createFakeBackend } from "../support/backend.ts";
import { checkedWorkflow } from "./hardening.ts";

const origin = "https://8.8.8.8/source";
const destination = "https://1.1.1.1/target";

export async function resourceResponse(caseName: string) {
  if (caseName === "dns-abort") {
    const resource = await readPublicResource(
      publicResourceURL("https://localhost/"),
      undefined,
      AbortSignal.abort(new Error("source lookup aborted")),
    );
    assert.equal(resource.error, "source lookup aborted");
    return true;
  }
  const dials: string[] = [];
  let closed = 0;
  const resource = await readPublicResource(publicResourceURL(origin), async (url, address) => {
    dials.push(address);
    assert.equal(address, url.hostname);
    const location =
      caseName === "loop"
        ? origin
        : caseName === "private"
          ? "https://[::ffff:127.0.0.1]/"
          : caseName === "redirect" && url.href === origin
            ? destination
            : undefined;
    return {
      status: location ? 302 : 200,
      headers: location
        ? { location }
        : {
            "content-type": caseName === "binary" ? "application/pdf" : "text/plain",
          },
      body: (async function* () {
        assert.equal(location, undefined);
        yield "local fixture";
        if (caseName === "large") yield new Uint8Array(WebResource.Bytes);
      })(),
      close: () => {
        closed += 1;
      },
    };
  });
  assert.equal(resource.requested, origin);
  assert.equal(closed, dials.length);
  if (caseName === "redirect") {
    assert.deepEqual(dials, ["8.8.8.8", "1.1.1.1"]);
    assert.equal(resource.final_url, destination);
    assert.equal(resource.status, 200);
    assert.equal(resource.text, "local fixture");
    assert.match(resource.digest ?? "", /^[a-f0-9]{64}$/);
  } else if (caseName === "binary") {
    assert.equal(resource.media_type, "application/pdf");
    assert.equal(resource.text, null);
    assert.match(resource.extraction_error ?? "", /unsupported/);
  } else {
    assert.equal(resource.digest, undefined);
    assert.equal(resource.text, undefined);
    if (caseName === "private") {
      assert.deepEqual(dials, ["8.8.8.8"]);
      assert.match(resource.error ?? "", /public addresses/);
    } else if (caseName === "loop") {
      assert.equal(dials.length, WebResource.Redirects + 1);
      assert.match(resource.error ?? "", /Redirect limit/);
    } else {
      assert.match(resource.error ?? "", /byte limit/);
    }
  }
  return true;
}

export async function webResourceCli(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const home = join(root, "home");
    const project = join(root, "project");
    await mkdir(home);
    await mkdir(project);
    if (mode === "auto")
      await writeFile(join(home, "config.yaml"), "approvals:\n  resource: auto\n");
    const server = await startServer(home, createFakeBackend);
    try {
      const client = createRunClient(home);
      const run = await client.submit({
        project,
        workflow: checkedWorkflow(),
        backend: Backend.Fake,
        client_id: "web-test",
        submission_id: "web-fixture",
      });
      const url = "https://localhost/fixture";
      let output: unknown;
      const cli = createCli({
        ...defaultServices,
        client: () => client,
        output: (value) => {
          output = value;
        },
      });
      const args = [CliCommand.WebRead, run.run_id, url];
      const flags = ["--home", home, "--json"];
      assert.equal(await cli([...args, ...flags]), 0);
      const initial = ObjectSchema.parse(output);
      if (mode === "auto") {
        assert.equal(initial.request, undefined);
        assert.match(String(initial.error), /public addresses/);
        return true;
      }
      const request = OperationRequestSchema.parse(initial.request);
      assert.equal(request.scope.resource, url);
      if (mode === "pending") {
        assert.equal(await cli([...args, ...flags]), 0);
        assert.deepEqual(ObjectSchema.parse(output).request, request);
        return true;
      }
      await createRequestClient(home).answer(
        {
          run_id: run.run_id,
          request_id: request.request_id,
          version: request.version,
          decision: RequestDecision.Approve,
          client_id: "web-test",
          reason: "Allow fixture source",
        },
        ApprovalLevel.Main,
      );
      if (mode === "wrong-url") {
        await assert.rejects(() =>
          cli([CliCommand.WebRead, run.run_id, `${url}/different`, request.request_id, ...flags]),
        );
        return true;
      }
      assert.equal(await cli([...args, request.request_id, ...flags]), 0);
      const acquired = ObjectSchema.parse(output);
      assert.equal(acquired.request_id, request.request_id);
      assert.match(String(acquired.error), /public addresses/);
      return true;
    } finally {
      await server.stop();
    }
  });
}

export async function webResourceDial(mode: string) {
  const controller = new AbortController();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => new Response("public source fixture"),
  });
  const port = server.port;
  try {
    const url = new URL(mode === "ip" ? origin : "https://example.com/source");
    if (mode === "connection") await server.stop(true);
    const response = dialPublicResource(url, "8.8.8.8", controller.signal, (options, receive) => {
      assert.equal(options.hostname, "8.8.8.8");
      assert.equal(options.servername, mode === "ip" ? undefined : "example.com");
      assert.equal(options.rejectUnauthorized, true);
      assert.deepEqual(options.headers, { host: url.host, "accept-encoding": "identity" });
      return request({ hostname: "127.0.0.1", port }, receive);
    });
    if (mode === "connection") {
      await assert.rejects(response);
      return true;
    }
    const result = await response;
    assert.equal(result.status, 200);
    if (mode === "abort") {
      controller.abort();
      await assert.rejects(async () => {
        for await (const _chunk of result.body) assert.fail("Read after abort");
      });
      return true;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of result.body) chunks.push(Buffer.from(chunk));
    assert.equal(Buffer.concat(chunks).toString(), "public source fixture");
    result.close();
    return true;
  } finally {
    await server.stop(true);
  }
}
