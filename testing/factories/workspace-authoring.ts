import { strict as assert } from "node:assert";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ErrorCode, ExitCode, HookFile, Packaging, PersonaState } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { loadKnowledge, projectHubHome, registerPersonas } from "@titan/knowledge";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  CliOutputErrorSchema,
  CliOutputSchema,
  PersonaRecordSchema,
  WorkflowSchema,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { readTree, readWorkspaceSnapshot } from "@titan/workspace";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices, renderCommandOutput } from "../../apps/cli/src/bootstrap.ts";
import { failureEnvelope } from "../../apps/cli/src/output.ts";

const cli = resolve(import.meta.dir, HookFile.RepositoryRoot, Packaging.CliSource);

async function captureCli(
  _cli: string,
  args: string[],
  cwd = process.cwd(),
  environment: Record<string, string | undefined> = process.env,
) {
  const output: string[] = [];
  const main = createCli({
    ...defaultServices,
    cwd: () => cwd,
    environment,
    updateNotice: async () => null,
    output: (value, json, context) =>
      renderCommandOutput(value, json, context, (line) => output.push(String(line))),
  });
  let code: number;
  try {
    code = await main(args);
  } catch (error) {
    if (!(error instanceof TitanError)) throw error;
    output.push(JSON.stringify(failureEnvelope(error, args.slice(0, 2).join(" "))));
    code = error.exitCode;
  }
  return { output: Buffer.from(output.join("\n")), error: Buffer.alloc(0), code };
}

async function runCliCommand(
  cliPath: string,
  home: string,
  args: string[],
  expected: number = ExitCode.Success,
) {
  const result = await captureCli(cliPath, [...args, "--home", home, "--json"]);
  assert.equal(result.code, expected, result.output.toString());
  const envelope = CliOutputSchema.parse(JSON.parse(result.output.toString()));
  return envelope.data ?? envelope.error;
}

export function workflowCreation(template: string, scope: string) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(project);
    const projectReviewer = {
      description: "Project review",
      role: "Review the project requirements.",
    };
    const homeReviewer = { description: "Home review", role: "Review the general requirements." };
    for (const [catalog, reviewer] of [
      [home, homeReviewer],
      [projectHubHome(project), projectReviewer],
    ] as const) {
      await registerPersonas(
        catalog,
        WorkflowSchema.parse({
          name: "Sample workflow",
          goal: "Review a fixture.",
          personas: { reviewer },
          steps: [{ id: "review", do: { persona: "reviewer", task: "Review the fixture." } }],
        }),
      );
    }
    const listing = await runCliCommand(cli, home, [
      "persona",
      "list",
      "--project",
      project,
      "--scope",
      scope === "missing" ? "project" : scope,
    ]);
    const reference = scope === "home" ? "reviewer@1" : "project:reviewer@1";
    assert.deepEqual(listing, {
      scope: scope === "missing" ? "project" : scope,
      versions: [
        {
          name: "reviewer",
          version: 1,
          state: PersonaState.Proposed,
          reference: "reviewer@1",
          use: reference,
        },
      ],
    });
    const path = resolve(project, "workflow.yaml");
    const refusal = template === "unknown" || scope === "missing";
    const result = await runCliCommand(
      cli,
      home,
      [
        "workflow",
        "create",
        path,
        "--project",
        project,
        "--template",
        template,
        "--reviewer",
        scope === "missing" ? "project:reviewer@2" : reference,
        "--verify",
        "true",
      ],
      refusal ? ExitCode.Input : ExitCode.Success,
    );
    if (refusal) {
      assert.equal(
        CliOutputErrorSchema.parse(result).code,
        scope === "missing" ? ErrorCode.UnknownPersona : ErrorCode.Arguments,
      );
      assert.equal(await Bun.file(path).exists(), false);
      return true;
    }
    const plan = validateWorkflow(Bun.YAML.parse(await Bun.file(path).text()));
    assert.deepEqual(plan.workflow.personas.reviewer, { use: reference });
    const verification = plan.nodes.at(-1);
    assert.deepEqual(verification?.do, { script: "true" });
    assert.deepEqual(
      verification?.needs,
      template === "parallel" ? ["prepare", "risks"] : ["prepare"],
    );
    await runCliCommand(cli, home, ["check", path, "--project", project]);
    return true;
  });
}

export function personaCreation(tool: string, existing: boolean) {
  return withTemporaryDirectory(async (root) => {
    const path = resolve(root, "reviewer.json");
    if (existing) await writeFile(path, "existing");
    const refusal = existing || tool === "unknown";
    const result = await runCliCommand(
      cli,
      resolve(root, "home"),
      ["persona", "create", path, "--tool", tool, "--skill", "review"],
      refusal ? ExitCode.Input : ExitCode.Success,
    );
    if (refusal) {
      assert.equal(
        CliOutputErrorSchema.parse(result).code,
        existing ? ErrorCode.Exists : ErrorCode.Arguments,
      );
      if (existing) assert.equal(await readFile(path, "utf8"), "existing");
      else assert.equal(await Bun.file(path).exists(), false);
    } else {
      const entry = await loadKnowledge(path);
      assert.equal(entry.kind, "persona");
      assert.equal(entry.title, "reviewer@1");
      const { persona: definition } = PersonaRecordSchema.parse(Bun.YAML.parse(entry.body));
      const home = resolve(root, "home");
      await runCliCommand(cli, home, ["kb", "add", path, "--project", root]);
      const listing = await runCliCommand(cli, home, [
        "persona",
        "list",
        "--project",
        root,
        "--scope",
        "project",
      ]);
      assert.deepEqual(listing, {
        scope: "project",
        versions: [
          {
            name: "reviewer",
            version: 1,
            state: PersonaState.Proposed,
            reference: "reviewer@1",
            use: "project:reviewer@1",
          },
        ],
      });
      assert.deepEqual(definition.tools, [tool]);
      assert.deepEqual(definition.skills, ["review"]);
    }
    return true;
  });
}

export function workspaceSkillInspection(harness: string, mode: string) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    const configured = resolve(root, "configured");
    const user = resolve(configured, "skills", "review");
    const canonical = resolve(project, ".agents/skills", "review");
    const alias = resolve(project, harness, "skills");
    await mkdir(user, { recursive: true });
    await mkdir(canonical, { recursive: true });
    await mkdir(alias, { recursive: true });
    await writeFile(resolve(user, "SKILL.md"), "---\ndescription: User review\n---\n");
    await writeFile(resolve(canonical, "SKILL.md"), "---\ndescription: Project review\n---\n");
    await symlink(mode === "escape" ? user : canonical, resolve(alias, "linked"));
    const result = await captureCli(
      cli,
      ["skill", "list", "--project", project, "--json"],
      project,
      { ...process.env, HOME: home, CODEX_HOME: configured, CLAUDE_CONFIG_DIR: configured },
    );
    assert.equal(result.code, ExitCode.Success, result.error.toString());
    const { data } = CliOutputSchema.parse(JSON.parse(result.output.toString()));
    assert.ok(Array.isArray(data));
    const review = data.find((entry) => entry.name === "review");
    assert.equal(review?.description, "Project review");
    assert.equal(review?.origin, canonical);
    assert.ok(review?.alternatives.includes(user));
    const linked = data.find((entry) => entry.name === "linked");
    assert.equal(linked?.description, mode === "escape" ? undefined : "Project review");
    const shown = await captureCli(
      cli,
      ["skill", "show", "linked", "--project", project, "--json"],
      project,
      { ...process.env, HOME: home, CODEX_HOME: configured, CLAUDE_CONFIG_DIR: configured },
    );
    if (mode === "escape") assert.notEqual(shown.code, ExitCode.Success);
    else {
      assert.equal(shown.code, ExitCode.Success, shown.error.toString());
      assert.match(shown.output.toString(), /Project review/);
    }
    return true;
  });
}

export function workspaceSnapshotSelection(generated: string, selected: boolean) {
  return withTemporaryDirectory(async (root) => {
    const operation = `${generated}/operations/result.txt`;
    const cache = `${generated}/unrelated.txt`;
    for (const path of [operation, cache, "src/index.ts", "public/logo.txt"]) {
      const file = resolve(root, path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, "Synthetic fixture.");
    }
    const snapshot = await readWorkspaceSnapshot(
      root,
      undefined,
      undefined,
      [],
      selected ? [`${generated}/operations`] : [],
    );
    assert.deepEqual(Object.keys(snapshot), [
      ...(selected ? [operation] : []),
      "public/logo.txt",
      "src/index.ts",
    ]);
    assert.deepEqual(Object.keys(await readTree(root, undefined, undefined, [], [cache])), [cache]);
    return true;
  });
}
