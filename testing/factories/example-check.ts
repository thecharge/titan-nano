import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CliCommand,
  CliRuntime,
  ExampleCheckMutation,
  ExitCode,
  IoLimit,
  Packaging,
  ProbeOption,
} from "@titan/constants";
import { readFileBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { CliOutputSchema, WorkflowCheckBatchSchema, WorkflowSchema } from "@titan/types";
import { exists } from "@titan/workspace";
import { captureCli } from "../support/command.ts";

export async function workflowExamplesCheck(
  json: boolean,
  mutation = ExampleCheckMutation.None,
  cli = resolve(Packaging.CliSource),
  assets = resolve("."),
) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(resolve(project, Packaging.Examples), { recursive: true });
    const files: string[] = [];
    const sources = new Map<string, Buffer>();
    for await (const file of new Bun.Glob("*.yaml").scan(resolve(assets, Packaging.Examples))) {
      const path = `${Packaging.Examples}/${file}`;
      const source = await readFileBytes(resolve(assets, path), IoLimit.DataBytes);
      files.push(path);
      sources.set(path, source);
      await writeFile(resolve(project, path), source);
    }
    files.sort();
    assert.ok(files.length >= 6);
    if (mutation === ExampleCheckMutation.Invalid) {
      const path = "examples/invalid.yaml";
      const source = Buffer.from("name: Incomplete workflow\n");
      await writeFile(resolve(project, path), source);
      sources.set(path, source);
      files.push(path);
    }
    if (mutation === ExampleCheckMutation.Missing) files.push("examples/missing.yaml");
    if (mutation === ExampleCheckMutation.Empty) files.push("");
    if (mutation === ExampleCheckMutation.Count)
      files.push(...Array<string>(CliRuntime.MaximumPositionals).fill(files[0] ?? ""));
    if (mutation === ExampleCheckMutation.Output) {
      const first = files[0];
      assert.ok(first);
      const workflow = WorkflowSchema.parse(Bun.YAML.parse(sources.get(first)?.toString() ?? ""));
      const step = workflow.steps?.[0];
      assert.ok(step && "do" in step && "persona" in step.do);
      step.do.task = "Bounded output ".repeat(45000);
      const source = Buffer.from(Bun.YAML.stringify(workflow));
      await writeFile(resolve(project, first), source);
      sources.set(first, source);
      files.splice(0, files.length, first, first);
    }
    const result = await captureCli(
      cli,
      [CliCommand.Check, ...files, ProbeOption.Home, home, ...(json ? [CliRuntime.JsonFlag] : [])],
      project,
    );
    assert.equal(await exists(home), false);
    assertCheckResult(result.output, result.error, result.code, files, json, mutation);
    for (const [file, source] of sources)
      assert.deepEqual(await readFileBytes(resolve(project, file), IoLimit.DataBytes), source);
    return true;
  });
}

function assertCheckResult(
  output: Buffer,
  error: Buffer,
  code: number,
  files: string[],
  json: boolean,
  mutation: ExampleCheckMutation,
): void {
  if (mutation === ExampleCheckMutation.None) {
    assert.equal(code, ExitCode.Success, error.toString());
    if (json) {
      const batch = WorkflowCheckBatchSchema.parse(
        CliOutputSchema.parse(JSON.parse(output.toString())).data,
      );
      assert.deepEqual(
        batch.workflows.map((entry) => entry.path),
        files,
      );
      assert.ok(batch.workflows.every((entry) => entry.nodes.length > 0 && entry.config.hash));
    } else
      assert.deepEqual(
        output.toString().trim().split("\n"),
        files.map(() => "ok"),
      );
  } else {
    assert.equal(code, ExitCode.Input, error.toString());
    if (json) {
      const failure = CliOutputSchema.parse(JSON.parse(output.toString()));
      assert.ok(failure.error);
      assert.equal(failure.data, null);
      assert(mutation !== ExampleCheckMutation.Invalid || failure.error.paths.includes("goal"));
    }
    const diagnostic = output.toString() + error.toString();
    if (mutation === ExampleCheckMutation.Invalid) assert.match(diagnostic, /invalid.yaml.*goal/s);
    if (mutation === ExampleCheckMutation.Missing) assert.match(diagnostic, /missing.yaml/);
  }
}
