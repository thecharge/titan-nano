import { strict as assert } from "node:assert";
import {
  cp,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  symlink,
  writeFile,
} from "node:fs/promises";
import { delimiter, dirname, resolve } from "node:path";
import {
  CliCommand,
  CliRuntime,
  ExitCode,
  FileEncoding,
  Harness,
  HarnessPlugin,
  IoLimit,
  Newline,
  Packaging,
  ProbeOption,
  ProcessIo,
} from "@titan/constants";
import { all } from "@titan/core";
import { readBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { CliOutputSchema, InstallResultSchema, PluginMcpSchema } from "@titan/types";

export function installedRegistration(cli: string, harness: Harness) {
  return withTemporaryDirectory(async (root) => {
    const packageRoot = dirname(await realpath(cli));
    const dependencies = resolve(packageRoot, "../..");
    const installation = resolve(root, "installation");
    const release = resolve(installation, "releases/titan-cli-original");
    const entry = resolve(release, Packaging.InstalledPath, Packaging.Bundle);
    await mkdir(dirname(resolve(release, Packaging.InstalledPath)), { recursive: true });
    await cp(packageRoot, resolve(release, Packaging.InstalledPath), { recursive: true });
    for (const name of await readdir(dependencies)) {
      if (name === ".bin" || name === "@titan") continue;
      await symlink(resolve(dependencies, name), resolve(release, "node_modules", name));
    }
    const binary = resolve(release, Packaging.CliPath);
    await mkdir(dirname(binary));
    await symlink(entry, binary);
    const launcher = resolve(installation, HarnessPlugin.Command);
    await symlink(binary, launcher);
    const before = await readFile(entry);
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    const stubs = resolve(root, "bin");
    await mkdir(project);
    await mkdir(stubs);
    for (const name of Packaging.ProbeStubNames)
      await writeFile(resolve(stubs, name), Packaging.ProbeStubScript, {
        mode: Packaging.ProbeStubMode,
      });
    const child = Bun.spawn(
      [
        process.execPath,
        entry,
        CliCommand.Install,
        ProbeOption.NoModel,
        ProbeOption.Harness,
        harness,
        ProbeOption.Home,
        home,
        ProbeOption.Project,
        project,
        CliRuntime.JsonFlag,
      ],
      {
        env: {
          ...process.env,
          PATH: [stubs, process.env.PATH].filter(Boolean).join(delimiter),
          [Packaging.ProbeRegistrationVariable]: root,
        },
        cwd: project,
        stdout: ProcessIo.Pipe,
        stderr: ProcessIo.Pipe,
        timeout: Packaging.OutputMilliseconds,
      },
    );
    const [out, err] = await all([
      () => readBytes(child.stdout, IoLimit.ResponseBytes),
      () => readBytes(child.stderr, IoLimit.ResponseBytes),
    ]);
    assert.equal(await child.exited, ExitCode.Success, err.toString());
    assert.equal(
      InstallResultSchema.parse(CliOutputSchema.parse(JSON.parse(out.toString())).data).mcp,
      HarnessPlugin.Server,
    );
    const expected = [
      process.execPath,
      launcher,
      ...HarnessPlugin.Arguments,
      ProbeOption.Home,
      home,
    ];
    const registration = await readFile(
      resolve(root, harness + Packaging.ProbeRegistrationSuffix),
      FileEncoding.Utf8,
    );
    assert.deepEqual(registration.trimEnd().split(Newline), [
      project,
      ...(harness === Harness.Codex ? HarnessPlugin.CodexAdd : HarnessPlugin.ClaudeAdd),
      ...expected,
    ]);
    if (harness === Harness.Claude) {
      const plugin = PluginMcpSchema.parse(
        JSON.parse(
          await readFile(
            resolve(project, HarnessPlugin.Folder, HarnessPlugin.McpFile),
            FileEncoding.Utf8,
          ),
        ),
      ).mcpServers[HarnessPlugin.Server];
      assert.deepEqual([plugin.command, ...plugin.args], expected);
    }
    const nextEntry = resolve(
      installation,
      "releases/titan-cli-next",
      Packaging.InstalledPath,
      Packaging.Bundle,
    );
    await mkdir(dirname(nextEntry), { recursive: true });
    await writeFile(nextEntry, 'console.log("Selected next release");\n');
    const nextLauncher = resolve(installation, "next-launcher");
    await symlink(nextEntry, nextLauncher);
    await rename(nextLauncher, launcher);
    const next = Bun.spawn([process.execPath, launcher, ProbeOption.Version], {
      env: { ...process.env, PATH: "" },
      stdout: ProcessIo.Pipe,
      stderr: ProcessIo.Pipe,
      timeout: Packaging.OutputMilliseconds,
    });
    const [selected, failure] = await all([
      () => readBytes(next.stdout, IoLimit.ResponseBytes),
      () => readBytes(next.stderr, IoLimit.ResponseBytes),
    ]);
    assert.equal(await next.exited, ExitCode.Success, failure.toString());
    assert.equal(selected.toString().trim(), "Selected next release");
    assert.deepEqual(await readFile(entry), before);
    return true;
  });
}
