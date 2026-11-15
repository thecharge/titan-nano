import { strict as assert } from "node:assert";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { EOL } from "node:os";
import { dirname, resolve } from "node:path";
import { homePath } from "@titan/config";
import {
  CliOption,
  CliRuntime,
  ExitCode,
  FakeCodexInstall,
  GuideExamples,
  Harness,
  HarnessPlugin,
  HarnessSkillDirectory,
  InstallPart,
  Packaging,
  SkillDocument,
} from "@titan/constants";
import { all } from "@titan/core";
import { installedSkill } from "@titan/messages";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type CliServices,
  InstallResultSchema,
  PluginManifestSchema,
  PluginMcpSchema,
  SkillHeaderSchema,
} from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices, renderOutput } from "../../apps/cli/src/bootstrap.ts";
import { renderGuide } from "../../apps/cli/src/guide.ts";
import { launch } from "../../apps/cli/src/launch.ts";

const GitCommand = "git";
const GitPath = "/usr/bin/git";

const fakeCodex = resolve(import.meta.dir, FakeCodexInstall.Script);
const examples = resolve(import.meta.dir, "../..", GuideExamples.Folder);

const skillPath = (project: string, harness: Harness): string =>
  resolve(project, HarnessSkillDirectory[harness], CliRuntime.SkillFile);

async function printed(
  args: readonly string[],
  overrides: Partial<CliServices> = {},
  expectedExit: number = ExitCode.Success,
): Promise<string> {
  const lines: string[] = [];
  const main = createCli({
    ...defaultServices,
    program: (name) => (name === GitCommand ? GitPath : null),
    output: (value, json) => renderOutput(value, json, (text) => lines.push(text)),
    ...overrides,
  });
  assert.equal(await main([...args]), expectedExit);
  return lines.join("\n");
}

async function skillParts(path: string) {
  const match = SkillDocument.Header.exec(await Bun.file(path).text());
  assert.ok(match);
  return {
    header: SkillHeaderSchema.parse(Bun.YAML.parse(match[1] ?? "")),
    body: match[2] ?? "",
  };
}

export async function guideSteps(names: readonly string[], phrase: string): Promise<boolean> {
  const text = await printed(["guide"]);
  const places = names.map((name) => text.indexOf(name));
  return (
    text.includes(phrase) &&
    places.every((place, index) => place >= 0 && (index === 0 || place > (places[index - 1] ?? 0)))
  );
}

export async function guideSequential(phrase: string): Promise<boolean> {
  return (await printed(["guide"])).includes(phrase);
}

export async function guideRules(sentence: string): Promise<boolean> {
  return (await printed(["guide"])).split(EOL).includes(sentence);
}

export async function guideSchema(
  schemaArgs: readonly string[],
  names: readonly string[],
): Promise<boolean> {
  const text = await printed(["guide"]);
  const schema = await printed(schemaArgs);
  const held = await all(
    names.map(
      (name) => async () =>
        text.includes(
          (await Bun.file(resolve(examples, `${name}${GuideExamples.Extension}`)).text()).trimEnd(),
        ),
    ),
  );
  return SkillDocument.Schema.exec(text)?.[1] === schema && held.every(Boolean);
}

export function installProject(harness: Harness, part: InstallPart): Promise<string> {
  return withTemporaryDirectory(async (project) => {
    await printed(["install", "--no-model", "--harness", harness, "--project", project]);
    const folder = resolve(project, HarnessPlugin.Folder);
    if (harness === Harness.Claude)
      assert.equal(
        await Bun.file(resolve(folder, HarnessPlugin.PluginSkill, CliRuntime.SkillFile)).text(),
        await Bun.file(skillPath(project, harness)).text(),
      );
    if (part === InstallPart.Skill) {
      const { header, body } = await skillParts(skillPath(project, harness));
      return `${header.name} ${body === (await renderGuide())}`;
    }
    if (part === InstallPart.Manifest)
      return PluginManifestSchema.parse(
        JSON.parse(await Bun.file(resolve(folder, HarnessPlugin.Manifest)).text()),
      ).name;
    const mcp = PluginMcpSchema.parse(
      JSON.parse(await Bun.file(resolve(folder, HarnessPlugin.McpFile)).text()),
    ).mcpServers[HarnessPlugin.Server];
    return `${mcp.command} ${mcp.args.join(" ")}`;
  });
}

export function installCodex(
  part: InstallPart,
  exitStatus: number,
  found: boolean,
): Promise<string | boolean> {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, FakeCodexInstall.Project);
    const codexHome = resolve(root, FakeCodexInstall.Home);
    const program = fakeCodex;
    await mkdir(project);
    await mkdir(codexHome);
    const environment = {
      ...process.env,
      [HarnessPlugin.CodexHome]: codexHome,
      [FakeCodexInstall.ExitVariable]: String(exitStatus),
    };
    const out = await printed(
      ["install", "--no-model", "--harness", Harness.Codex, "--project", project],
      {
        program: (name) =>
          name === GitCommand ? GitPath : found && name === Harness.Codex ? program : null,
        environment,
        launch: (command, env) => launch([process.execPath, fakeCodex, ...command.slice(1)], env),
      },
      found && exitStatus !== ExitCode.Success ? ExitCode.Unsuccessful : ExitCode.Success,
    );
    if (part === InstallPart.Skill)
      return (
        (await Bun.file(skillPath(project, Harness.Codex)).text()) ===
        installedSkill(await renderGuide())
      );
    if (part === InstallPart.Status) return InstallResultSchema.parse(JSON.parse(out)).mcp;
    if (part === InstallPart.Calls)
      return (await Bun.file(resolve(codexHome, InstallPart.Calls)).text()).trim();
    const listing = Bun.spawn([process.execPath, fakeCodex, InstallPart.Mcp, InstallPart.List], {
      env: environment,
      stdout: "pipe",
    });
    return (await new Response(listing.stdout).text()).trim();
  });
}

export function installForeign(
  target:
    | InstallPart.Skill
    | InstallPart.PluginSkill
    | InstallPart.Manifest
    | InstallPart.Mcp
    | null,
  harness: Harness,
): Promise<boolean> {
  return withTemporaryDirectory(async (project) => {
    const paths = {
      [InstallPart.Skill]: skillPath(project, harness),
      [InstallPart.PluginSkill]: resolve(
        project,
        HarnessPlugin.Folder,
        HarnessPlugin.PluginSkill,
        CliRuntime.SkillFile,
      ),
      [InstallPart.Manifest]: resolve(project, HarnessPlugin.Folder, HarnessPlugin.Manifest),
      [InstallPart.Mcp]: resolve(project, HarnessPlugin.Folder, HarnessPlugin.McpFile),
    };
    const planted =
      target === null
        ? resolve(project, ".agents/skills/other", CliRuntime.SkillFile)
        : paths[target];
    const before = Buffer.from("A person's existing file\n");
    await mkdir(dirname(planted), { recursive: true });
    await writeFile(planted, before);
    try {
      await printed(["install", "--no-model", "--harness", harness, "--project", project]);
    } finally {
      assert.deepEqual(Buffer.from(await Bun.file(planted).arrayBuffer()), before);
    }
    return true;
  });
}

export function installAntigravity(
  part: InstallPart,
  exitStatus: number,
  found: boolean,
): Promise<string> {
  return withTemporaryDirectory(async (project) => {
    const calls: string[][] = [];
    const out = await printed(
      ["install", "--no-model", "--harness", Harness.Antigravity, "--project", project],
      {
        program: (name) =>
          name === GitCommand
            ? GitPath
            : found && name === HarnessPlugin.AntigravityProgram
              ? name
              : null,
        launch: async (command) => {
          calls.push([...command]);
          return exitStatus;
        },
      },
      found && exitStatus !== ExitCode.Success ? ExitCode.Unsuccessful : ExitCode.Success,
    );
    if (part === InstallPart.Status) return InstallResultSchema.parse(JSON.parse(out)).mcp;
    if (part === InstallPart.Skill) {
      const { header, body } = await skillParts(skillPath(project, Harness.Antigravity));
      return `${header.name} ${body === (await renderGuide())}`;
    }
    const call = calls[0] ?? [];
    return `${call.slice(0, 3).join(" ")} ${call[3] === resolve(project, HarnessPlugin.Folder)} ${calls.length}`;
  });
}

export function installForce(harness: Harness, force: boolean): Promise<string> {
  return withTemporaryDirectory(async (project) => {
    const planted = skillPath(project, harness);
    await mkdir(dirname(planted), { recursive: true });
    await writeFile(planted, Buffer.from("A person's existing file\n"));
    await printed([
      "install",
      "--no-model",
      "--harness",
      harness,
      "--project",
      project,
      ...(force ? [`--${CliOption.Force}`] : []),
    ]);
    return (await Bun.file(planted).text()) === installedSkill(await renderGuide())
      ? SkillDocument.Name
      : "";
  });
}

export function skillHeader(harness: Harness, tool: string): Promise<boolean> {
  return withTemporaryDirectory(async (project) => {
    await printed(["install", "--no-model", "--harness", harness, "--project", project]);
    const { header, body } = await skillParts(skillPath(project, harness));
    return header.name === SkillDocument.Name && body.includes(tool);
  });
}

export function launchExit(code: number, selected = false, held = false): Promise<number> {
  if (held)
    return withTemporaryDirectory((root) =>
      launch(
        [process.execPath, "-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"],
        process.env,
        selected ? root : undefined,
        100,
      ),
    );
  if (!selected) return launch([process.execPath, "-e", `process.exit(${code})`], process.env);
  return withTemporaryDirectory((root) =>
    launch(
      [
        process.execPath,
        "-e",
        `process.exit(process.cwd() === ${JSON.stringify(root)} ? ${code} : 99)`,
      ],
      process.env,
      root,
    ),
  );
}

export function installExecutable(harness: Harness, pinned: boolean): Promise<boolean> {
  return withTemporaryDirectory(async (project) => {
    const calls: string[][] = [];
    await printed(["install", "--no-model", "--harness", harness, "--project", project], {
      executable: pinned ? defaultServices.executable : undefined,
      program: (name) => (name === GitCommand ? GitPath : name === harness ? name : null),
      launch: async (command) => {
        calls.push([...command]);
        return ExitCode.Success;
      },
    });
    const expected = [
      ...(pinned ? (defaultServices.executable ?? []) : [HarnessPlugin.Command]),
      ...HarnessPlugin.Arguments,
      "--home",
      homePath(),
    ];
    if (harness === Harness.Codex) {
      assert.deepEqual(calls, [[Harness.Codex, ...HarnessPlugin.CodexAdd, ...expected]]);
    } else {
      const mcp = PluginMcpSchema.parse(
        JSON.parse(
          await Bun.file(resolve(project, HarnessPlugin.Folder, HarnessPlugin.McpFile)).text(),
        ),
      ).mcpServers[HarnessPlugin.Server];
      assert.deepEqual([mcp.command, ...mcp.args], expected);
      assert.deepEqual(calls, [[Harness.Claude, ...HarnessPlugin.ClaudeAdd, ...expected]]);
    }
    if (!pinned) return false;
    const child = Bun.spawn([...expected, "--help"], {
      env: { ...process.env, PATH: "" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(child.stdout).text();
    const error = await new Response(child.stderr).text();
    assert.equal(await child.exited, ExitCode.Success, error);
    assert.ok(output.includes(HarnessPlugin.Arguments[0]));
    return true;
  });
}

export function installClaudeConnection(
  exitStatus: number,
  found: boolean,
  pinned: boolean,
): Promise<string> {
  return withTemporaryDirectory(async (project) => {
    const calls: string[][] = [];
    const home = resolve(project, "engine home");
    const result = await printed(
      ["install", "--no-model", "--harness", Harness.Claude, "--project", project, "--home", home],
      {
        executable: pinned ? defaultServices.executable : undefined,
        program: (name) =>
          name === GitCommand ? GitPath : found && name === Harness.Claude ? name : null,
        launch: async (command, environment, cwd) => {
          assert.equal(cwd, project);
          assert.equal(environment, defaultServices.environment);
          calls.push([...command]);
          return exitStatus;
        },
      },
      found && exitStatus !== ExitCode.Success ? ExitCode.Unsuccessful : ExitCode.Success,
    );
    assert.deepEqual(
      calls,
      found
        ? [
            [
              Harness.Claude,
              ...HarnessPlugin.ClaudeAdd,
              ...(pinned ? (defaultServices.executable ?? []) : [HarnessPlugin.Command]),
              ...HarnessPlugin.Arguments,
              "--home",
              home,
            ],
          ]
        : [],
    );
    const native = await Bun.file(skillPath(project, Harness.Claude)).text();
    assert.equal(native, installedSkill(await renderGuide()));
    assert.equal(
      await Bun.file(
        resolve(project, HarnessPlugin.Folder, HarnessPlugin.PluginSkill, CliRuntime.SkillFile),
      ).text(),
      native,
    );
    return InstallResultSchema.parse(JSON.parse(result)).mcp;
  });
}

export function installReleaseLauncher(harness: Harness, mode: string) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    await mkdir(project);
    const installation = resolve(root, "installation");
    const first = resolve(installation, "releases/titan-cli-first");
    const second = resolve(installation, "releases/titan-cli-second");
    const firstEntry = resolve(first, Packaging.InstalledPath, Packaging.Bundle);
    const secondEntry = resolve(second, Packaging.InstalledPath, Packaging.Bundle);
    for (const [release, entry, text] of [
      [first, firstEntry, "first release"],
      [second, secondEntry, "second release"],
    ]) {
      assert.ok(release && entry && text);
      await mkdir(dirname(entry), { recursive: true });
      await writeFile(entry, `console.log(${JSON.stringify(text)});\n`);
      const binary = resolve(release, Packaging.CliPath);
      await mkdir(dirname(binary), { recursive: true });
      await symlink(entry, binary);
    }
    const launcher = resolve(installation, HarnessPlugin.Command);
    if (mode === "managed")
      await symlink("releases/titan-cli-first/node_modules/.bin/titan", launcher);
    if (mode === "file") await writeFile(launcher, 'console.log("unrelated launcher");\n');
    if (mode === "loop") await symlink(HarnessPlugin.Command, launcher);
    if (mode === "outside") {
      const outside = resolve(root, "outside.js");
      await writeFile(outside, 'console.log("outside launcher");\n');
      await symlink(outside, launcher);
    }
    const calls: string[][] = [];
    await printed(["install", "--no-model", "--harness", harness, "--project", project], {
      executable: [process.execPath, firstEntry],
      program: (name) => (name === GitCommand ? GitPath : name === harness ? name : null),
      launch: async (command) => {
        calls.push([...command]);
        return ExitCode.Success;
      },
    });
    const selected = mode === "managed" ? launcher : firstEntry;
    const expected = [process.execPath, selected, "mcp", "--home", homePath()];
    assert.deepEqual(calls, [
      [
        harness,
        ...(harness === Harness.Codex ? HarnessPlugin.CodexAdd : HarnessPlugin.ClaudeAdd),
        ...expected,
      ],
    ]);
    if (harness === Harness.Claude) {
      const plugin = PluginMcpSchema.parse(
        JSON.parse(
          await Bun.file(resolve(project, HarnessPlugin.Folder, HarnessPlugin.McpFile)).text(),
        ),
      ).mcpServers[HarnessPlugin.Server];
      assert.deepEqual([plugin.command, ...plugin.args], expected);
    }
    if (mode === "managed") {
      await rm(launcher);
      await symlink("releases/titan-cli-second/node_modules/.bin/titan", launcher);
    }
    const child = Bun.spawn([process.execPath, selected], {
      env: { ...process.env, PATH: "" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(child.stdout).text();
    const error = await new Response(child.stderr).text();
    assert.equal(await child.exited, ExitCode.Success, error);
    assert.equal(output.trim(), mode === "managed" ? "second release" : "first release");
    assert.equal(await Bun.file(firstEntry).text(), 'console.log("first release");\n');
    return true;
  });
}
