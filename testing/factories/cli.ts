import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  Backend,
  BoardFile,
  CliCatalogFixture,
  CliCommand,
  CliInvocationKind,
  ExitCode,
} from "@titan/constants";
import { readFileBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { CliOutputSchema, ConfigSchema, JsonValueSchema, ObjectSchema } from "@titan/types";
import { exists } from "@titan/workspace";
import { commandDefinition, commands } from "../../apps/cli/src/catalog.ts";
import { parseInvocation } from "../../apps/cli/src/parser.ts";
import { cliSettingOverrides } from "../../apps/cli/src/setting-overrides.ts";
import { captureCli, runCliCommand } from "../support/command.ts";

export async function checkedInvocation(args: string[]) {
  const parsed = parseInvocation(args);
  if (parsed.kind === CliInvocationKind.Command)
    return { kind: parsed.kind, name: parsed.name, argument: parsed.positionals[0] };
  return { kind: parsed.kind };
}

export async function catalogContract(name: string) {
  const bytes = await readFileBytes(
    resolve(import.meta.dir, CliCatalogFixture.File),
    CliCatalogFixture.MaximumBytes,
  );
  const expected = ObjectSchema.parse(JSON.parse(bytes.toString()));
  assert.deepEqual(commands, Object.keys(expected));
  const definition = commandDefinition(name);
  const projected = definition
    ? JsonValueSchema.parse(
        JSON.parse(
          JSON.stringify(definition, (_key, value: unknown) =>
            typeof value === CliCatalogFixture.FunctionType
              ? CliCatalogFixture.FunctionMarker
              : value,
          ),
        ),
      )
    : undefined;
  assert.deepEqual(projected, Object.hasOwn(expected, name) ? expected[name] : undefined);
  return true;
}

export async function cliWorkflowCheck(value: unknown, valid: boolean, fragments: string[]) {
  async function observe(project: string) {
    const home = resolve(project, "home");
    const path = resolve(project, "bad.yaml");
    const cli = resolve(import.meta.dir, "../../apps/cli/src/main.ts");
    await writeFile(path, Buffer.from(Bun.YAML.stringify(value)));
    async function inspect(command: string, json: boolean) {
      const args = [command, path, "--home", home, "--project", project];
      if (json) args.push("--json");
      const result = await captureCli(cli, args);
      assert.equal(result.code, valid ? ExitCode.Success : ExitCode.Input);
      const output = result.output.toString();
      const error = result.error.toString();
      if (valid) {
        assert.equal(
          json
            ? ObjectSchema.parse(CliOutputSchema.parse(JSON.parse(output)).data).ok
            : output.trim(),
          json ? true : "ok",
        );
        assert.equal(error, "");
        return;
      }
      const diagnostic = json
        ? (CliOutputSchema.parse(JSON.parse(output)).error?.message ?? "")
        : error;
      for (const fragment of fragments) assert.ok(diagnostic.includes(fragment), fragment);
      assert.equal(json ? error : output, "");
    }
    for (const json of [false, true]) {
      await inspect(CliCommand.Check, json);
      if (!valid) await inspect(CliCommand.Run, json);
    }
    assert.equal(await exists(resolve(project, BoardFile.Runs)), false);
    assert.equal(await exists(home), false);
    return true;
  }
  return withTemporaryDirectory(observe);
}

export async function cliWorkflowInputs(value: unknown, code: string | null, fragments: string[]) {
  function inspect(input: unknown) {
    const response = ObjectSchema.parse(input);
    if (code === null) {
      assert.equal(response.ok, true);
      return;
    }
    assert.equal(response.code, code);
    for (const fragment of fragments)
      assert.ok(String(response.message).includes(fragment), fragment);
  }
  async function observe(project: string) {
    const home = resolve(project, "home");
    const path = resolve(project, "workflow.yaml");
    const cli = resolve(import.meta.dir, "../../apps/cli/src/main.ts");
    await writeFile(path, Buffer.from(Bun.YAML.stringify(value)));
    for (const command of [CliCommand.Check, CliCommand.Run]) {
      const args = [command, path, "--project", project, "--backend", Backend.Fake];
      if (code === null && command === CliCommand.Run) args.push("--dry-run");
      inspect(
        await runCliCommand(cli, home, args, code === null ? ExitCode.Success : ExitCode.Input),
      );
    }
    assert.equal(await exists(resolve(project, BoardFile.Runs)), false);
    assert.equal(await exists(home), false);
    return true;
  }
  return withTemporaryDirectory(observe);
}

export async function cliBackend(args: string[]) {
  const invocation = parseInvocation(args);
  assert.equal(invocation.kind, CliInvocationKind.Command);
  return ConfigSchema.parse(cliSettingOverrides(invocation.values)).defaults.backend;
}

export function cliObservation(args: string[]) {
  const invocation = parseInvocation(args);
  assert.equal(invocation.kind, CliInvocationKind.Command);
  return { watch: invocation.values.watch ?? null, detach: invocation.values.detach ?? false };
}
