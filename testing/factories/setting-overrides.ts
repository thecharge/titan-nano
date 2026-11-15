import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { settingOverrides } from "@titan/config";
import { Backend, ConfigSource, ExitCode, RunStatus } from "@titan/constants";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { EffectiveConfigSchema, RunSchema } from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { createFakeBackend } from "../support/backend.ts";

export async function settingAssignments(
  entries?: string[],
  initial: Record<string, unknown> = {},
) {
  const before = structuredClone(initial);
  try {
    return settingOverrides(entries, initial);
  } finally {
    assert.deepEqual(initial, before);
  }
}

export async function cliSettingAssignments(args: string[]) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    await mkdir(project);
    await mkdir(home);
    await writeFile(
      resolve(home, "config.yaml"),
      Buffer.from("limits:\n  max_parallel: 2\nrecovery:\n  max_retries: 4\n"),
    );
    const output: unknown[] = [];
    const cli = createCli({ ...defaultServices, output: (value) => output.push(value) });
    assert.equal(
      await cli(["config", "--home", home, "--project", project, "--json", ...args]),
      ExitCode.Success,
    );
    const result = EffectiveConfigSchema.parse(output[0]);
    assert.ok(result.hash);
    for (const entry of args.filter((entry) => entry.includes("="))) {
      const name = entry.slice(0, entry.indexOf("="));
      assert.equal(result.sources[name]?.at(-1), ConfigSource.Cli);
    }
    return {
      parallel: result.value.limits.max_parallel,
      retries: result.value.recovery.max_retries,
      backend: result.value.defaults.backend,
      minutes: result.value.limits.max_minutes,
    };
  });
}

export async function cliSettingSubmission(args: string[]) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(project);
    const path = resolve(project, "workflow.yaml");
    await writeFile(path, Buffer.from(Bun.YAML.stringify(vendorRecoveryWorkflow())));
    const server = await startServer(home, createFakeBackend);
    try {
      const output: unknown[] = [];
      const cli = createCli({ ...defaultServices, output: (value) => output.push(value) });
      assert.equal(
        await cli([
          "run",
          path,
          "--home",
          home,
          "--project",
          project,
          "--backend",
          Backend.Fake,
          "--watch",
          "--json",
          ...args,
        ]),
        ExitCode.Success,
      );
      const run = RunSchema.parse(output[0]);
      assert.equal(run.state, RunStatus.Passed);
      const reloaded = RunSchema.parse(await createRunClient(home).get(run.run_id));
      assert.deepEqual(reloaded.config, run.config);
      assert.equal(run.config.sources["limits.max_parallel"]?.at(-1), ConfigSource.Cli);
      return {
        parallel: run.config.value.limits.max_parallel,
        retries: run.config.value.recovery.max_retries,
      };
    } finally {
      await server.stop();
    }
  });
}
