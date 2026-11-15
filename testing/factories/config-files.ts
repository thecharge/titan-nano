import { strict as assert } from "node:assert";
import { chmod, copyFile, link, mkdir, stat, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { inspectConfigFile, writeConfigFile } from "@titan/config/files";
import {
  ConfigFile,
  ConfigScope,
  ConfigWrite,
  ErrorCode,
  ExitCode,
  HookFile,
  IoLimit,
  Packaging,
} from "@titan/constants";
import { all, hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { readFileBytes } from "@titan/streams";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { CliOutputSchema, ConfigFileVersionSchema } from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { captureCli } from "../support/command.ts";

export async function configFileRead(scope: ConfigScope, mode: string) {
  return withTemporaryDirectory(async (root) => {
    const path = resolve(root, scope === ConfigScope.User ? ConfigFile.User : ConfigFile.Project);
    await mkdir(dirname(path), { recursive: true });
    if (mode === "file") await writeFile(path, "{}");
    if (mode === "directory") await mkdir(path);
    if (mode === "loop") await symlink(path, path);
    const result = await inspectConfigFile({ home: root, project: root, scope });
    assert.equal(result.path, path);
    assert.equal(result.version, mode === "file" ? hash("{}") : null);
    return true;
  });
}

async function invokeConfig(args: string[], outputs: unknown[], cli?: string): Promise<number> {
  if (!cli) return createCli({ ...defaultServices, output: (item) => outputs.push(item) })(args);
  const result = await captureCli(cli, args);
  assert.equal(result.error.byteLength, 0);
  const envelope = CliOutputSchema.parse(JSON.parse(result.output.toString()));
  if (envelope.error) throw new TitanError(envelope.error.code, envelope.error.message);
  outputs.push(envelope.data);
  assert.equal(result.code, ExitCode.Success);
  return ExitCode.Success;
}

export async function configFileEdit(
  scope: ConfigScope,
  name: string,
  value: string,
  cli?: string,
) {
  return withTemporaryDirectory(async (root) => {
    const outputs: unknown[] = [];
    if (scope === ConfigScope.Project) {
      const owner = { requests: { max_per_run: 2 }, approvals: { tool: "human" } };
      await writeFile(resolve(root, ConfigFile.User), Buffer.from(JSON.stringify(owner)));
    }
    const main = (args: string[]) => invokeConfig(args, outputs, cli);
    const flags = ["--scope", scope, "--home", root, "--project", root, "--json"];
    assert.equal(await main(["config", "init", ...flags]), ExitCode.Success);
    const initial = ConfigFileVersionSchema.parse(outputs.at(-1));
    assert.equal((await stat(initial.path)).mode & 0o777, ConfigWrite.FileMode);
    const before = await readFileBytes(initial.path, IoLimit.DataBytes);
    const failure = await thrownBy(() =>
      main(["config", "set", name, value, "--expected-version", initial.version ?? "", ...flags]),
    );
    if (failure !== undefined && !(failure instanceof TitanError)) throw failure;
    const bytes = await readFileBytes(initial.path, IoLimit.DataBytes);
    assert.equal(await main(["config", "validate", ...flags]), ExitCode.Success);
    const final = ConfigFileVersionSchema.parse(outputs.at(-1));
    assert.equal(final.version, hash(bytes));
    return {
      error: failure instanceof TitanError ? failure.code : null,
      changed: !before.equals(bytes),
    };
  });
}

export async function configFileConcurrency(scope: ConfigScope, stale: boolean, cli?: string) {
  return withTemporaryDirectory(async (root) => {
    const target = { home: root, project: root, scope };
    const initial = await writeConfigFile({ ...target, expected_version: null, patch: {} });
    const expected_version = stale ? hash("stale configuration") : initial.version;
    const writes = [2, 3].map((max_parallel) => async () => {
      const patch = { limits: { max_parallel } };
      const failure = await thrownBy(async () => {
        if (!cli) return writeConfigFile({ ...target, expected_version, patch });
        return invokeConfig(
          [
            "config",
            "set",
            "limits.max_parallel",
            String(max_parallel),
            "--expected-version",
            expected_version,
            "--scope",
            scope,
            "--home",
            root,
            "--project",
            root,
            "--json",
          ],
          [],
          cli,
        );
      });
      if (failure !== undefined && !(failure instanceof TitanError)) throw failure;
      return failure instanceof TitanError ? failure.code : null;
    });
    const outcomes = await all(writes, 2);
    const final = await inspectConfigFile(target);
    const path = resolve(root, scope === ConfigScope.User ? ConfigFile.User : ConfigFile.Project);
    assert.equal(final.version, hash(await readFileBytes(path, IoLimit.DataBytes)));
    return {
      successes: outcomes.filter((code) => code === null).length,
      conflicts: outcomes.filter((code) => code === ErrorCode.ConfigConflict).length,
      changed: initial.version !== final.version,
    };
  });
}

export async function configFileLease(scope: ConfigScope, blocked: boolean, corrupt = false) {
  return withTemporaryDirectory(async (root) => {
    const target = { home: root, project: root, scope };
    const initial = await writeConfigFile({ ...target, expected_version: null, patch: {} });
    const lock = initial.path + ConfigWrite.LockSuffix;
    if (corrupt) await writeFile(lock, Buffer.from("invalid SQLite database"));
    await using resources = new AsyncDisposableStack();
    const lease = new Bun.SQL({ adapter: ConfigWrite.Adapter, filename: lock });
    resources.defer(() => lease.close());
    if (blocked) await lease.unsafe(ConfigWrite.Claim);
    const patch = { limits: { max_parallel: 2 } };
    const failure = await thrownBy(() =>
      writeConfigFile({ ...target, expected_version: initial.version, patch }),
    );
    if (failure !== undefined && !(failure instanceof TitanError)) throw failure;
    assert.equal((await stat(lock)).mode & 0o777, ConfigWrite.FileMode);
    const final = await inspectConfigFile(target);
    return {
      error: failure instanceof TitanError ? failure.code : null,
      changed: initial.version !== final.version,
    };
  });
}

export async function configFileBoundary(scope: ConfigScope, mode: string, cli?: string) {
  return withTemporaryDirectory(async (root) => {
    const target = { home: root, project: root, scope };
    const path = resolve(root, scope === ConfigScope.User ? ConfigFile.User : ConfigFile.Project);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, "{}\n");
    const initial = await inspectConfigFile(target);
    const external = resolve(root, "external.db");
    const database = new Bun.SQL({ adapter: ConfigWrite.Adapter, filename: external });
    await database.unsafe("CREATE TABLE retained (value TEXT)");
    await database.close();
    await chmod(external, 0o644);
    const before = await readFileBytes(external, IoLimit.DataBytes);
    const lock = path + ConfigWrite.LockSuffix;
    const guarded = lock + (mode.includes("companion") ? "-journal" : "");
    if (mode === "existing") await copyFile(external, lock);
    if (mode.startsWith("symbolic")) await symlink(external, guarded);
    if (mode.startsWith("hard")) await link(external, guarded);
    if (mode === "directory") await mkdir(lock);
    const outputs: unknown[] = [];
    const failure = await thrownBy(() =>
      invokeConfig(
        [
          "config",
          "set",
          "limits.max_parallel",
          "2",
          "--expected-version",
          initial.version ?? "",
          "--scope",
          scope,
          "--home",
          root,
          "--project",
          root,
          "--json",
        ],
        outputs,
        cli,
      ),
    );
    if (failure !== undefined && !(failure instanceof TitanError)) throw failure;
    assert.deepEqual(await readFileBytes(external, IoLimit.DataBytes), before);
    assert.equal((await stat(external)).mode & 0o777, 0o644);
    const final = await inspectConfigFile(target);
    return {
      error: failure instanceof TitanError ? failure.code : null,
      changed: initial.version !== final.version,
    };
  });
}

export async function configFileBoundaryProcess(
  scope: ConfigScope,
  mode: string,
  cli = resolve(import.meta.dir, HookFile.RepositoryRoot, Packaging.CliSource),
) {
  return configFileBoundary(scope, mode, cli);
}

export async function configFileArguments(args: string[]) {
  const output: unknown[] = [];
  const main = createCli({ ...defaultServices, output: (item) => output.push(item) });
  const failure = await thrownBy(() => main(args));
  if (failure !== undefined && !(failure instanceof TitanError)) throw failure;
  return { error: failure instanceof TitanError ? failure.code : null, output: output.length > 0 };
}

export async function configFileProcess(
  scope: ConfigScope,
  name: string,
  value: string,
  cli = resolve(import.meta.dir, HookFile.RepositoryRoot, Packaging.CliSource),
) {
  return configFileEdit(scope, name, value, cli);
}

export async function configConcurrentProcess(
  scope: ConfigScope,
  stale: boolean,
  cli = resolve(import.meta.dir, HookFile.RepositoryRoot, Packaging.CliSource),
) {
  return configFileConcurrency(scope, stale, cli);
}
