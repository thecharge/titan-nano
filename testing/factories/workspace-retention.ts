import { strict as assert } from "node:assert";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  AgentTool,
  ApprovalLevel,
  Backend,
  BoardFile,
  ErrorCode,
  ExecutionPhase,
  ImproverScenario,
  IoLimit,
  NativeTool,
  NativeToolOutcome,
  NativeToolRole,
  RequestDecision,
  RequestKind,
  RequestProjection,
  RunStatus,
  Verdict,
} from "@titan/constants";
import { CliDiagnostic } from "@titan/messages";
import { Engine } from "@titan/runner";
import { scopedScripts, startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  CompactRunSchema,
  type NativeToolScope,
  RequestProjectionSchema,
  RunPageSchema,
  SavedCommandCaptureSchema,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { knownHomes, rememberHome } from "../../apps/cli/src/known-homes.ts";
import { discoverWorkspaceSkills } from "../../packages/knowledge/src/skills.ts";
import { assembleRun } from "../../packages/runner/src/artifacts.ts";
import { readNativeFile, verifyNativeReads } from "../../packages/runner/src/native-files.ts";
import { nativeBridgeConnection } from "./native-tool-bridge.ts";
import { seedNativeSkill } from "./sdk-process.ts";

export function retainedSkillExecution(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    await mkdir(project);
    const skill = await seedNativeSkill(project);
    if (mode === "loop") {
      const loop = resolve(project, ".agents/skills/loop");
      await symlink(loop, loop);
      await assert.rejects(() => discoverWorkspaceSkills(project, { HOME: root }), {
        code: "ELOOP",
      });
      return true;
    }
    const workflow = validateWorkflow(vendorRecoveryWorkflow()).workflow;
    for (const persona of Object.values(workflow.personas)) {
      assert.ok("role" in persona);
      persona.skills = ["linked"];
    }
    let reads = 0;
    const backend: FakeBackend = new FakeBackend(async (spec) => {
      assert.ok(spec.role.includes("Use the synthetic reference."));
      const scope = {
        run_id: spec.run_id,
        step_id: "deliver",
        part_id: null,
        candidate_id: ExecutionPhase.Worker,
        attempt: 1,
        execution_id: spec.execution_id,
        role: spec.writable ? NativeToolRole.Worker : NativeToolRole.Checker,
      };
      const path = "@titan-skills/linked/references/alias.md";
      const result = await engine.readNativeFile(scope, path);
      assert.equal(Buffer.from(result.content ?? "", "base64").toString(), "Synthetic reference.");
      await engine.recordNativeTool(scope, {
        tool: NativeTool.ReadFile,
        outcome: NativeToolOutcome.Returned,
        entry_ids: [],
        observation: result.observation,
      });
      reads++;
      await assert.rejects(() =>
        engine.readNativeFile(scope, "@titan-skills/linked/references/escape.md"),
      );
      return {
        json: spec.writable
          ? { ok: true, marker: "candidate", turn: 1 }
          : { verdict: Verdict.Survived, evidence: "Retained skill checked" },
      };
    });
    const engine: Engine = new Engine(() => backend);
    const run = await engine.create({
      project,
      config: await resolveConfig({ home: resolve(root, "home"), project }),
      plan: validateWorkflow(workflow),
      backend: Backend.Fake,
      client_id: "retained-skill",
      submission_id: mode,
    });
    const retained = structuredClone(run.workspace_skills);
    if (mode === "cache") {
      await mkdir(resolve(project, ".cache"));
      await writeFile(resolve(project, ".cache/generated.txt"), "Generated reference");
      run.omit_generated_workspace = true;
      const source = resolve(root, "isolated");
      await mkdir(source);
      const result = await readNativeFile(run, source, ".cache/generated.txt", true);
      assert.equal(Buffer.from(result.content ?? "", "base64").toString(), "Generated reference");
      const step = run.plan.nodes[0];
      assert.ok(step);
      await verifyNativeReads(run, step, [result.observation], false, source);
      await writeFile(resolve(project, ".cache/generated.txt"), "Changed reference");
      await assert.rejects(
        () => verifyNativeReads(run, step, [result.observation], false, source),
        { code: ErrorCode.FileConflict },
      );
      return true;
    }
    if (mode === "changed" || mode === "reference") {
      await writeFile(
        mode === "changed" ? skill.instructions : skill.reference,
        "Changed live skill.",
      );
    }
    if (mode === "tampered") {
      const file = run.workspace_skills?.files.find((file) => file.path === "SKILL.md");
      assert.ok(file);
      file.content = "Changed retained instructions.";
    }
    if (mode === "hash") {
      const file = run.workspace_skills?.files.find((file) => file.path === "references/alias.md");
      assert.ok(file);
      file.content = "Changed retained reference.";
    }
    await engine.start(run.run_id);
    assert.equal(
      run.state,
      mode === "tampered" || mode === "hash" ? RunStatus.Blocked : RunStatus.Passed,
      JSON.stringify(run.nodes),
    );
    if (run.state === RunStatus.Passed) {
      assert.equal(reads, 2);
      assert.deepEqual(run.workspace_skills, retained);
      const restored = await new Engine(() => backend).load(run.root);
      assert.deepEqual(restored.workspace_skills, retained);
    } else assert.equal(reads, 0);
    return true;
  });
}

export function workspaceRunInspection(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const previousHome = process.env.TITAN_HOME;
    process.env.TITAN_HOME = resolve(root, "registry");
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    await mkdir(project);
    const server = await startServer(
      home,
      () =>
        new FakeBackend(async (spec) => ({
          json: spec.writable
            ? { ok: true, marker: "candidate", turn: 1 }
            : { verdict: Verdict.Survived, evidence: "Checked run" },
        })),
    );
    try {
      const run = await createRunClient(home).submit({
        project,
        workflow: vendorRecoveryWorkflow(),
        backend: Backend.Fake,
        client_id: "workspace-inspection",
        submission_id: mode,
      });
      const output: unknown[] = [];
      const client = createRunClient(home);
      const oversized = mode === "oversized" || mode === "pagination";
      const main = createCli({
        ...defaultServices,
        cwd: () => project,
        updateNotice: async () => null,
        output: (value) => output.push(value),
        wait: async () => {
          await Bun.sleep(1);
        },
        ...(oversized
          ? {
              knownHomes: async () => [home, `${home}-next`],
              existingRunClient: () => ({
                ...client,
                list: async () => ({
                  ...(await client.list({})),
                  padding: "x".repeat(
                    mode === "oversized" ? IoLimit.ResponseBytes / 2 : IoLimit.ResponseBytes / 3,
                  ),
                }),
              }),
            }
          : {}),
        ...(mode === "unavailable"
          ? { knownHomes: async () => [null, resolve(root, "missing")] }
          : {}),
      });
      assert.equal(
        await main(["status", run.run_id, "--compact", "--watch", "--json", "--home", home]),
        0,
      );
      const compact = CompactRunSchema.parse(output.pop());
      if (mode === "projection") {
        const file = resolve(project, BoardFile.Runs, run.run_id, RequestProjection.File);
        const original = await readFile(file, "utf8");
        const projection = RequestProjectionSchema.parse(JSON.parse(original));
        projection.through = Number.MAX_SAFE_INTEGER;
        await writeFile(file, JSON.stringify(projection));
        try {
          await assert.rejects(() => createRunClient(home).get(run.run_id, true), {
            code: ErrorCode.ServerBusy,
          });
        } finally {
          await writeFile(file, original);
        }
      }
      assert.equal(compact.state, RunStatus.Passed);
      if (mode === "waiting") {
        const request = await createRequestClient(home).open(run.run_id, {
          request_id: "inspect-pending-decision",
          kind: RequestKind.DeletePersona,
          scope: {
            operation: RequestKind.DeletePersona,
            resource: "worker@1",
            content_hashes: {},
            arguments: [],
            environment_names: [],
          },
          origin: { client_id: "workspace-inspection", harness_session_id: null },
          expires_at: Date.now() + 60000,
        });
        const pending = CompactRunSchema.parse(await client.get(run.run_id, true));
        assert.deepEqual(pending.waiting_requests, [request.request_id]);
      }
      await rememberHome(home);
      assert.ok((await knownHomes()).includes(home));
      assert.equal(
        await main([
          "runs",
          "--scope",
          mode === "project" ? "project" : "known-home",
          "--state",
          "passed",
          "--project",
          project,
          "--home",
          home,
          "--json",
        ]),
        0,
      );
      const listing = output.pop();
      assert.ok(listing && typeof listing === "object");
      if (mode === "project")
        assert.deepEqual(
          RunPageSchema.parse(listing).runs.map((entry) => entry.run_id),
          [run.run_id],
        );
      if (mode === "oversized")
        assert.ok(JSON.stringify(listing).includes(CliDiagnostic.HomePageTooLarge));
      if (mode === "pagination") {
        assert.equal(Reflect.get(listing, "has_more"), true);
        assert.equal(Reflect.get(listing, "next_home"), home);
      }
      if (mode === "unavailable") assert.match(JSON.stringify(listing), /missing|Invalid/);
      if (mode === "conflict")
        await assert.rejects(
          main([
            "runs",
            "--scope",
            "project",
            "--project",
            project,
            "--project-path",
            home,
            "--home",
            home,
          ]),
        );
      return true;
    } finally {
      await server.stop();
      if (previousHome === undefined) delete process.env.TITAN_HOME;
      else process.env.TITAN_HOME = previousHome;
    }
  });
}

export function retainedScriptExecution(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    await mkdir(project);
    let calls = 0;
    const engine: Engine = new Engine(
      () => new FakeBackend(),
      {},
      {
        scripts: scopedScripts(() => engine, 1, 1, {
          spawn(command, cwd) {
            calls++;
            const script = command.at(-1);
            assert.ok(script);
            const exited =
              script === "checker"
                ? Promise.resolve(0)
                : writeFile(resolve(cwd, "result.txt"), script).then(() => 0);
            return {
              pid: 1,
              stdout: new Blob(["checked"]).stream(),
              stderr: new Blob([]).stream(),
              exited,
              signalCode: null,
              kill() {},
            };
          },
          stop() {},
        }),
      },
    );
    const run = await engine.create({
      project,
      config: await resolveConfig({ home: resolve(root, "home"), project }),
      plan: validateWorkflow({
        name: "Retain script outputs",
        goal: "Verify the script candidate chain",
        personas: {},
        steps: [
          {
            id: "deliver",
            files: ["result.txt"],
            do: { script: "worker" },
            checks: mode === "check" ? ["check"] : [],
            verify: [{ kind: "script", run: "proof", deterministic: true, timeout_s: 1 }],
            falsify: [{ script: "checker" }],
          },
        ],
      }),
      backend: Backend.Fake,
      client_id: "script-retention",
      submission_id: mode,
    });
    await engine.start(run.run_id);
    let changed = false;
    for (let turn = 0; turn < 8 && run.state === RunStatus.Waiting; turn++) {
      const receipt = Object.values(run.nodes.deliver?.phases ?? {})
        .flatMap((phase) => {
          const saved = SavedCommandCaptureSchema.safeParse(phase.answer);
          return saved.success && saved.data.candidate ? [saved.data.candidate] : [];
        })
        .at(-1);
      if (!changed && receipt && (mode === "tampered" || mode === "external")) {
        await writeFile(
          resolve(mode === "tampered" ? resolve(run.root, receipt.path) : project, "result.txt"),
          "External replacement",
        );
        changed = true;
      }
      const request = (await engine.requests.list(run.run_id)).find(
        (request) => request.answer === null,
      );
      assert.ok(request);
      await engine.requests.answer(
        {
          run_id: run.run_id,
          request_id: request.request_id,
          version: request.version,
          decision: RequestDecision.Approve,
          reason: "Synthetic fixture approval",
        },
        { client_id: "fixture-owner", authority: ApprovalLevel.Human },
      );
      await engine.resume(run.run_id);
    }
    assert.equal(
      run.state,
      mode === "tampered" || mode === "external" ? RunStatus.Blocked : RunStatus.Passed,
      JSON.stringify(run.nodes),
    );
    assert.equal(run.nodes.deliver?.refutations, 0);
    if (run.state === RunStatus.Passed) {
      assert.ok(calls >= 4);
      const assembled = await assembleRun(run, new Set(["deliver"]));
      assert.equal(await Bun.file(assembled["result.txt"]?.source ?? "").text(), "proof");
    } else assert.ok(changed);
    return true;
  });
}

export function retainedImproverExecution(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    await mkdir(project);
    await seedNativeSkill(project);
    const workflow = vendorRecoveryWorkflow();
    const plan = validateWorkflow({
      ...workflow,
      personas: {
        ...workflow.personas,
        improver: {
          description: "Review the workflow",
          role: "Improve",
          tools: [AgentTool.Read],
          skills: ["linked"],
        },
      },
      improve: { persona: "improver", rounds: 1 },
    });
    let active: NativeToolScope | undefined;
    let reads = 0;
    let closed = 0;
    const engine: Engine = new Engine(
      () =>
        new FakeBackend(async (spec) => {
          if (spec.persona_id !== "improver")
            return {
              json: spec.writable
                ? { ok: true, marker: "candidate", turn: 1 }
                : { verdict: Verdict.Survived, evidence: "Checked" },
            };
          assert.ok(active);
          assert.ok(spec.role.includes("Use the synthetic reference."));
          const scope = mode === "stale" ? { ...active, execution_id: "expired" } : active;
          const path =
            mode === "outside" ? "source.txt" : "@titan-skills/linked/references/alias.md";
          if (mode === "stale" || mode === "outside") {
            await assert.rejects(() => engine.readNativeFile(scope, path), {
              code: ErrorCode.PermissionDenied,
            });
          } else {
            const result = await engine.readNativeFile(scope, path);
            assert.equal(
              Buffer.from(result.content ?? "", "base64").toString(),
              "Synthetic reference.",
            );
            await engine.recordNativeTool(scope, {
              tool: NativeTool.ReadFile,
              outcome: NativeToolOutcome.Returned,
              entry_ids: [],
              observation: result.observation,
            });
            reads++;
          }
          return {
            json: {
              workflow: ImproverScenario.Replacement,
              changes: [{ change: ImproverScenario.Change, reason: ImproverScenario.Reason }],
            },
          };
        }),
      {},
      {
        nativeTools: {
          open(scope, current, directory) {
            if (scope.role === NativeToolRole.Improver) active = scope;
            return {
              binding: {
                connection: { ...nativeBridgeConnection(scope.role, directory), scope },
                launch: { command: process.execPath, args: [] },
              },
              scanner: () => ({ accept() {} }),
              guard: async () => {
                assert.ok(current());
              },
              close: async () => {
                if (scope.role === NativeToolRole.Improver) closed++;
              },
            };
          },
        },
      },
    );
    const run = await engine.create({
      project,
      config: await resolveConfig({ home: resolve(root, "home"), project }),
      plan,
      backend: Backend.Fake,
      client_id: "improver-retention",
      submission_id: mode,
    });
    await engine.start(run.run_id);
    assert.equal(run.state, RunStatus.Passed);
    assert.equal(closed, 1);
    assert.equal(reads, mode === "stale" || mode === "outside" ? 0 : 1);
    assert.ok(active);
    const expired = active;
    await assert.rejects(() => engine.readNativeFile(expired, "@titan-skills/linked/SKILL.md"), {
      code: ErrorCode.PermissionDenied,
    });
    return true;
  });
}
