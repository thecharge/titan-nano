import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RunStore } from "@titan/board";
import { resolveConfig, settingOverrides } from "@titan/config";
import {
  ApprovalLevel,
  ApprovalPolicyFixture,
  Backend,
  ConfigFile,
  ErrorCode,
  RequestDecision,
  RequestDefaults,
  RequestKind,
  RunEventKind,
} from "@titan/constants";
import { hash } from "@titan/core";
import { fixedApprovalLevel, limitedApprovalLevel, workflowApprovalLevel } from "@titan/messages";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { ConfigSchema, EffectiveConfigSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { createFakeBackend } from "../support/backend.ts";

async function checkedPolicy(home: string, project: string, workflow: Record<string, unknown>) {
  const file = resolve(project, "workflow.yaml");
  await writeFile(file, Buffer.from(JSON.stringify({ ...vendorRecoveryWorkflow(), ...workflow })));
  const output: unknown[] = [];
  const main = createCli({ ...defaultServices, output: (value) => output.push(value) });
  assert.equal(await main(["check", file, "--home", home, "--project", project, "--json"]), 0);
  return EffectiveConfigSchema.parse(Reflect.get(Object(output[0]), "config"));
}

export async function approvalPolicy(mode: ApprovalPolicyFixture, cli = false) {
  return withTemporaryDirectory(async (home) => {
    const project = resolve(home, "project");
    await mkdir(resolve(project, ConfigFile.HomeDirectory), { recursive: true });
    const owner: Record<string, unknown> = {};
    const workflow: Record<string, unknown> = {};
    const selected: Record<string, unknown> = {};
    let kind: RequestKind = RequestKind.Tool;
    let level: ApprovalLevel = ApprovalLevel.Human;
    let expected: ApprovalLevel = ApprovalLevel.Human;
    if (mode === ApprovalPolicyFixture.WorkflowServerLower) {
      kind = RequestKind.ToolServer;
      level = ApprovalLevel.Auto;
    }
    if (mode === ApprovalPolicyFixture.OwnerLower) {
      kind = RequestKind.LockStatement;
      level = ApprovalLevel.Main;
      expected = level;
    }
    if (mode === ApprovalPolicyFixture.WorkflowInherited) {
      owner[RequestKind.Tool] = ApprovalLevel.Auto;
      level = ApprovalLevel.Main;
      expected = level;
    }
    if ([ApprovalPolicyFixture.WorkflowLower, ApprovalPolicyFixture.CliLower].includes(mode))
      level = ApprovalLevel.Auto;
    if ([ApprovalPolicyFixture.ProjectLower, ApprovalPolicyFixture.ExplicitLower].includes(mode)) {
      owner[RequestKind.Tool] = ApprovalLevel.Human;
      level = ApprovalLevel.Main;
    }
    if (mode === ApprovalPolicyFixture.FixedAction) {
      kind = RequestKind.Action;
      level = ApprovalLevel.Main;
    }
    if (mode === ApprovalPolicyFixture.FixedPaid) {
      kind = RequestKind.PaidCompute;
      level = ApprovalLevel.Auto;
    }
    if (mode === ApprovalPolicyFixture.FixedDelete) {
      kind = RequestKind.DeletePersona;
      level = ApprovalLevel.Main;
    }
    if (mode === ApprovalPolicyFixture.FixedLimit) {
      kind = RequestKind.RaiseLimit;
      level = ApprovalLevel.Auto;
    }
    if (mode === ApprovalPolicyFixture.Unknown) Reflect.set(owner, "unknown", level);
    else if (mode === ApprovalPolicyFixture.Invalid) Reflect.set(owner, kind, "unknown");
    else if (
      [
        ApprovalPolicyFixture.WorkflowRaise,
        ApprovalPolicyFixture.WorkflowInherited,
        ApprovalPolicyFixture.WorkflowLower,
        ApprovalPolicyFixture.WorkflowServerLower,
      ].includes(mode)
    )
      workflow.approvals = { [kind]: level };
    else if (
      [
        ApprovalPolicyFixture.ProjectRaise,
        ApprovalPolicyFixture.ProjectLower,
        ApprovalPolicyFixture.ExplicitLower,
      ].includes(mode)
    )
      selected.approvals = { [kind]: level };
    else if (
      ![
        ApprovalPolicyFixture.Defaults,
        ApprovalPolicyFixture.CliRaise,
        ApprovalPolicyFixture.CliLower,
      ].includes(mode)
    )
      owner[kind] = level;
    await writeFile(
      resolve(home, ConfigFile.User),
      Buffer.from(JSON.stringify({ approvals: owner })),
    );
    const explicit = mode === ApprovalPolicyFixture.ExplicitLower;
    const file = resolve(project, explicit ? "selected.yaml" : ConfigFile.Project);
    await writeFile(file, Buffer.from(JSON.stringify(selected)));
    try {
      const config = cli
        ? await checkedPolicy(home, project, workflow)
        : await resolveConfig({
            home,
            project,
            workflow,
            ...(explicit ? { configFile: file } : {}),
            ...([ApprovalPolicyFixture.CliRaise, ApprovalPolicyFixture.CliLower].includes(mode)
              ? { overrides: settingOverrides([`approvals.${kind}=${level}`]) }
              : {}),
          });
      assert.equal(config.hash, hash(JSON.stringify(config.value)));
      assert.deepEqual(ConfigSchema.parse(config.value), config.value);
      assert.equal(
        Object.keys(config.value.approvals ?? {}).length,
        Object.keys(RequestDefaults).length,
      );
      if (mode === ApprovalPolicyFixture.Defaults)
        assert.deepEqual(config.value.approvals, RequestDefaults);
      else assert.equal(config.value.approvals?.[kind], expected);
      assert.ok(config.sources[`approvals.${kind}`]?.length);
      return true;
    } catch (error) {
      if (
        [ApprovalPolicyFixture.WorkflowLower, ApprovalPolicyFixture.WorkflowServerLower].includes(
          mode,
        )
      )
        assert.equal(Reflect.get(Object(error), "message"), workflowApprovalLevel(kind));
      if (
        [
          ApprovalPolicyFixture.ProjectLower,
          ApprovalPolicyFixture.ExplicitLower,
          ApprovalPolicyFixture.CliLower,
        ].includes(mode)
      )
        assert.equal(Reflect.get(Object(error), "message"), limitedApprovalLevel(kind));
      if (
        [
          ApprovalPolicyFixture.FixedAction,
          ApprovalPolicyFixture.FixedPaid,
          ApprovalPolicyFixture.FixedDelete,
          ApprovalPolicyFixture.FixedLimit,
        ].includes(mode)
      )
        assert.ok(String(Reflect.get(Object(error), "message")).includes(fixedApprovalLevel(kind)));
      throw error;
    }
  });
}

export async function approvalPolicyReplay(mode: ApprovalPolicyFixture) {
  return withTemporaryDirectory(async (project) => {
    const home = resolve(project, "home");
    await mkdir(home);
    const level =
      mode === ApprovalPolicyFixture.RaisedReplay
        ? ApprovalLevel.Human
        : mode === ApprovalPolicyFixture.LoweredReplay
          ? ApprovalLevel.Auto
          : ApprovalLevel.Main;
    await writeFile(
      resolve(home, ConfigFile.User),
      Buffer.from(JSON.stringify({ approvals: { tool: level } })),
    );
    const config = await resolveConfig({ home, project });
    if (mode === ApprovalPolicyFixture.Legacy) {
      delete config.value.approvals;
      config.hash = hash(JSON.stringify(config.value));
    }
    const engine = new Engine(createFakeBackend);
    const run = await engine.create({
      project,
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      config,
      backend: Backend.Fake,
      client_id: "policy-owner",
      submission_id: "policy-run",
    });
    const request = await engine.requests.open(run.run_id, {
      request_id: "permission",
      kind: RequestKind.Tool,
      scope: {
        operation: "read",
        resource: "candidate",
        content_hashes: {},
        arguments: [],
        environment_names: [],
      },
      origin: { client_id: "codex", harness_session_id: "session" },
      expires_at: Date.now() + 60000,
    });
    assert.equal(request.level, level);
    if ([ApprovalPolicyFixture.ChangedPolicy, ApprovalPolicyFixture.ForgedLevel].includes(mode)) {
      const store = new RunStore(run.root);
      await store.read();
      const changed = await store.snapshot();
      if (mode === ApprovalPolicyFixture.ChangedPolicy) {
        assert.ok(changed.config.value.approvals);
        changed.config.value.approvals.resource = ApprovalLevel.Human;
        changed.config.hash = hash(JSON.stringify(changed.config.value));
        await store.commit(changed, RunEventKind.Paused, {});
      } else
        await store.commit(changed, RunEventKind.RequestOpened, {
          ...request,
          request_id: "forged",
          level: ApprovalLevel.Human,
        });
      const reloaded = new Engine(createFakeBackend);
      await reloaded.load(run.root);
      await reloaded.requests.list(run.run_id);
      return true;
    }
    const input = {
      run_id: run.run_id,
      request_id: request.request_id,
      version: request.version,
      decision: RequestDecision.Approve,
      reason: "Reviewed exact policy",
    };
    if (level === ApprovalLevel.Human) {
      const failure = await thrownBy(() =>
        engine.requests.answer(input, { client_id: "main", authority: ApprovalLevel.Main }),
      );
      assert.equal(Reflect.get(Object(failure), "code"), ErrorCode.PermissionDenied);
      assert.equal((await engine.requests.list(run.run_id))[0]?.answer, null);
    }
    const answered = await engine.requests.answer(input, {
      client_id: "reviewer",
      authority: level === ApprovalLevel.Human ? ApprovalLevel.Human : ApprovalLevel.Main,
    });
    await writeFile(
      resolve(home, ConfigFile.User),
      Buffer.from(JSON.stringify({ approvals: { tool: ApprovalLevel.Human } })),
    );
    const reloaded = new Engine(createFakeBackend);
    const restored = await reloaded.load(run.root);
    assert.equal(restored.config.hash, config.hash);
    assert.deepEqual(await reloaded.requests.list(run.run_id), [answered]);
    if (mode === ApprovalPolicyFixture.Legacy)
      assert.equal(Object.hasOwn(restored.config.value, "approvals"), false);
    return true;
  });
}
