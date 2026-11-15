import { strict as assert } from "node:assert";
import { McpIdentity, UsageTransport } from "@titan/constants";
import { createRunClient, readAddress } from "@titan/server/client";
import { McpTextContentSchema, RunUsageSchema } from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { withClientResponse } from "../support/client.ts";
import { withMemoryMcp } from "../support/mcp.ts";
import { withArtifactRun } from "./artifacts.ts";

export async function usageTransport(
  transport: UsageTransport,
  selected = true,
  executable = false,
) {
  return withArtifactRun(executable, async (run, home) => {
    const id = selected ? run.run_id : "missing-run";
    let value: unknown;
    if (transport === UsageTransport.Http) value = await createRunClient(home).usage(id);
    if (transport === UsageTransport.Cli) {
      const output: unknown[] = [];
      const main = createCli({ ...defaultServices, output: (item) => output.push(item) });
      assert.equal(await main(["usage", id, "--home", home, "--json"]), 0);
      assert.equal(output.length, 1);
      value = output[0];
    }
    if (transport === UsageTransport.Mcp)
      value = await withMemoryMcp(home, async (client) => {
        const response = await client.callTool({
          name: McpIdentity.Usage,
          arguments: { run_id: id },
        });
        if (response.isError) return { error: true };
        const content = McpTextContentSchema.parse(response.content)[0];
        assert.ok(content);
        return JSON.parse(content.text);
      });
    if (!selected) return value;
    const report = RunUsageSchema.parse(value);
    assert.equal(report.run_id, run.run_id);
    assert.equal(report.through, run.version);
    assert.deepEqual(report, await createRunClient(home).usage(id));
    return {
      executions: report.executions,
      reported: report.reported_executions,
      unreported: report.unreported_executions,
      known: report.known,
      complete: report.complete,
    };
  });
}

export async function usageResponse(value: unknown) {
  return withClientResponse(Response.json(value), async (client) => client.usage("run"));
}

export async function usageHttpRoute(suffix = "usage", query = "", method = "GET") {
  return withArtifactRun(false, async (run, home) => {
    const address = await readAddress(home);
    const response = await fetch(`${address.url}/runs/${run.run_id}/${suffix}${query}`, {
      method,
      headers: { authorization: `Bearer ${address.token}` },
    });
    return response.status;
  });
}
