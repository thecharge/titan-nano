import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  Backend,
  BoardFile,
  CliCommand,
  ConfigFile,
  ConfiguredStartupFixture,
  ExampleFixture,
  ExitCode,
  IoLimit,
  Packaging,
  ProbeOption,
  RunStatus,
  type WorkflowExample,
} from "@titan/constants";
import { readFileBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { FakeScriptSchema } from "@titan/types";
import { exists } from "@titan/workspace";
import { captureCli } from "../support/command.ts";
import { stopOwnedDaemon } from "../support/daemon.ts";
import { humanExample } from "./examples.ts";

export function cliConfiguredStartup(
  example: WorkflowExample,
  mutation: ConfiguredStartupFixture,
  cli = resolve(Packaging.CliSource),
  assets = resolve("."),
) {
  return withTemporaryDirectory((root) => configuredStartup(root, example, mutation, cli, assets));
}

async function configuredStartup(
  root: string,
  example: WorkflowExample,
  mutation: ConfiguredStartupFixture,
  cli: string,
  assets: string,
): Promise<boolean> {
  const project = resolve(root, "project");
  const home = resolve(root, "home");
  const file = `${Packaging.Examples}/${example}${ExampleFixture.WorkflowSuffix}`;
  const answers = `${Packaging.Answers}/${example}${ExampleFixture.AnswersSuffix}`;
  const source = await readFileBytes(resolve(assets, file), IoLimit.DataBytes);
  const script = FakeScriptSchema.parse(
    Bun.YAML.parse((await readFileBytes(resolve(assets, answers), IoLimit.DataBytes)).toString()),
  );
  await mkdir(resolve(project, Packaging.Examples), { recursive: true });
  await mkdir(resolve(project, ConfigFile.HomeDirectory));
  await writeFile(resolve(project, file), source);
  const fake = {
    script: mutation === ConfiguredStartupFixture.Script ? { ...script, version: 2 } : script,
  };
  await writeFile(
    resolve(project, ConfigFile.Project),
    Buffer.from(
      Bun.YAML.stringify({
        defaults: {
          backend: mutation === ConfiguredStartupFixture.Backend ? "unsupported" : Backend.Fake,
        },
        backends: { fake },
      }),
    ),
  );
  try {
    const result = await captureCli(cli, [CliCommand.Run, file, ProbeOption.Home, home], project);
    if (mutation !== ConfiguredStartupFixture.None) {
      assert.equal(result.code, ExitCode.Input);
      assert.equal(result.output.byteLength, 0);
      assert.ok(result.error.byteLength > 0);
      assert.equal(await exists(home), false);
      assert.equal(await exists(resolve(project, BoardFile.Runs)), false);
      return true;
    }
    assert.equal(result.code, ExitCode.Success, result.error.toString());
    assert.equal(result.error.byteLength, 0);
    const run = await humanExample(result.output);
    assert.equal(run.state, RunStatus.Passed);
    assert.equal(run.config.value.defaults.backend, Backend.Fake);
    assert.deepEqual(run.config.value.backends?.fake?.script, script);
    assert.equal(run.project, project);
    assert.deepEqual(await readFileBytes(resolve(project, file), IoLimit.DataBytes), source);
    return true;
  } finally {
    await stopOwnedDaemon(home);
  }
}
