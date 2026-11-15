import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { createSecretScanner, resolveConfig } from "@titan/config";
import {
  AgentTool,
  ApprovalLevel,
  Backend,
  ExecutionPhase,
  NativeTool,
  NativeToolOutcome,
  RequestDecision,
  RequestKind,
  RunAction,
  RunEventKind,
  RunStatus,
  Verdict,
} from "@titan/constants";
import { KnowledgeHub, personaEntryId } from "@titan/knowledge";
import { Engine } from "@titan/runner";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type NativeToolConnection,
  type NativeToolExecutionOwner,
  PersonaRecordSchema,
  RunSchema,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { nativeBridgeConnection } from "./native-tool-bridge.ts";
import { openServer } from "./server-run-hub.ts";

export async function helperTurns(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const base = vendorRecoveryWorkflow("check");
    let workers = 0;
    let helpers = 0;
    const backend = () =>
      new FakeBackend(async (spec, prompt) => {
        assert.equal(spec.cwd, root);
        if (spec.persona_id === "consultant")
          return { json: { ok: true, marker: "consultant reply", turn: 1 } };
        if (spec.persona_id === "investigator") {
          helpers++;
          assert.equal(JSON.parse(prompt).task, `Question ${mode === "repeat" ? helpers : 1}`);
          assert.equal(JSON.parse(prompt).steps, undefined);
          assert.equal(JSON.parse(prompt).prior_refutations, undefined);
          if (mode === "cycle" || (mode === "nested" && helpers === 1))
            return {
              json: {
                result: null,
                requests: [
                  {
                    kind: RequestKind.Ask,
                    scope: {
                      operation: RequestKind.Ask,
                      resource: mode === "cycle" ? "investigator" : "consultant",
                      content_hashes: {},
                      arguments: ["Question 1"],
                      environment_names: [],
                    },
                    expires_at: Date.now() + 60000,
                  },
                ],
              },
            };
          if (mode === "nested") {
            assert.ok(prompt.includes("consultant reply"));
            return {
              json: { result: { ok: true, marker: "helper reply", turn: helpers }, requests: [] },
            };
          }
          return { json: { ok: true, marker: "helper reply", turn: helpers } };
        }
        if (spec.persona_id === "checker")
          return { json: { verdict: Verdict.Survived, evidence: "Checked candidate" } };
        workers++;
        if (workers > 1) assert.ok(prompt.includes("helper reply"));
        if (workers > (mode === "repeat" ? 2 : 1))
          return { json: { result: { ok: true, marker: "candidate", turn: 1 }, requests: [] } };
        return {
          json: {
            result: null,
            requests: [
              {
                kind: RequestKind.Ask,
                scope: {
                  operation: RequestKind.Ask,
                  resource:
                    mode === "unknown"
                      ? "missing-helper"
                      : mode === "version"
                        ? "investigator@1"
                        : "investigator",
                  content_hashes: {},
                  arguments: [`Question ${workers}`],
                  environment_names: [],
                },
                expires_at: Date.now() + 60000,
              },
            ],
          },
        };
      });
    const home = resolve(root, "home");
    const server = await openServer(home, backend);
    try {
      const client = createRunClient(home);
      const run = await client.submit({
        project: root,
        workflow: {
          ...base,
          personas: {
            ...base.personas,
            worker: { ...base.personas.worker, request_turns: true },
            investigator: {
              ...base.personas.worker,
              role: "Answer the addressed question",
              ...(["nested", "cycle"].includes(mode) ? { request_turns: true } : {}),
            },
            consultant: { ...base.personas.worker, role: "Answer a nested question" },
          },
        },
        backend: Backend.Fake,
        client_id: "helper-owner",
        submission_id: "helper-dispatch",
        overrides: {
          limits: { max_parallel: 1 },
          ...(mode === "cycle" ? { requests: { max_per_run: 3 } } : {}),
          ...(mode === "raised" ? { approvals: { ask: ApprovalLevel.Human } } : {}),
        },
      });
      assert.ok(
        await waitUntil(async () =>
          [RunStatus.Waiting, RunStatus.Passed, RunStatus.Blocked].includes(
            (await client.get(run.run_id)).state,
          ),
        ),
      );
      const saved = RunSchema.parse(await client.get(run.run_id));
      const requests = (await createRequestClient(home).list({ run_id: run.run_id })).requests;
      const originalSession = Object.values(saved.nodes)[0]?.phases[ExecutionPhase.Worker]
        ?.session_id;
      for (const phase of Object.values(Object.values(saved.nodes)[0]?.phases ?? {}))
        if (phase.helper) assert.notEqual(phase.session_id, originalSession);
      assert.equal(
        requests.filter((entry) => entry.request.answer === null).length,
        saved.state === RunStatus.Passed ? 0 : mode === "cycle" ? 3 : 1,
      );
      if (saved.state === RunStatus.Waiting) {
        await client.control(run.run_id, RunAction.Cancel);
        assert.ok(
          await waitUntil(async () => (await client.get(run.run_id)).state === RunStatus.Cancelled),
        );
      }
      await server.stop();
      const hub = await KnowledgeHub.open(home);
      try {
        const record = PersonaRecordSchema.parse(
          Bun.YAML.parse((await hub.get(personaEntryId("investigator@1"))).entry.body),
        );
        assert.equal(
          record.asked,
          mode === "unknown" ? 0 : mode === "cycle" ? 3 : mode === "repeat" ? 2 : 1,
        );
        assert.equal(record.asked_history_complete, true);
        if (helpers) assert.equal(record.usage?.executions, helpers);
      } finally {
        await hub.close();
      }
      return `${saved.state} ${helpers} ${workers}`;
    } finally {
      await server.stop();
    }
  });
}

export async function helperRecovery(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const config = await resolveConfig({
      home,
      project: root,
      overrides: { recovery: { max_retries: 0 } },
    });
    const base = vendorRecoveryWorkflow("check");
    const plan = validateWorkflow({
      ...base,
      personas: {
        ...base.personas,
        worker: {
          ...base.personas.worker,
          request_turns: true,
          ...(mode === "native-read" ? { tools: [] } : {}),
        },
        investigator: {
          ...base.personas.worker,
          role: "Answer the addressed question",
          ...(mode === "native-denied" ? { tools: [] } : { tools: [AgentTool.Read] }),
        },
      },
    });
    let helpers = 0;
    let workers = 0;
    let interrupted = false;
    let engine: Engine;
    let connection: NativeToolConnection | undefined;
    let active = false;
    const nativeTools: NativeToolExecutionOwner = {
      open(scope, current, directory) {
        assert.equal(active, false);
        assert.equal(current(), true);
        active = true;
        connection = { ...nativeBridgeConnection(scope.role, directory), scope };
        return {
          binding: { connection, launch: { command: process.execPath, args: [] } },
          scanner: () => createSecretScanner({}),
          guard: async () => {},
          close: async () => {
            active = false;
          },
        };
      },
    };
    let runId = "";
    const backend = () =>
      new FakeBackend(async (spec, prompt, signal) => {
        if (spec.persona_id === "checker")
          return { json: { verdict: Verdict.Survived, evidence: "checked" } };
        if (spec.persona_id === "investigator") {
          helpers++;
          if (mode === "cancel") {
            await new Promise<void>((done) =>
              signal.addEventListener("abort", () => done(), { once: true }),
            );
            signal.throwIfAborted();
          }
          if (mode.startsWith("native-")) {
            assert.ok(connection);
            assert.equal(connection.scope.execution_id, spec.execution_id);
            await engine.recordNativeTool(connection.scope, {
              tool: NativeTool.Ready,
              outcome: NativeToolOutcome.Returned,
              entry_ids: [],
            });
            await engine.readNativeFile(connection.scope, "absent.txt");
          }
          if (mode === "competing") {
            const request = (await engine.requests.list(runId)).find(
              (entry) => entry.kind === RequestKind.Ask,
            );
            assert.ok(request);
            await engine.requests.answer(
              {
                run_id: runId,
                request_id: request.request_id,
                version: request.version,
                decision: RequestDecision.Approve,
                reason: "external answer",
              },
              { client_id: "external-owner", authority: ApprovalLevel.Main },
            );
          }
          if (mode === "backend") throw new Error("helper transport failed");
          return { json: { ok: true, marker: "retained helper reply", turn: 1 } };
        }
        workers++;
        if (workers > 1) {
          assert.ok(
            prompt.includes(mode === "competing" ? "external answer" : "retained helper reply"),
          );
          return { json: { result: { ok: true, marker: "candidate", turn: 1 }, requests: [] } };
        }
        return {
          json: {
            result: null,
            requests: [
              {
                kind: RequestKind.Ask,
                scope: {
                  operation: RequestKind.Ask,
                  resource: "investigator",
                  content_hashes: {},
                  arguments: ["Question"],
                  environment_names: [],
                },
                expires_at: Date.now() + 60000,
              },
            ],
          },
        };
      });
    engine = new Engine(
      backend,
      {},
      {
        ...(mode.startsWith("native-") ? { nativeTools } : {}),
        projectRun: async (run, kind) => {
          if (
            interrupted ||
            mode === "competing" ||
            mode === "backend" ||
            mode.startsWith("native-")
          )
            return;
          const helper = Object.values(Object.values(run.nodes)[0]?.phases ?? {}).find(
            (phase) => phase.helper,
          );
          if (
            (mode === "receipt" &&
              kind === RunEventKind.PhaseReceived &&
              helper?.helper?.received) ||
            (mode === "completed" && kind === RunEventKind.PhaseCompleted && helper?.completed) ||
            (mode === "delivered" && kind === RunEventKind.RequestAnswered)
          ) {
            interrupted = true;
            throw new Error("interrupted helper delivery");
          }
        },
      },
    );
    const run = await engine.create({
      project: root,
      plan,
      config,
      backend: Backend.Fake,
      client_id: "helper-owner",
      submission_id: "helper-recovery",
    });
    runId = run.run_id;
    const running = engine.start(runId);
    if (mode === "cancel") {
      assert(await waitUntil(async () => helpers === 1));
      await engine.cancel(runId);
    }
    await running.catch((error) => {
      if (!interrupted) throw error;
    });
    if (interrupted) {
      engine = new Engine(backend);
      await engine.load(run.root);
      await engine.resume(runId);
    }
    const saved = engine.get(runId);
    assert.equal(helpers, 1);
    assert.equal(interrupted, ["receipt", "completed", "delivered"].includes(mode));
    return `${saved.state} ${helpers} ${workers}`;
  });
}
