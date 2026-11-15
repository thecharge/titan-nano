import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  BoardFile,
  CliCommand,
  CliOption,
  type ErrorCode,
  ExitCode,
  GraphValidationFixture,
  GraphValidationMode,
  IoLimit,
  Packaging,
} from "@titan/constants";
import { readFileBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { CliOutputSchema, WorkflowCheckItemSchema } from "@titan/types";
import { exists } from "@titan/workspace";
import { captureCli } from "../support/command.ts";
import { checkedWorkflow } from "./hardening.ts";

function graphWorkflow(mode: GraphValidationMode) {
  const { steps, ...base } = checkedWorkflow();
  const source = steps[0];
  assert(source);
  const firstNeeds: string[] = [];
  const first = { ...source, id: GraphValidationFixture.First, needs: firstNeeds };
  const leftNeeds: string[] = [first.id];
  const left = { ...source, id: GraphValidationFixture.Left, needs: leftNeeds };
  const right = { ...source, id: GraphValidationFixture.Right, needs: [first.id] };
  const branch = { ...source, id: GraphValidationFixture.Branch, needs: [left.id] };
  const join = { ...source, id: GraphValidationFixture.Join, needs: [right.id, branch.id] };
  if (mode === GraphValidationMode.Groups) {
    const parallel = {
      parallel: [
        { ...source, id: left.id },
        { ...source, id: right.id },
      ],
    };
    return { ...base, steps: [source, parallel, { ...source, id: join.id }] };
  }
  if (mode === GraphValidationMode.GroupNeeds) return { ...base, steps: [first] };
  if (mode === GraphValidationMode.Cycle) first.needs.push(join.id);
  if (mode === GraphValidationMode.Missing) left.needs = [GraphValidationFixture.Missing];
  const nodes = [first, left, right, branch, join];
  if (mode === GraphValidationMode.Duplicate) nodes.push(first);
  const graph = { nodes: mode === GraphValidationMode.Reversed ? nodes.reverse() : nodes };
  if (mode === GraphValidationMode.Input) {
    const inputs = { [GraphValidationFixture.Input]: GraphValidationFixture.Reference };
    const changed = { ...branch, needs: [right.id], inputs };
    const changedGraph = { nodes: [...nodes.slice(0, 3), changed, join] };
    return { ...base, graph: changedGraph };
  }
  if (mode === GraphValidationMode.Forms) return { ...base, steps, graph };
  return { ...base, graph };
}

export async function graphValidation(
  mode: GraphValidationMode,
  expected: string[][] | ErrorCode,
  fragments: string[],
  cli = resolve(Packaging.CliSource),
) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, GraphValidationFixture.Home);
    const project = resolve(root, GraphValidationFixture.Project);
    await mkdir(project);
    const source = Buffer.from(Bun.YAML.stringify(graphWorkflow(mode)));
    const path = resolve(project, GraphValidationFixture.Source);
    await writeFile(path, source);
    const result = await captureCli(cli, [
      CliCommand.Run,
      path,
      `--${CliOption.DryRun}`,
      `--${CliOption.Json}`,
      `--${CliOption.Home}`,
      home,
      `--${CliOption.Project}`,
      project,
    ]);
    assert.equal(result.error.length, 0);
    const envelope = CliOutputSchema.parse(JSON.parse(result.output.toString()));
    assert.equal(envelope.operation, CliCommand.Run);
    assert.equal(envelope.identifiers.run_id, null);
    if (Array.isArray(expected)) {
      assert.equal(result.code, ExitCode.Success, result.output.toString());
      assert.equal(envelope.error, null);
      const plan = WorkflowCheckItemSchema.omit({ path: true }).parse(envelope.data);
      assert.deepEqual(
        plan.nodes.map((node) => [node.id, ...(node.needs ?? [])]),
        expected,
      );
    } else {
      assert.equal(result.code, ExitCode.Input, result.output.toString());
      assert.equal(envelope.error?.code, expected);
      assert.equal(envelope.data, null);
    }
    for (const fragment of fragments) assert(envelope.error?.message.includes(fragment));
    assert.equal(await exists(home), false);
    assert.equal(await exists(resolve(project, BoardFile.Runs)), false);
    assert.deepEqual(await readFileBytes(path, IoLimit.DataBytes), source);
    return true;
  });
}
