import { strict as assert } from "node:assert";
import { lstat, mkdir, readlink, stat, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { matchesClaudeRegistration } from "@titan/config";
import {
  CliInvocationKind,
  CliRuntime,
  ExitCode,
  type Harness,
  HarnessPlugin,
  HarnessSkillDirectory,
  IoLimit,
  SkillDocument,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { installedSkill } from "@titan/messages";
import { readFileBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { CliOutputSchema, SkillHeaderSchema, WorkflowCheckItemSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { resolveCommand } from "../../apps/cli/src/catalog.ts";
import { renderGuide } from "../../apps/cli/src/guide.ts";
import { parseInvocation } from "../../apps/cli/src/parser.ts";
import { captureCli } from "../support/command.ts";

const PresentTool = "/usr/bin/tool";
const OldBunName = "bun";
const OldBunVersion = "1.3.9";

export async function workflowSkillPreflight(harness: Harness, present: boolean) {
  return withTemporaryDirectory(async (project) => {
    const skill = "editorial-review-fixture";
    const origin = resolve(project, dirname(HarnessSkillDirectory[harness]), skill);
    const canonical = resolve(project, "shared-skill");
    if (present) {
      await mkdir(dirname(origin), { recursive: true });
      await mkdir(resolve(canonical, "references"), { recursive: true });
      await writeFile(resolve(canonical, "SKILL.md"), "Review these private instructions.\n");
      await writeFile(resolve(canonical, "references", "voice.md"), "Review this private guide.\n");
      await symlink(canonical, origin);
    }
    const workflow = resolve(project, "review.yaml");
    const home = resolve(project, "home");
    await writeFile(
      workflow,
      Bun.YAML.stringify({
        name: "Editorial preflight",
        goal: "Check the review configuration offline",
        personas: {
          reviewer: { description: "Reviewer", role: "Review a draft", skills: [skill] },
          checker: { description: "Checker", role: "Check the review" },
        },
        steps: [
          {
            id: "review",
            do: { persona: "reviewer", task: "Review the draft" },
            falsify: [{ persona: "checker", task: "Check the review" }],
          },
        ],
      }),
    );
    const cli = resolve(import.meta.dir, "../../apps/cli/src/main.ts");
    const selectors = [
      workflow,
      "--project",
      project,
      "--home",
      home,
      "--harness",
      harness,
      "--json",
    ];
    const main = createCli({ ...defaultServices, output: () => undefined });
    for (const args of [
      ["check", ...selectors],
      ["run", ...selectors, "--dry-run"],
    ]) {
      if (present) assert.equal(await main(args), ExitCode.Success);
      else {
        await assert.rejects(
          () => main(args),
          (error: unknown) =>
            error instanceof TitanError &&
            error.exitCode === ExitCode.Input &&
            error.message.includes(skill),
        );
      }
      const result = await captureCli(cli, args);
      const output = result.output.toString();
      const envelope = CliOutputSchema.parse(JSON.parse(output));
      assert.equal(
        result.code,
        present ? ExitCode.Success : ExitCode.Input,
        envelope.error?.message ?? result.error.toString(),
      );
      if (present) {
        const checked = WorkflowCheckItemSchema.omit({ path: true }).parse(envelope.data);
        assert.deepEqual(checked.skills?.personas, { reviewer: [skill] });
        assert.equal(checked.skills?.origins[0]?.origin, origin);
        assert.deepEqual(
          checked.skills?.files.map(({ path }) => path),
          ["SKILL.md", "references/voice.md"],
        );
        assert.equal(output.includes("private instructions"), false);
        assert.equal(output.includes("private guide"), false);
      } else assert.ok(envelope.error?.message.includes(skill));
    }
    return true;
  });
}

export function checkSkillDocument(text: string, canonical: string): string {
  const match = SkillDocument.Header.exec(text);
  assert.ok(match);
  SkillHeaderSchema.parse(Bun.YAML.parse(match[1] ?? ""));
  const body = match[2];
  assert.equal(body, canonical);
  const yaml = SkillDocument.Workflow.exec(canonical)?.[1];
  assert.ok(yaml);
  const plan = validateWorkflow(Bun.YAML.parse(yaml));
  assert.equal(plan.nodes.length, 1);
  assert.notEqual(plan.nodes[0]?.do, plan.nodes[0]?.falsify[0]);
  const commands = SkillDocument.Commands.exec(canonical)?.[1];
  assert.ok(commands);
  for (const line of commands.split("\n")) {
    const parsed = parseInvocation(line.split(" ").slice(1));
    assert.equal(parsed.kind, CliInvocationKind.Command);
    assert.ok(resolveCommand(line.split(" ").slice(1)).definition?.handler);
  }
  return yaml;
}

export async function projectSkill(
  harness: Harness,
  existing: boolean,
  linked = false,
  force = false,
) {
  return withTemporaryDirectory(async (project) => {
    const path = resolve(project, HarnessSkillDirectory[harness], CliRuntime.SkillFile);
    const before = Buffer.from(
      linked && !force ? installedSkill(await renderGuide()) : "A person's existing skill\n",
    );
    if (existing) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(linked ? `${path}.target` : path, before);
      if (linked) await symlink(`${path}.target`, path);
    }
    const main = createCli({
      ...defaultServices,
      output: () => undefined,
      program: () => PresentTool,
      launch: async () => 0,
    });
    try {
      const code = await main([
        "install",
        "--no-model",
        ...(force ? ["--force"] : []),
        "--harness",
        harness,
        "--project",
        project,
        "--json",
      ]);
      assert.equal(code, 0);
      checkSkillDocument(
        (await readFileBytes(path, IoLimit.DataBytes)).toString(),
        await renderGuide(),
      );
      const beforeRepeat = await stat(path);
      assert.equal(
        await main(["install", "--no-model", "--harness", harness, "--project", project, "--json"]),
        0,
      );
      assert.equal((await stat(path)).mtimeMs, beforeRepeat.mtimeMs);
      return true;
    } finally {
      if (existing && !force)
        assert.deepEqual(await readFileBytes(path, IoLimit.DataBytes), before);
      if (linked && force) {
        assert.deepEqual(await readFileBytes(`${path}.target`, IoLimit.DataBytes), before);
        assert.equal((await lstat(path)).isFile(), true);
      }
      if (linked && !force) assert.equal(await readlink(path), `${path}.target`);
    }
  });
}

export async function installChecks(
  harness: Harness,
  missing: string[],
  registrationFails = false,
) {
  return withTemporaryDirectory(async (project) => {
    const lines: string[] = [];
    const main = createCli({
      ...defaultServices,
      output: (value) => {
        lines.push(JSON.stringify(value));
      },
      program: (name) => (missing.includes(name) ? null : PresentTool),
      launch: async () => (registrationFails ? 1 : 0),
      runtimeVersion: missing.includes(OldBunName) ? OldBunVersion : defaultServices.runtimeVersion,
    });
    const path = resolve(project, HarnessSkillDirectory[harness], CliRuntime.SkillFile);
    try {
      const code = await main([
        "install",
        "--no-model",
        "--harness",
        harness,
        "--project",
        project,
        "--json",
      ]);
      const text = lines.join("");
      return {
        code,
        written: await Bun.file(path).exists(),
        named: missing.every((name) => text.includes(name)),
      };
    } catch (error) {
      assert.equal(await Bun.file(path).exists(), false);
      assert.ok(missing.every((name) => String(error).includes(name)));
      throw error;
    }
  });
}

export async function claudeRegistration(
  command: string,
  disabled: boolean,
  environmentChanged: boolean,
  nested: boolean,
  malformed = false,
  missing = false,
  depth = 0,
  relativeConfig = false,
): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const selected =
      depth > 0
        ? resolve(project, ...Array.from({ length: depth }, () => "a"))
        : nested
          ? resolve(project, "nested")
          : project;
    await mkdir(resolve(project, ".git"), { recursive: true });
    await mkdir(selected, { recursive: true });
    const configRoot = relativeConfig ? resolve(selected, "native-config") : root;
    await mkdir(configRoot, { recursive: true });
    if (!missing)
      await writeFile(
        resolve(configRoot, HarnessPlugin.ClaudeConfiguration),
        malformed
          ? "{"
          : JSON.stringify({
              projects: {
                [project]: {
                  mcpServers: {
                    titan: {
                      type: "stdio",
                      command,
                      args: ["mcp", "--home", root],
                      ...(environmentChanged ? { env: { OVERRIDE: "changed" } } : {}),
                    },
                  },
                  disabledMcpServers: disabled ? [HarnessPlugin.Server] : [],
                },
              },
            }),
      );
    const environment = {
      [HarnessPlugin.ClaudeConfigHome]: relativeConfig ? "native-config" : root,
    };
    const matching = await matchesClaudeRegistration(
      selected,
      ["titan", "mcp", "--home", root],
      environment,
    );
    const main = createCli({
      ...defaultServices,
      executable: undefined,
      environment,
      program: () => PresentTool,
      launch: async () => 1,
      output: () => undefined,
    });
    const args = [
      "install",
      "--no-model",
      "--harness",
      "claude",
      "--project",
      selected,
      "--home",
      root,
      "--json",
    ];
    assert.equal(await main(args), matching ? 0 : 1);
    assert.equal(await main(args), matching ? 0 : 1);
    return matching;
  });
}
