import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveConfig } from "@titan/config";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { EffectiveConfigSchema } from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";

export async function cliConfigInspection(owner: unknown, workflow?: unknown) {
  return withTemporaryDirectory(async (root) => {
    await writeFile(resolve(root, "config.yaml"), Buffer.from(JSON.stringify(owner)));
    let reads = 0;
    const output: unknown[] = [];
    const main = createCli({
      ...defaultServices,
      loadData: async () => {
        reads++;
        return workflow;
      },
      output: (item) => output.push(item),
    });
    const exit = await main([
      "config",
      ...(workflow === undefined ? [] : ["workflow.yaml"]),
      "--home",
      root,
      "--project",
      root,
      "--json",
    ]);
    return {
      exit,
      reads,
      parallel: EffectiveConfigSchema.parse(output[0]).value.limits.max_parallel,
    };
  });
}

export async function configuredParallelism(
  contents: string | null,
  explicit: boolean,
): Promise<unknown> {
  return withTemporaryDirectory(async (directory) => {
    const path = resolve(directory, "config.yaml");
    if (contents !== null) await writeFile(path, Buffer.from(contents));
    const config = await resolveConfig({
      home: resolve(directory, "home"),
      project: directory,
      configFile: explicit ? path : undefined,
      overrides: explicit ? undefined : { limits: { max_parallel: 3 } },
    });
    return config.value.limits.max_parallel;
  });
}

export async function configuredBackendLaunch(backend: string, launch: unknown, owner: boolean) {
  return withTemporaryDirectory(async (directory) => {
    const project = resolve(directory, "project");
    await mkdir(project);
    const file = resolve(owner ? directory : project, "config.yaml");
    await writeFile(
      file,
      Buffer.from(JSON.stringify({ server: { backends: { [backend]: launch } } })),
    );
    const config = await resolveConfig({
      home: directory,
      project,
      ...(owner ? {} : { configFile: file }),
    });
    return config.value.server.backends;
  });
}

export async function configuredAgentHost(settings: unknown, owner: boolean) {
  return withTemporaryDirectory(async (directory) => {
    const project = resolve(directory, "project");
    await mkdir(project);
    const file = resolve(owner ? directory : project, "config.yaml");
    await writeFile(file, Buffer.from(JSON.stringify({ server: { agent_host: settings } })));
    return (
      await resolveConfig({ home: directory, project, ...(owner ? {} : { configFile: file }) })
    ).value.server.agent_host;
  });
}

export async function configuredNativeTransport(transport: unknown, owner: boolean) {
  return withTemporaryDirectory(async (directory) => {
    const project = resolve(directory, "project");
    await mkdir(project);
    const file = resolve(owner ? directory : project, "config.yaml");
    const native_tools = transport === undefined ? {} : { transport };
    await writeFile(file, Buffer.from(JSON.stringify({ server: { native_tools } })));
    return (
      await resolveConfig({ home: directory, project, ...(owner ? {} : { configFile: file }) })
    ).value.server.native_tools.transport;
  });
}
