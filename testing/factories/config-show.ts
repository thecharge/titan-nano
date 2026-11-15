import { strict as assert } from "node:assert";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describeConfigFile } from "@titan/config/files";
import {
  ConfigDefault,
  ConfigFile,
  ConfigScope,
  ConfigWrite,
  ErrorCode,
  ExitCode,
  IoLimit,
  LocalServer,
  Packaging,
} from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { readFileBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { CliOutputErrorSchema } from "@titan/types";
import { exists } from "@titan/workspace";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { runCliCommand } from "../support/command.ts";

async function showScopedConfig(home: string, args: string[], invalid: boolean, cli?: string) {
  if (cli) {
    const result = await runCliCommand(
      cli,
      home,
      args,
      invalid ? ExitCode.Input : ExitCode.Success,
    );
    if (!invalid) return result;
    const error = CliOutputErrorSchema.parse(result);
    throw new TitanError(error.code, error.message);
  }
  const outputs: unknown[] = [];
  const services = {
    ...defaultServices,
    output: (value: unknown) => outputs.push(value),
    client: assert.fail,
  };
  await createCli(services)([...args, "--home", home, "--json"]);
  assert.equal(outputs.length, 1);
  return outputs[0];
}

export async function scopedConfigShow(
  scope: ConfigScope,
  sources: boolean,
  invalid: boolean,
  absent: boolean,
  cli?: string,
) {
  return withTemporaryDirectory(async (project) => {
    const home = resolve(project, "home");
    await mkdir(home);
    await mkdir(resolve(project, ".titan"));
    const target = { home, project, scope };
    const userPath = resolve(home, ConfigFile.User);
    const projectPath = resolve(project, ConfigFile.Project);
    const path = scope === ConfigScope.User ? userPath : projectPath;
    const user = Buffer.from(JSON.stringify({ limits: { max_parallel: 3 } }));
    const local = Buffer.from(JSON.stringify({ limits: { max_parallel: 2 } }));
    await writeFile(userPath, user);
    await writeFile(projectPath, scope === ConfigScope.User ? Buffer.from("unknown: true") : local);
    if (invalid) await writeFile(path, Buffer.from("unknown: true"));
    const before = await readFileBytes(path, IoLimit.DataBytes);
    if (absent) {
      await unlink(path);
    }
    const args = ["config", "show", "--scope", scope, "--project", project];
    if (sources) args.push("--sources");
    const expectedSources = ["built-in"];
    if (scope === ConfigScope.Project) expectedSources.push(`user:${userPath}`);
    if (!absent) expectedSources.push(`${scope}:${path}`);
    if (invalid) {
      await assert.rejects(() => describeConfigFile(target), { code: ErrorCode.InvalidConfig });
      await assert.rejects(() => showScopedConfig(home, args, invalid, cli), {
        code: ErrorCode.InvalidConfig,
      });
    } else {
      const report = await describeConfigFile(target);
      assert.equal(report.path, path);
      assert.equal(report.scope, scope);
      assert.equal(report.version, absent ? null : hash(before));
      const count = scope === ConfigScope.User ? ConfigDefault.MaxParallel : 3;
      const selected = scope === ConfigScope.User ? 3 : 2;
      assert.equal(report.config.value.limits.max_parallel, absent ? count : selected);
      assert.equal(report.config.hash, hash(JSON.stringify(report.config.value)));
      assert.deepEqual(report.config.sources["limits.max_parallel"], expectedSources);
      const config = sources
        ? report.config
        : { value: report.config.value, hash: report.config.hash };
      assert.deepEqual(await showScopedConfig(home, args, invalid, cli), { ...report, config });
    }
    if (absent) assert.equal(await exists(path), false);
    else assert.deepEqual(await readFileBytes(path, IoLimit.DataBytes), before);
    assert.equal(await exists(path + ConfigWrite.LockSuffix), false);
    assert.equal(await exists(resolve(home, LocalServer.File)), false);
    return true;
  });
}

export function scopedConfigShowProcess(
  scope: ConfigScope,
  sources: boolean,
  invalid: boolean,
  absent: boolean,
  cli = resolve(Packaging.CliSource),
) {
  return scopedConfigShow(scope, sources, invalid, absent, cli);
}
