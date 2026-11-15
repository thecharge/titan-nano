import { strict as assert } from "node:assert";
import {
  CliCommand,
  CliRuntime,
  ExampleCheckMutation,
  ExitCode,
  ProbeOption,
} from "@titan/constants";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { WorkflowCheckBatchSchema } from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { checkedWorkflow } from "./hardening.ts";

export async function cliBatchCheck(json: boolean, mutation = ExampleCheckMutation.None) {
  return withTemporaryDirectory(async (root) => {
    const output: unknown[] = [];
    let loads = 0;
    const main = createCli({
      ...defaultServices,
      cwd: () => root,
      output: (value) => output.push(value),
      loadData: async () => {
        loads++;
        if (loads === 2 && mutation === ExampleCheckMutation.Missing)
          throw new Error("Missing source");
        if (loads === 2 && mutation === ExampleCheckMutation.Invalid) return { name: "Invalid" };
        const workflow = checkedWorkflow();
        const step = workflow.steps[0];
        assert.ok(step);
        if (mutation === ExampleCheckMutation.Output)
          step.do.task = "Bounded output ".repeat(45000);
        return workflow;
      },
    });
    const args = [
      CliCommand.Check,
      "first.yaml",
      "second.yaml",
      ProbeOption.Home,
      root,
      ...(json ? [CliRuntime.JsonFlag] : []),
    ];
    if (mutation === ExampleCheckMutation.Empty) args.splice(2, 1, "");
    if (mutation === ExampleCheckMutation.Count)
      args.splice(2, 0, ...Array<string>(CliRuntime.MaximumPositionals).fill("second.yaml"));
    if (mutation === ExampleCheckMutation.Empty || mutation === ExampleCheckMutation.Count) {
      await assert.rejects(main(args), { message: /positional arguments/ });
      assert.equal(loads, 0);
      assert.equal(output.length, 0);
      return true;
    }
    if (mutation !== ExampleCheckMutation.None) {
      await assert.rejects(main(args), {
        message: mutation === ExampleCheckMutation.Output ? /byte limit/i : /second.yaml/,
      });
      assert.equal(loads, 2);
      assert.equal(output.length, json ? 0 : 1);
      return true;
    }
    assert.equal(await main(args), ExitCode.Success);
    assert.equal(loads, 2);
    if (json) {
      assert.equal(output.length, 1);
      const batch = WorkflowCheckBatchSchema.parse(output[0]);
      assert.deepEqual(
        batch.workflows.map((entry) => entry.path),
        ["first.yaml", "second.yaml"],
      );
      assert.deepEqual(batch.workflows[0]?.nodes, batch.workflows[1]?.nodes);
    } else assert.deepEqual(output, ["ok", "ok"]);
    return true;
  });
}
