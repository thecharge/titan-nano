import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { createSecretScanner, resolveConfig } from "@titan/config";
import {
  AgentEventKind,
  Backend,
  BoardFile,
  ErrorCode,
  FileErrorCode,
  IoLimit,
  NativeEventFixture,
  NativePhaseFixture,
  NativeToolEnvironment,
  PathPart,
  RunEventKind,
  RunFile,
  RunStatus,
  StepStatus,
  Verdict,
} from "@titan/constants";
import { all } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { Engine } from "@titan/runner";
import { jsonBytes, readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type {
  AgentBackend,
  AgentSpec,
  EventSink,
  NativeToolBinding,
  NativeToolCurrent,
  NativeToolExecutionOwner,
  NativeToolScope,
  Run,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { nativeEventData } from "./native-events.ts";
import { nativeBridgeConnection } from "./native-tool-bridge.ts";

class PhaseGuardOwner implements NativeToolExecutionOwner {
  active = 0;
  opened = 0;
  closed = 0;
  scans = 0;
  token = "";
  current: NativeToolCurrent = () => false;
  run!: Run;
  lateSink?: EventSink;
  constructor(private mode: NativePhaseFixture) {}
  open(scope: NativeToolScope, current: NativeToolCurrent, directory: string) {
    assert.equal(this.active, 0);
    assert.equal(current(), true);
    assert.equal(scope.run_id, this.run.run_id);
    assert.equal(directory, this.run.root);
    const state = this.run.nodes[scope.step_id];
    assert.ok(state);
    assert.equal(state.attempt, scope.attempt);
    assert.equal(state.state, StepStatus.Running);
    const connection = nativeBridgeConnection(scope.role, directory);
    connection.scope = scope;
    connection.token = randomBytes(32).toString("hex");
    this.token = connection.token;
    this.current = current;
    this.active++;
    this.opened++;
    const guard = async (value: unknown) =>
      createSecretScanner({ [NativeToolEnvironment.Token]: connection.token }).accept(
        await jsonBytes(value, IoLimit.DataBytes),
      );
    const binding: NativeToolBinding = {
      connection,
      launch: { command: process.execPath, args: [] },
    };
    return {
      binding,
      guard,
      scanner: () => {
        const scanner = createSecretScanner({ [NativeToolEnvironment.Token]: connection.token });
        return {
          accept: (bytes: Uint8Array) => {
            assert.equal(this.active, 1);
            assert.equal(current(), true);
            this.scans++;
            scanner.accept(bytes);
          },
        };
      },
      close: async () => {
        assert.equal(this.active, 1);
        this.active--;
        this.closed++;
        await this.lateSink?.({
          type: AgentEventKind.Message,
          session_id: null,
          data: connection.token,
        });
        const journal = await readFileBytes(
          resolve(this.run.root, BoardFile.Journal),
          IoLimit.DataBytes,
        );
        assert.equal(journal.includes(Buffer.from(connection.token)), false);
        if (this.mode === NativePhaseFixture.OwnerClose) throw new Error(connection.token);
      },
    };
  }
}

async function observeBinding(
  owner: PhaseGuardOwner,
  engine: Engine,
  spec: AgentSpec,
  binding?: NativeToolBinding,
) {
  assert.ok(binding);
  assert.equal(binding.connection.token, owner.token);
  assert.equal(binding.connection.scope.execution_id, spec.execution_id);
  assert.equal(owner.current(), true);
  const events = await engine.events(spec.run_id);
  assert.equal(
    events.events.some(
      (event) =>
        event.type === RunEventKind.ExecutionStarted &&
        JSON.stringify(event.data).includes(spec.execution_id),
    ),
    true,
  );
}

export async function nativePhaseGuard(mode: NativePhaseFixture, resume: boolean) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    await all([() => mkdir(project), () => mkdir(home)]);
    const owner = new PhaseGuardOwner(mode);
    assert.equal(owner.current(), false);
    let workers = 0;
    const fake = new FakeBackend(async (spec, _prompt, _signal, sink) => {
      if (!spec.writable)
        return { json: { verdict: Verdict.Survived, evidence: "Checked guarded candidate" } };
      workers++;
      if (resume && workers === 1)
        throw new OperationalError(ErrorCode.ExecutionInterrupted, "Interrupted guarded worker");
      const token = owner.token;
      if (mode === NativePhaseFixture.LateEvent) owner.lateSink = sink;
      if (mode === NativePhaseFixture.Event)
        await sink({ type: AgentEventKind.Message, session_id: null, data: token });
      if (mode === NativePhaseFixture.CodexResult || mode === NativePhaseFixture.ClaudeResult)
        await sink({
          type: AgentEventKind.ToolResult,
          session_id: null,
          data: nativeEventData(
            mode === NativePhaseFixture.CodexResult
              ? NativeEventFixture.Codex
              : NativeEventFixture.ClaudeStructured,
            token,
          ),
        });
      if (mode === NativePhaseFixture.Error) throw new Error(token);
      const path = mode === NativePhaseFixture.Filename ? token : "delivered.txt";
      const content =
        mode === NativePhaseFixture.Content
          ? Buffer.from(token)
          : mode === NativePhaseFixture.Boundary
            ? Buffer.concat([Buffer.alloc(IoLimit.ChunkBytes - 16, 97), Buffer.from(token)])
            : Buffer.from("Checked ordinary content");
      await writeFile(resolve(spec.cwd, path), content);
      return {
        json: {
          ok: true,
          marker: mode === NativePhaseFixture.Answer ? token : "candidate",
          turn: 1,
        },
        ...(mode === NativePhaseFixture.Session ? { session_id: token } : {}),
      };
    });
    let engine: Engine;
    const backend: AgentBackend = {
      id: fake.id,
      specificationVersion: fake.specificationVersion,
      capabilities: fake.capabilities,
      async validateTurn(spec, _prompt, _id, binding) {
        if (binding) await observeBinding(owner, engine, spec, binding);
      },
      async start(spec, binding) {
        await observeBinding(owner, engine, spec, binding);
        if (mode === NativePhaseFixture.Start) throw new Error(owner.token);
        const session = await fake.start(spec);
        return {
          ...session,
          close: async () => {
            await session.close();
            if (mode === NativePhaseFixture.Close) throw new Error(owner.token);
          },
        };
      },
      async resume(id, spec, binding) {
        await observeBinding(owner, engine, spec, binding);
        if (mode === NativePhaseFixture.Resume) throw new Error(owner.token);
        return fake.resume(id, spec);
      },
    };
    engine = new Engine(() => backend, {}, { nativeTools: owner });
    const run = await engine.create({
      project,
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      config: await resolveConfig({ home, project }),
      backend: Backend.Fake,
      client_id: "native-guard",
      submission_id: "guard",
    });
    owner.run = run;
    await engine.start(run.run_id);
    if (resume) {
      assert.equal(run.state, RunStatus.Blocked);
      assert.equal(owner.active, 0);
      await engine.resume(run.run_id);
    }
    const safe = mode === NativePhaseFixture.Clean || mode === NativePhaseFixture.LateEvent;
    assert.equal(run.state, safe ? RunStatus.Passed : RunStatus.Blocked);
    assert.equal(owner.active, 0);
    assert.equal(owner.opened, owner.closed);
    assert.equal(owner.current(), false);
    const state = Object.values(run.nodes)[0];
    assert.ok(state);
    assert.equal(state.attempt, 1);
    assert.equal(state.refutations, 0);
    assert.equal(state.evidence.length, 0);
    if (
      [
        NativePhaseFixture.Content,
        NativePhaseFixture.Filename,
        NativePhaseFixture.Boundary,
      ].includes(mode)
    ) {
      assert.ok(state.work);
      const candidate = resolve(state.work, PathPart.Parent, RunFile.Candidate);
      await assert.rejects(() => access(candidate), {
        code: FileErrorCode.Missing,
      });
    }
    if (safe) assert.ok(owner.scans > 0);
    else assert.equal(run.artifacts, null);
    const journal = await readFileBytes(resolve(run.root, BoardFile.Journal), IoLimit.DataBytes);
    assert.equal(journal.includes(Buffer.from(owner.token)), false);
    return true;
  });
}
