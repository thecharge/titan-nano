import { strict as assert } from "node:assert";
import { chmod, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { delimiter, resolve } from "node:path";
import {
  ApprovalLevel,
  ArtifactCommand,
  Backend,
  CliCommand,
  CliOption,
  CliRuntime,
  CliSchema,
  ConfigCommand,
  ConfigFile,
  DaemonBuildCase,
  ErrorCode,
  ExitCode,
  FileEncoding,
  Harness,
  HarnessPlugin,
  HarnessSkillDirectory,
  HookFile,
  IoLimit,
  LocalServer,
  Newline,
  PackageProbeEnvironment,
  PackageProbeRuntime,
  Packaging,
  ProbeAssignment,
  ProbeFile,
  ProbeOption,
  ProbeRequest,
  ProcessIo,
  ProcessSignal,
  RequestCommand,
  RequestDecision,
  RequestKind,
  RequestLimit,
  RequestState,
  RequestVersion,
  RunStatus,
  StepStatus,
  TestScheduling,
  TextSymbol,
  VendorStubMode,
} from "@titan/constants";
import { all } from "@titan/core";
import {
  existingSkill,
  packageCommandFailure,
  requestAlreadyAnswered,
  serverExited,
  toolLine,
  VerificationMessage,
} from "@titan/messages";
import { createRequestClient } from "@titan/server/requests";
import { readBytes } from "@titan/streams";
import {
  ArtifactExportManifestSchema,
  ArtifactExportSchema,
  ArtifactInspectionSchema,
  ArtifactPageSchema,
  CliOutputErrorSchema,
  CliOutputSchema,
  EffectiveConfigSchema,
  EventPageSchema,
  InstallResultSchema,
  ObjectSchema,
  OperationRequestSchema,
  PackageManifestSchema,
  PluginMcpSchema,
  RequestPageSchema,
  type Run,
  RunPageSchema,
  RunSchema,
  RunUsageSchema,
  UpdateInspectionSchema,
} from "@titan/types";
import { exists } from "@titan/workspace";
import { resolveCommand } from "../../apps/cli/src/catalog.ts";
import { activeProcessRecoveryCases } from "../../testing/cases/active-process.ts";
import { attemptInputProcessCases } from "../../testing/cases/attempt-input.ts";
import { candidateCommitmentProcessCases } from "../../testing/cases/candidate-commitment.ts";
import { claudeBackoffCases } from "../../testing/cases/claude-backoff.ts";
import { claudeBackoffBranchCases } from "../../testing/cases/claude-backoff-branch.ts";
import { claudeProcessRetryCases } from "../../testing/cases/claude-retry-process.ts";
import { cliEventFollowProcessCases } from "../../testing/cases/cli-event-follow.ts";
import {
  cliEnvelopeProcessCases,
  cliEnvelopeQueryCases,
  cliOutputObservationProcessCases,
} from "../../testing/cases/cli-output.ts";
import {
  configFileBoundaryCases,
  configFileConcurrencyCases,
  configFileEditCases,
} from "../../testing/cases/config-files.ts";
import { scopedConfigShowCases } from "../../testing/cases/config-show.ts";
import { crashResumeCases } from "../../testing/cases/crash-resume.ts";
import { workflowExampleCases, workflowExamplesCheckCases } from "../../testing/cases/examples.ts";
import { finalAttemptRetryCases } from "../../testing/cases/final-native-retry.ts";
import { frozenConfigProcessCases } from "../../testing/cases/frozen-config.ts";
import { graphValidationCases } from "../../testing/cases/graph-validation.ts";
import { helperProcessCases } from "../../testing/cases/helper-process.ts";
import { installedUpdateCases } from "../../testing/cases/installed-update.ts";
import { mcpStdioFramesCases } from "../../testing/cases/mcp-stdio.ts";
import { mcpSubmissionCases } from "../../testing/cases/mcp-submission.ts";
import { nativeProjectWriteCases } from "../../testing/cases/native-project-write.ts";
import {
  nativeReconciliationCases,
  nativeScriptReconciliationCases,
  nativeSplitReconciliationCases,
} from "../../testing/cases/native-reconciliation.ts";
import { nativeSetupProcessCases } from "../../testing/cases/native-setup-process.ts";
import {
  nativeProjectWorkflowCases,
  nativeWorkflowCases,
} from "../../testing/cases/native-workflow.ts";
import {
  cliConfiguredStartupCases,
  cliObserverProcessCases,
} from "../../testing/cases/observation.ts";
import { serverOpenCallProcessCases } from "../../testing/cases/open-call.ts";
import { operationalPeerCases } from "../../testing/cases/operational-peer.ts";
import { personaDecisionProcessCases } from "../../testing/cases/persona-decision.ts";
import { personaDefinitionCases } from "../../testing/cases/persona-definition.ts";
import {
  personaLaterCheckCases,
  personaProductionLifecycleCases,
} from "../../testing/cases/persona-quality.ts";
import { personaShowCases } from "../../testing/cases/persona-register.ts";
import { personaVisibilityCliCases } from "../../testing/cases/persona-search.ts";
import { requestTurnParallelCases } from "../../testing/cases/request-turn-parallel.ts";
import { requestTurnProcessCases } from "../../testing/cases/request-turn-process.ts";
import { runCompatibilityCases } from "../../testing/cases/run-compatibility.ts";
import { runtimePinProcessCases } from "../../testing/cases/runtime-pin.ts";
import { sdkMixedDeliveryCases } from "../../testing/cases/sdk-plan.ts";
import { sdkProcessRecoveryCases } from "../../testing/cases/sdk-process.ts";
import { daemonMaintenanceCases } from "../../testing/cases/server-maintenance.ts";
import {
  scriptedFakeProcessCases,
  scriptedFakeWatchCases,
} from "../../testing/cases/server-process.ts";
import { serverHubCases } from "../../testing/cases/server-run-hub.ts";
import {
  goalProofProcessCases,
  scriptProcessCases,
  scriptProofProcessCases,
} from "../../testing/cases/server-scripts.ts";
import { cliSubmissionReceiptCases } from "../../testing/cases/submission-receipts.ts";
import { activeProcessRecovery } from "../../testing/factories/active-process.ts";
import { attemptInputProcess } from "../../testing/factories/attempt-input-process.ts";
import { candidateCommitmentProcess } from "../../testing/factories/candidate-commitment-process.ts";
import { claudeBackoff, claudeBackoffBranch } from "../../testing/factories/claude-backoff.ts";
import { claudeProcessRetry } from "../../testing/factories/claude-retry-process.ts";
import { scriptedFakeProcess, scriptedFakeWatch } from "../../testing/factories/cli-contract.ts";
import { cliEventFollowProcess } from "../../testing/factories/cli-event-follow-process.ts";
import { cliEnvelopeProcess, cliEnvelopeQuery } from "../../testing/factories/cli-output.ts";
import { cliOutputObservationProcess } from "../../testing/factories/cli-output-observation.ts";
import {
  configConcurrentProcess,
  configFileBoundaryProcess,
  configFileProcess,
} from "../../testing/factories/config-files.ts";
import { scopedConfigShowProcess } from "../../testing/factories/config-show.ts";
import { cliConfiguredStartup } from "../../testing/factories/configured-startup.ts";
import { crashResume } from "../../testing/factories/crash-resume.ts";
import { installedDaemonBuild } from "../../testing/factories/daemon-probe.ts";
import { workflowExamplesCheck } from "../../testing/factories/example-check.ts";
import { automaticWorkflowExample, workflowExample } from "../../testing/factories/examples.ts";
import { finalAttemptRetry } from "../../testing/factories/final-native-retry.ts";
import { frozenConfigProcess } from "../../testing/factories/frozen-config.ts";
import { graphValidation } from "../../testing/factories/graph-validation.ts";
import { helperProcess } from "../../testing/factories/helper-process.ts";
import { installedRegistration } from "../../testing/factories/installed-registration.ts";
import { installedUpdate } from "../../testing/factories/installed-update.ts";
import { mcpStdioFrames } from "../../testing/factories/mcp-stdio.ts";
import { mcpSubmissionProcess } from "../../testing/factories/mcp-submission.ts";
import { nativeProjectWrite } from "../../testing/factories/native-project-write.ts";
import {
  nativeReconciliation,
  nativeScriptReconciliation,
  nativeSplitReconciliation,
} from "../../testing/factories/native-reconciliation.ts";
import { nativeSetupProcess } from "../../testing/factories/native-setup-process.ts";
import { nativeProjectWorkflow, nativeWorkflow } from "../../testing/factories/native-workflow.ts";
import { cliObserverProcess } from "../../testing/factories/observer-process.ts";
import { serverOpenCallProcess } from "../../testing/factories/open-call.ts";
import { operationalPeer } from "../../testing/factories/operational-peer.ts";
import { personaDecisionProcess } from "../../testing/factories/persona-decision.ts";
import { personaDefinition } from "../../testing/factories/persona-definition.ts";
import {
  personaLaterCheck,
  personaLifecycleProcess,
} from "../../testing/factories/persona-quality.ts";
import { personaShow } from "../../testing/factories/persona-register.ts";
import { personaVisibilityCli } from "../../testing/factories/persona-search.ts";
import { requestTurnParallel } from "../../testing/factories/request-turn-parallel.ts";
import { requestTurnProcess } from "../../testing/factories/request-turn-process.ts";
import { runCompatibility } from "../../testing/factories/run-compatibility.ts";
import { runtimePinProcess } from "../../testing/factories/runtime-pin.ts";
import { sdkMixedDelivery } from "../../testing/factories/sdk-plan.ts";
import { sdkProcessRecovery } from "../../testing/factories/sdk-process.ts";
import { daemonMaintenance } from "../../testing/factories/server-maintenance.ts";
import { serverHubProcess } from "../../testing/factories/server-run-hub.ts";
import {
  goalProofProcess,
  scriptProcess,
  scriptProofProcess,
} from "../../testing/factories/server-scripts.ts";
import { checkSkillDocument } from "../../testing/factories/skills.ts";
import { cliSubmissionReceipt } from "../../testing/factories/submission-receipts.ts";
import { probeDashboard } from "./probe-dashboard.ts";
import { probeKnowledge } from "./probe-knowledge.ts";
import { probeRequestMcp } from "./probe-request-mcp.ts";

assert.equal(process.env[PackageProbeEnvironment], PackageProbeRuntime);
assert.ok(
  Object.values(networkInterfaces())
    .flat()
    .every((address) => address?.internal),
);
const cli = resolve(Packaging.CliPath);
for (const mode of Object.values(DaemonBuildCase))
  assert.equal(await installedDaemonBuild(cli, mode), true);
console.log(JSON.stringify({ installed_daemon_build_cases: 3 }));
await all(
  [...installedUpdateCases.positive, ...installedUpdateCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(installedUpdate, undefined, [
        cli,
        resolve(Packaging.UpdateFixtures),
        ...scenario.args,
      ]);
      assert.equal(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_update_cases: 4 }));
const installed = resolve(Packaging.InstalledPath);
const home = resolve(Packaging.ProbeHome);
const project = resolve(Packaging.ProbeProject);
const stubs = resolve(Packaging.ProbeStubs);
await mkdir(stubs, { recursive: true });
process.env[Packaging.ProbeRegistrationVariable] = stubs;
for (const name of Packaging.ProbeStubNames) {
  await writeFile(resolve(stubs, name), Packaging.ProbeStubScript);
  await chmod(resolve(stubs, name), Packaging.ProbeStubMode);
}
process.env.PATH = [process.env.PATH, stubs].filter(Boolean).join(delimiter);
await mkdir(project);
await writeFile(resolve(project, Packaging.ProbeOriginal), Packaging.ProbeContent);
async function command(
  args: string[],
  expected: number = ExitCode.Success,
  environment = process.env,
): Promise<unknown> {
  const definition = resolveCommand(args).definition;
  const selectors = [
    ...(definition?.options.includes(CliOption.Home) ? [ProbeOption.Home, home] : []),
    ...(definition?.options.includes(CliOption.Project) ? [ProbeOption.Project, project] : []),
    CliRuntime.JsonFlag,
  ];
  const child = Bun.spawn([cli, ...args, ...selectors], {
    env: environment,
    stdout: ProcessIo.Pipe,
    stderr: ProcessIo.Pipe,
    timeout: 10_000,
  });
  const [out, err] = await all([
    () => readBytes(child.stdout, IoLimit.ResponseBytes),
    () => readBytes(child.stderr, IoLimit.ResponseBytes),
  ]);
  const code = await child.exited;
  assert.equal(
    code,
    expected,
    packageCommandFailure(args, Buffer.concat([err, out]).toString(FileEncoding.Utf8)),
  );
  const envelope = CliOutputSchema.parse(JSON.parse(out.toString(FileEncoding.Utf8)));
  return envelope.data ?? envelope.error;
}
const packageMetadata = ObjectSchema.parse(
  JSON.parse(await readFile(resolve(installed, HookFile.Manifest), FileEncoding.Utf8)),
);
const manifest = PackageManifestSchema.parse(packageMetadata);
assert.equal(packageMetadata.license, Packaging.LicenseId);
for (const file of Packaging.LegalFiles)
  assert((await readFile(resolve(installed, file))).byteLength > 0);
assert.deepEqual(await command([ProbeOption.Version]), {
  version: manifest.version,
  release: Packaging.Release,
});
const doctor = ObjectSchema.parse(await command([CliCommand.Doctor]));
const tools = ObjectSchema.parse(doctor.tools);
assert.equal(
  tools[Harness.Codex],
  toolLine(Bun.which(Harness.Codex, { PATH: process.env.PATH ?? TextSymbol.Empty }) !== null, true),
);
assert.equal(
  tools[Harness.Claude],
  toolLine(
    Bun.which(Harness.Claude, { PATH: process.env.PATH ?? TextSymbol.Empty }) !== null,
    true,
  ),
);
const beforeUpdateCheck = (await exists(home)) ? await readdir(home) : null;
assert.deepEqual(
  UpdateInspectionSchema.parse(await command([CliCommand.Update, ProbeOption.Check])),
  {
    current_version: manifest.version,
    available_version: null,
    source: null,
    checked: false,
  },
);
assert.deepEqual((await exists(home)) ? await readdir(home) : null, beforeUpdateCheck);
for (const [name, args] of [
  [Packaging.WorkflowSchema, [CliCommand.Schema, CliSchema.Workflow]],
  [Packaging.ConfigSchema, [CliCommand.Schema, CliSchema.Config]],
  [Packaging.ConfigSchema, [CliCommand.Config, ConfigCommand.Schema]],
] as const) {
  assert.deepEqual(
    await command([...args]),
    JSON.parse(await readFile(resolve(installed, Packaging.Assets, name), FileEncoding.Utf8)),
  );
}
const canonicalGuide = await readFile(resolve(installed, ProbeFile.GuideAsset), FileEncoding.Utf8);
assert.equal(await command([CliCommand.Guide]), canonicalGuide);
for (const harness of Object.values(Harness)) {
  await rm(resolve(project, HarnessPlugin.Folder), { recursive: true, force: true });
  const installation = InstallResultSchema.parse(
    await command(
      [CliCommand.Install, ProbeOption.NoModel, ProbeOption.Harness, harness],
      ExitCode.Success,
      { ...process.env, PATH: [stubs, process.env.PATH].filter(Boolean).join(delimiter) },
    ),
  );
  assert.equal(installation.mcp, HarnessPlugin.Server);
  if (harness === Harness.Claude || harness === Harness.Codex) {
    const registered = await readFile(
      resolve(stubs, harness + Packaging.ProbeRegistrationSuffix),
      FileEncoding.Utf8,
    );
    assert.deepEqual(registered.trimEnd().split(Newline), [
      project,
      ...(harness === Harness.Claude ? HarnessPlugin.ClaudeAdd : HarnessPlugin.CodexAdd),
      process.execPath,
      resolve(installed, Packaging.Bundle),
      ...HarnessPlugin.Arguments,
      ProbeOption.Home,
      home,
    ]);
  }
  if (harness !== Harness.Codex) {
    const mcp = PluginMcpSchema.parse(
      JSON.parse(
        await readFile(
          resolve(project, HarnessPlugin.Folder, HarnessPlugin.McpFile),
          FileEncoding.Utf8,
        ),
      ),
    ).mcpServers[HarnessPlugin.Server];
    assert.deepEqual(
      [mcp.command, ...mcp.args],
      [
        process.execPath,
        resolve(installed, Packaging.Bundle),
        ...HarnessPlugin.Arguments,
        ProbeOption.Home,
        home,
      ],
    );
    const launched = Bun.spawn([mcp.command, ...mcp.args, ProbeOption.Help], {
      env: { ...process.env, PATH: TextSymbol.Empty },
      stdout: ProcessIo.Pipe,
      stderr: ProcessIo.Pipe,
      timeout: Packaging.OutputMilliseconds,
    });
    const [out, err] = await all([
      () => readBytes(launched.stdout, IoLimit.ResponseBytes),
      () => readBytes(launched.stderr, IoLimit.ResponseBytes),
    ]);
    assert.equal(await launched.exited, ExitCode.Success, err.toString());
    assert.ok(out.toString().includes(CliCommand.Mcp));
  }
  const text = await readFile(
    resolve(project, HarnessSkillDirectory[harness], CliRuntime.SkillFile),
    FileEncoding.Utf8,
  );
  if (harness === Harness.Claude)
    assert.equal(
      await readFile(
        resolve(project, HarnessPlugin.Folder, HarnessPlugin.PluginSkill, CliRuntime.SkillFile),
        FileEncoding.Utf8,
      ),
      text,
    );
  const yaml = checkSkillDocument(text, canonicalGuide);
  const skillWorkflow = resolve(project, ProbeFile.SkillWorkflow);
  await writeFile(skillWorkflow, Buffer.from(yaml));
  await command([CliCommand.Check, skillWorkflow]);
  const repeated = InstallResultSchema.parse(
    await command(
      [CliCommand.Install, ProbeOption.NoModel, ProbeOption.Harness, harness],
      ExitCode.Success,
      { ...process.env, PATH: [stubs, process.env.PATH].filter(Boolean).join(delimiter) },
    ),
  );
  assert.equal(repeated.mcp, HarnessPlugin.Server);
  const edited = text + TextSymbol.Newline;
  await writeFile(resolve(project, HarnessSkillDirectory[harness], CliRuntime.SkillFile), edited);
  assert.deepEqual(
    await command(
      [CliCommand.Install, ProbeOption.NoModel, ProbeOption.Harness, harness],
      ExitCode.Input,
    ),
    {
      code: ErrorCode.Exists,
      message: existingSkill(
        resolve(project, HarnessSkillDirectory[harness], CliRuntime.SkillFile),
      ),
      paths: [],
      retryable: false,
      recovery: null,
    },
  );
  assert.equal(
    await readFile(
      resolve(project, HarnessSkillDirectory[harness], CliRuntime.SkillFile),
      FileEncoding.Utf8,
    ),
    edited,
  );
  await writeFile(resolve(project, HarnessSkillDirectory[harness], CliRuntime.SkillFile), text);
}
for (const harness of [Harness.Claude, Harness.Codex])
  assert.equal(await installedRegistration(cli, harness), true);
const configuredApproval = EffectiveConfigSchema.parse(
  await command([CliCommand.Config, ProbeOption.Set, ProbeAssignment.Approval]),
);
assert.equal(configuredApproval.value.requests?.max_per_run, RequestLimit.PerRun);
assert.equal(
  configuredApproval.value.server.max_pending_request_operations,
  RequestLimit.PendingOperations,
);
assert.equal(configuredApproval.value.approvals?.tool, ApprovalLevel.Human);
assert.equal(configuredApproval.value.approvals?.action, ApprovalLevel.Human);
const refusedApproval = CliOutputErrorSchema.parse(
  await command(
    [CliCommand.Config, ProbeOption.Set, ProbeAssignment.UnsafeApproval],
    ExitCode.Input,
  ),
);
assert.equal(refusedApproval.code, ErrorCode.Arguments);
const refusedRequestBudget = CliOutputErrorSchema.parse(
  await command(
    [CliCommand.Config, ProbeOption.Set, ProbeAssignment.UnsafeRequestBudget],
    ExitCode.Input,
  ),
);
assert.equal(refusedRequestBudget.code, ErrorCode.Arguments);
const refusedRequestQueue = CliOutputErrorSchema.parse(
  await command(
    [CliCommand.Config, ProbeOption.Set, ProbeAssignment.OwnerRequestQueue],
    ExitCode.Input,
  ),
);
assert.equal(refusedRequestQueue.code, ErrorCode.Arguments);
await mkdir(home, { recursive: true });
await writeFile(
  resolve(home, ConfigFile.User),
  Buffer.from(
    JSON.stringify({ server: { max_pending_request_operations: ProbeRequest.OperationLimit } }),
  ),
);
const configuredRequestQueue = EffectiveConfigSchema.parse(await command([CliCommand.Config]));
assert.equal(
  configuredRequestQueue.value.server.max_pending_request_operations,
  ProbeRequest.OperationLimit,
);

const workflow = resolve(installed, Packaging.ProbeWorkflow);
await command([CliCommand.Check, workflow]);
const server = Bun.spawn([cli, CliCommand.Serve, ProbeOption.Home, home, CliRuntime.JsonFlag], {
  stdout: ProcessIo.Pipe,
  stderr: ProcessIo.Pipe,
});
const serverOutput = readBytes(server.stdout, IoLimit.ResponseBytes);
const serverError = readBytes(server.stderr, IoLimit.ResponseBytes).then((bytes) =>
  bytes.toString(FileEncoding.Utf8),
);
function probeRequestScope() {
  return {
    operation: ProbeRequest.Operation,
    resource: project,
    content_hashes: {},
    arguments: [],
    environment_names: [],
  };
}

async function probeDecision(run: Run, kind: RequestKind, decision: RequestDecision) {
  const decisions = createRequestClient(home);
  let request = await decisions.open(run.run_id, {
    request_id: [kind, decision].join(ProbeRequest.Separator),
    kind,
    scope: probeRequestScope(),
    origin: { client_id: ProbeRequest.Client, harness_session_id: ProbeRequest.Session },
    expires_at: Date.now() + ProbeRequest.LifetimeMilliseconds,
  });
  assert.deepEqual(
    OperationRequestSchema.parse(
      await command([CliCommand.Requests, RequestCommand.Show, run.run_id, request.request_id]),
    ),
    request,
  );
  if (kind === RequestKind.Resource) {
    const pending = request;
    request = OperationRequestSchema.parse(
      await command([
        CliCommand.Answer,
        run.run_id,
        request.request_id,
        ProbeOption.ToPerson,
        ProbeOption.RequestVersion,
        String(request.version),
        ProbeOption.ClientId,
        ProbeRequest.Reviewer,
        ProbeOption.Reason,
        ProbeRequest.Reason,
      ]),
    );
    assert.equal(request.version, RequestVersion.Escalated);
    assert.equal(request.level, ApprovalLevel.Human);
    assert.equal(request.answer, null);
    assert.deepEqual(request.scope, pending.scope);
    assert.deepEqual(request.origin, pending.origin);
    assert.equal(request.escalation?.reason, ProbeRequest.Reason);
  }
  const common = [run.run_id, request.request_id];
  const options = [
    ProbeOption.RequestVersion,
    String(request.version),
    ProbeOption.ClientId,
    ProbeRequest.Reviewer,
  ];
  const reason = ProbeRequest.Reason;
  if (kind !== RequestKind.Tool) {
    const refusal = await command(
      [CliCommand.Answer, ...common, decision, ...options, ProbeOption.Reason, reason],
      ExitCode.Input,
    );
    assert.equal(CliOutputErrorSchema.parse(refusal).code, ErrorCode.PermissionDenied);
    assert.equal((await decisions.get(run.run_id, request.request_id)).answer, null);
  }
  const args =
    kind === RequestKind.Tool
      ? [CliCommand.Answer, ...common, decision, ...options, ProbeOption.Reason, reason]
      : decision === RequestDecision.Approve
        ? [CliCommand.Approve, ...common, ...options, ProbeOption.Reason, reason]
        : [CliCommand.Deny, ...common, reason, ...options];
  const answered = OperationRequestSchema.parse(await command(args));
  assert.equal(
    answered.version,
    kind === RequestKind.Resource ? RequestVersion.EscalatedAnswered : RequestVersion.Answered,
  );
  assert.deepEqual(answered.escalation, request.escalation);
  assert.equal(answered.answer?.decision, decision);
  assert.equal(
    answered.answer?.actor.authority,
    kind !== RequestKind.Tool ? ApprovalLevel.Human : ApprovalLevel.Main,
  );
  assert.equal(answered.answer?.actor.client_id, ProbeRequest.Reviewer);
  const repeated = await command(args, ExitCode.Input);
  assert.equal(CliOutputErrorSchema.parse(repeated).code, ErrorCode.RequestConflict);
  assert.equal(
    CliOutputErrorSchema.parse(repeated).message,
    requestAlreadyAnswered(request.request_id),
  );
  assert.deepEqual(await decisions.get(run.run_id, request.request_id), answered);
}

async function probeInstalledServer() {
  const deadline = Date.now() + 5_000;
  while (!(await exists(resolve(home, LocalServer.File)))) {
    if (server.exitCode !== null) throw new Error(serverExited(await serverError));
    assert.ok(Date.now() < deadline, VerificationMessage.ServerNotReady);
    await Bun.sleep(20);
  }
  await probeKnowledge(cli, home, project, command);
  const run = RunSchema.parse(
    await command([
      CliCommand.Run,
      workflow,
      ProbeOption.HarnessSessionId,
      ProbeRequest.Session,
      ProbeOption.Backend,
      Backend.Fake,
      ProbeOption.FakeScript,
      resolve(installed, Packaging.ProbeAnswers),
      ProbeOption.Watch,
      ProbeOption.Set,
      ProbeAssignment.Parallel,
      ProbeOption.Set,
      ProbeAssignment.Recovery,
      ProbeOption.Set,
      ProbeAssignment.RequestBudget,
    ]),
  );
  assert.equal(run.state, RunStatus.Passed);
  assert.equal(run.config.value.limits.max_parallel, 2);
  assert.equal(run.config.value.recovery.max_retries, 0);
  assert.equal(run.config.value.requests?.max_per_run, ProbeRequest.Maximum);
  assert.equal(Object.keys(run.nodes).length, 4);
  assert.ok(Object.values(run.nodes).every((node) => node.state === StepStatus.Passed));
  const usage = RunUsageSchema.parse(await command([CliCommand.Usage, run.run_id]));
  assert.equal(usage.run_id, run.run_id);
  assert.equal(usage.through, run.version);
  assert.equal(usage.executions, 8);
  assert.equal(usage.reported_executions, 8);
  assert.equal(usage.unreported_executions, 0);
  assert.deepEqual(usage.known, { input_tokens: 0, output_tokens: 0, cost_usd: 0 });
  assert.deepEqual(usage.complete, { input_tokens: false, output_tokens: false, cost_usd: false });
  const decisions = createRequestClient(home);
  await probeRequestMcp(cli, home, run.run_id, project);
  for (const kind of [RequestKind.Tool, RequestKind.Action, RequestKind.Resource]) {
    for (const decision of [RequestDecision.Approve, RequestDecision.Deny])
      await probeDecision(run, kind, decision);
  }
  console.log(
    JSON.stringify({ installed_request_decisions: 6, role_refusals: 4, repeated_refusals: 6 }),
  );
  const listed: string[] = [];
  let requestCursor: string | undefined;
  do {
    const page = RequestPageSchema.parse(
      await command([
        CliCommand.Requests,
        ProbeOption.RunId,
        run.run_id,
        ProbeOption.ClientId,
        ProbeRequest.Client,
        ProbeOption.HarnessSessionId,
        ProbeRequest.Session,
        ProbeOption.Limit,
        String(ProbeRequest.PageCount),
        ...(requestCursor === undefined ? [] : [ProbeOption.Cursor, requestCursor]),
      ]),
    );
    assert.deepEqual(page.unavailable, []);
    for (const item of page.requests) {
      assert.equal(item.request.run_id, run.run_id);
      listed.push(item.request.request_id);
    }
    requestCursor = page.next_cursor ?? undefined;
    assert.ok(listed.length <= ProbeRequest.Maximum);
  } while (requestCursor !== undefined);
  assert.equal(listed.length, ProbeRequest.Maximum);
  assert.equal(new Set(listed).size, ProbeRequest.Maximum);
  const pendingRequests = RequestPageSchema.parse(
    await command([
      CliCommand.Requests,
      ProbeOption.RunId,
      run.run_id,
      ProbeOption.State,
      RequestState.Waiting,
    ]),
  );
  assert.equal(pendingRequests.requests.length, 2);
  console.log(
    JSON.stringify({ installed_cli_request_listing: listed.length, waiting_requests: 2 }),
  );
  const beforeBudgetRefusal = RunSchema.parse(await command([CliCommand.Status, run.run_id]));
  await assert.rejects(
    () =>
      decisions.open(run.run_id, {
        request_id: ProbeRequest.Excess,
        kind: RequestKind.Tool,
        scope: probeRequestScope(),
        origin: { client_id: ProbeRequest.Client, harness_session_id: ProbeRequest.Session },
        expires_at: Date.now() + ProbeRequest.LifetimeMilliseconds,
      }),
    { code: ErrorCode.Capacity },
  );
  assert.equal(
    RunSchema.parse(await command([CliCommand.Status, run.run_id])).version,
    beforeBudgetRefusal.version,
  );
  console.log(
    JSON.stringify({ installed_request_allowance: ProbeRequest.Maximum, excess_refused: true }),
  );
  const artifacts = ArtifactInspectionSchema.parse(
    await command([CliCommand.Artifacts, run.run_id]),
  );
  assert.ok(artifacts.directory);
  assert.deepEqual(
    ArtifactInspectionSchema.parse(
      await command([CliCommand.Artifacts, ArtifactCommand.List, run.run_id]),
    ),
    artifacts,
  );
  const selected = artifacts.files.find((file) => file.path === Packaging.ProbeOriginal);
  assert.ok(selected);
  const page = ArtifactPageSchema.parse(
    await command([CliCommand.Artifacts, ArtifactCommand.Show, run.run_id, selected.id]),
  );
  assert.equal(page.run_id, run.run_id);
  assert.equal(page.has_more, false);
  assert.equal(Buffer.from(page.content, FileEncoding.Base64).toString(), Packaging.ProbeContent);
  const exported = ArtifactExportSchema.parse(
    await command([
      CliCommand.Artifacts,
      ArtifactCommand.Export,
      run.run_id,
      selected.id,
      ProbeOption.Output,
      resolve(home, ProbeFile.Export),
    ]),
  );
  assert.equal(exported.delivery.delivery_hash, artifacts.hash);
  assert.equal(
    await readFile(resolve(exported.directory, exported.delivery.content), FileEncoding.Utf8),
    Packaging.ProbeContent,
  );
  assert.deepEqual(
    ArtifactExportManifestSchema.parse(
      JSON.parse(await readFile(exported.manifest, FileEncoding.Utf8)),
    ),
    exported.delivery,
  );
  const refused = await command(
    [
      CliCommand.Artifacts,
      ArtifactCommand.Export,
      run.run_id,
      selected.id,
      ProbeOption.Output,
      exported.directory,
    ],
    ExitCode.Input,
  );
  assert.equal(CliOutputErrorSchema.parse(refused).code, ErrorCode.Exists);
  assert.ok(await exists(artifacts.result));
  assert.ok(await exists(artifacts.manifest));
  assert.equal(
    await readFile(resolve(artifacts.directory, Packaging.ProbeOriginal), FileEncoding.Utf8),
    Packaging.ProbeContent,
  );
  assert.equal(
    await readFile(resolve(project, Packaging.ProbeOriginal), FileEncoding.Utf8),
    Packaging.ProbeContent,
  );
  let cursor = 0;
  const eventIds: number[] = [];
  while (true) {
    const page = EventPageSchema.parse(
      await command([
        CliCommand.Events,
        run.run_id,
        ProbeOption.After,
        String(cursor),
        ProbeOption.Limit,
        String(2),
      ]),
    );
    assert.equal(page.run_id, run.run_id);
    assert.equal(page.after, cursor);
    assert.ok(page.events.length <= 2);
    eventIds.push(...page.events.map((event) => event.id));
    cursor = page.next_cursor;
    if (!page.has_more) break;
  }
  assert.ok(eventIds.length > 4);
  assert.deepEqual(
    eventIds,
    Array.from({ length: cursor }, (_, index) => index + 1),
  );
  const catalog = RunPageSchema.parse(
    await command([
      CliCommand.Runs,
      ProbeOption.Limit,
      String(1),
      ProbeOption.ClientId,
      run.client_id,
    ]),
  );
  assert.equal(catalog.runs.length, 1);
  assert.equal(catalog.runs[0]?.run_id, run.run_id);
  assert.equal(catalog.runs[0]?.client_id, run.client_id);
  assert.equal(catalog.has_more, false);
  assert.ok(catalog.next_before < catalog.before);
  for (const session of [ProbeRequest.Session, ProbeRequest.Excess]) {
    const filtered = RunPageSchema.parse(
      await command([
        CliCommand.Runs,
        ProbeOption.ClientId,
        run.client_id,
        ProbeOption.HarnessSessionId,
        session,
        ProbeOption.ProjectPath,
        project,
      ]),
    );
    assert.equal(filtered.schema_version, 2);
    assert.deepEqual(
      filtered.runs.map((row) => row.run_id),
      session === ProbeRequest.Session ? [run.run_id] : [],
    );
    assert.equal(filtered.has_more, false);
    assert.ok(filtered.next_before < filtered.before);
  }
  const older = RunPageSchema.parse(
    await command([CliCommand.Runs, ProbeOption.Before, String(catalog.next_before)]),
  );
  assert.equal(older.runs.length, 0);
  assert.equal(older.next_before, catalog.next_before);
  assert.equal(older.has_more, false);
  await probeDashboard(command, run);
  console.log(
    JSON.stringify({
      installed_version: manifest.version,
      backend: Backend.Fake,
      steps: 4,
      state: run.state,
      run_id: run.run_id,
    }),
  );
}

try {
  await probeInstalledServer();
} finally {
  server.kill(ProcessSignal.Terminate);
  const code = await server.exited;
  assert.equal(code, 0, await serverError);
  await serverOutput;
}

await all(
  [...daemonMaintenanceCases.positive, ...daemonMaintenanceCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(daemonMaintenance, undefined, [...scenario.args, { cli }]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(
  JSON.stringify({
    installed_maintenance_cases:
      daemonMaintenanceCases.positive.length + daemonMaintenanceCases.negative.length,
  }),
);

await all(
  [...nativeReconciliationCases.positive, ...nativeReconciliationCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(nativeReconciliation, undefined, [
        ...scenario.args,
        { cli, vendors: resolve(Packaging.VendorStubs) },
      ]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(
  JSON.stringify({
    installed_reconciliation_cases:
      nativeReconciliationCases.positive.length + nativeReconciliationCases.negative.length,
  }),
);

await all(
  [...nativeScriptReconciliationCases.positive, ...nativeScriptReconciliationCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(nativeScriptReconciliation, undefined, [
        ...scenario.args,
        { cli, vendors: resolve(Packaging.VendorStubs) },
      ]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
await all(
  [...nativeSplitReconciliationCases.positive, ...nativeSplitReconciliationCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(nativeSplitReconciliation, undefined, [
        ...scenario.args,
        { cli, vendors: resolve(Packaging.VendorStubs) },
      ]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(
  JSON.stringify({
    installed_split_reconciliation_cases:
      nativeSplitReconciliationCases.positive.length +
      nativeSplitReconciliationCases.negative.length,
    installed_script_reconciliation_cases:
      nativeScriptReconciliationCases.positive.length +
      nativeScriptReconciliationCases.negative.length,
  }),
);

await all(
  [...nativeWorkflowCases.positive, ...nativeWorkflowCases.negative].map((scenario) => async () => {
    const result = await Reflect.apply(nativeWorkflow, undefined, [
      ...scenario.args,
      { cli, vendors: resolve(Packaging.VendorStubs) },
    ]);
    assert.deepEqual(result, scenario.expected, scenario.name);
  }),
  TestScheduling.Maximum,
);
console.log(
  JSON.stringify({
    installed_native_tool_cases:
      nativeWorkflowCases.positive.length + nativeWorkflowCases.negative.length,
    native_backends: 2,
  }),
);

await all(
  [...nativeProjectWorkflowCases.positive, ...nativeProjectWorkflowCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(nativeProjectWorkflow, undefined, [
        ...scenario.args,
        { cli, vendors: resolve(Packaging.VendorStubs) },
      ]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(
  JSON.stringify({
    installed_native_project_cases:
      nativeProjectWorkflowCases.positive.length + nativeProjectWorkflowCases.negative.length,
  }),
);

await all(
  [...nativeProjectWriteCases.positive, ...nativeProjectWriteCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(nativeProjectWrite, undefined, [
        ...scenario.args,
        { cli, vendors: resolve(Packaging.VendorStubs) },
      ]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(
  JSON.stringify({
    installed_native_project_write_cases:
      nativeProjectWriteCases.positive.length + nativeProjectWriteCases.negative.length,
  }),
);

await all(
  [...finalAttemptRetryCases.positive, ...finalAttemptRetryCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(finalAttemptRetry, undefined, [
        ...scenario.args,
        { cli, vendors: resolve(Packaging.VendorStubs) },
      ]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(
  JSON.stringify({
    installed_final_attempt_cases:
      finalAttemptRetryCases.positive.length + finalAttemptRetryCases.negative.length,
  }),
);

await all(
  [...operationalPeerCases.positive, ...operationalPeerCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(operationalPeer, undefined, [
        ...scenario.args,
        { cli, vendors: resolve(Packaging.VendorStubs) },
      ]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(
  JSON.stringify({
    installed_operational_peer_cases:
      operationalPeerCases.positive.length + operationalPeerCases.negative.length,
  }),
);

await all(
  [...nativeSetupProcessCases.positive, ...nativeSetupProcessCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(nativeSetupProcess, undefined, [
        ...scenario.args,
        { cli, vendors: resolve(Packaging.VendorStubs) },
      ]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(
  JSON.stringify({
    installed_native_setup_cases:
      nativeSetupProcessCases.positive.length + nativeSetupProcessCases.negative.length,
  }),
);

await all(
  [...sdkProcessRecoveryCases.positive, ...sdkProcessRecoveryCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(sdkProcessRecovery, undefined, [
        ...scenario.args.slice(0, 3),
        scenario.args[3] ?? VendorStubMode.RecoverOnce,
        { cli, vendors: resolve(Packaging.VendorStubs) },
      ]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(
  JSON.stringify({
    sdk_recovery_cases:
      sdkProcessRecoveryCases.positive.length + sdkProcessRecoveryCases.negative.length,
    installed: true,
  }),
);

await all(
  [...claudeProcessRetryCases.positive, ...claudeProcessRetryCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(claudeProcessRetry, undefined, [
        ...scenario.args,
        { cli, vendors: resolve(Packaging.VendorStubs) },
      ]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_claude_retry_cases: 4 }));
await all(
  [...claudeBackoffCases.positive, ...claudeBackoffCases.negative].map((scenario) => async () => {
    const result = await Reflect.apply(claudeBackoff, undefined, [
      ...scenario.args,
      { cli, vendors: resolve(Packaging.VendorStubs) },
    ]);
    assert.equal(result, scenario.expected);
  }),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_claude_backoff_cases: 6 }));
await all(
  [...claudeBackoffBranchCases.positive, ...claudeBackoffBranchCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(claudeBackoffBranch, undefined, [
        ...scenario.args,
        { cli, vendors: resolve(Packaging.VendorStubs) },
      ]);
      assert.deepEqual(result, scenario.expected);
    },
  ),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_mixed_backoff_cases: 4 }));

for (const scenario of [...sdkMixedDeliveryCases.positive, ...sdkMixedDeliveryCases.negative]) {
  const result = await Reflect.apply(sdkMixedDelivery, undefined, [
    ...scenario.args,
    { cli, vendors: resolve(Packaging.VendorStubs) },
  ]);
  assert.deepEqual(result, scenario.expected, scenario.name);
}
console.log(
  JSON.stringify({ sdk_mixed_delivery_cases: 4, origins: 2, steps_per_run: 8, installed: true }),
);

await all(
  [...activeProcessRecoveryCases.positive, ...activeProcessRecoveryCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(activeProcessRecovery, undefined, [
        ...scenario.args,
        { cli, vendors: resolve(Packaging.VendorStubs) },
      ]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ active_sdk_recovery_cases: 4, installed: true }));

for (const scenario of [...requestTurnProcessCases.positive, ...requestTurnProcessCases.negative]) {
  const result = await Reflect.apply(requestTurnProcess, undefined, [
    ...scenario.args,
    { cli, vendors: resolve(Packaging.VendorStubs) },
  ]);
  assert.deepEqual(result, scenario.expected, scenario.name);
}
console.log(JSON.stringify({ installed_request_turn_cases: 8, native_backends: 2 }));

for (const scenario of [...helperProcessCases.positive, ...helperProcessCases.negative]) {
  const result = await Reflect.apply(helperProcess, undefined, [
    ...scenario.args,
    { cli, vendors: resolve(Packaging.VendorStubs) },
  ]);
  assert.deepEqual(result, scenario.expected, scenario.name);
}
console.log(JSON.stringify({ installed_helper_cases: 4, native_backends: 2 }));

for (const scenario of [
  ...personaDecisionProcessCases.positive,
  ...personaDecisionProcessCases.negative,
]) {
  const result = await Reflect.apply(personaDecisionProcess, undefined, [...scenario.args, cli]);
  assert.deepEqual(result, scenario.expected, scenario.name);
}
console.log(
  JSON.stringify({
    installed_persona_decision_cases:
      personaDecisionProcessCases.positive.length + personaDecisionProcessCases.negative.length,
  }),
);

for (const scenario of [...personaDefinitionCases.positive, ...personaDefinitionCases.negative]) {
  const result = await Reflect.apply(personaDefinition, undefined, [...scenario.args, cli]);
  assert.deepEqual(result, scenario.expected, scenario.name);
}
console.log(JSON.stringify({ installed_persona_definition_cases: 8 }));

for (const scenario of [
  ...requestTurnParallelCases.positive,
  ...requestTurnParallelCases.negative,
]) {
  const result = await Reflect.apply(requestTurnParallel, undefined, [
    ...scenario.args,
    { cli, vendors: resolve(Packaging.VendorStubs) },
  ]);
  assert.deepEqual(result, scenario.expected, scenario.name);
}
console.log(JSON.stringify({ installed_parallel_request_turn_cases: 4, native_backends: 2 }));

await all(
  [...scriptProcessCases.positive, ...scriptProcessCases.negative].map((scenario) => async () => {
    const result = await Reflect.apply(scriptProcess, undefined, [...scenario.args, cli]);
    assert.deepEqual(result, scenario.expected, scenario.name);
  }),
  TestScheduling.Maximum,
);
await all(
  [...scriptProofProcessCases.positive, ...scriptProofProcessCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(scriptProofProcess, undefined, [...scenario.args, cli]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
await all(
  [...goalProofProcessCases.positive, ...goalProofProcessCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(goalProofProcess, undefined, [...scenario.args, cli]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(
  JSON.stringify({
    installed_script_service_cases: 4,
    installed_script_proof_cases: 4,
    installed_goal_proof_cases: 4,
  }),
);

await all(
  [...serverHubCases.positive, ...serverHubCases.negative].map((scenario) => async () => {
    const result = await Reflect.apply(serverHubProcess, undefined, [
      ...scenario.args.slice(0, 4),
      scenario.args[4] ?? false,
      cli,
    ]);
    assert.deepEqual(result, scenario.expected, scenario.name);
  }),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_project_journal_cases: 6 }));

for (const scenario of [
  ...serverOpenCallProcessCases.positive,
  ...serverOpenCallProcessCases.negative,
]) {
  const result = await Reflect.apply(serverOpenCallProcess, undefined, [...scenario.args, cli]);
  assert.equal(result, scenario.expected, scenario.name);
}
console.log(JSON.stringify({ installed_open_call_cases: 4 }));

for (const scenario of [
  ...personaProductionLifecycleCases.positive,
  ...personaProductionLifecycleCases.negative,
]) {
  const result = await Reflect.apply(personaLifecycleProcess, undefined, [...scenario.args, cli]);
  assert.equal(result, scenario.expected, scenario.name);
}
console.log(JSON.stringify({ installed_persona_lifecycle_cases: 6 }));

for (const scenario of [
  ...personaVisibilityCliCases.positive,
  ...personaVisibilityCliCases.negative,
]) {
  const result = await Reflect.apply(personaVisibilityCli, undefined, [...scenario.args, cli]);
  assert.equal(result, scenario.expected, scenario.name);
}
console.log(JSON.stringify({ installed_persona_visibility_cases: 4 }));

for (const scenario of [...personaShowCases.positive, ...personaShowCases.negative]) {
  const result = await Reflect.apply(personaShow, undefined, [...scenario.args, cli]);
  assert.equal(result, scenario.expected, scenario.name);
}
console.log(JSON.stringify({ installed_persona_show_cases: 5 }));

for (const scenario of [...personaLaterCheckCases.positive, ...personaLaterCheckCases.negative]) {
  const result = await Reflect.apply(personaLaterCheck, undefined, [...scenario.args, cli]);
  assert.equal(result, scenario.expected, scenario.name);
}
console.log(JSON.stringify({ installed_persona_later_check_cases: 6 }));

await all(
  [...scriptedFakeProcessCases.positive, ...scriptedFakeProcessCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(scriptedFakeProcess, undefined, [...scenario.args, cli]);
      assert.equal(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);

console.log(
  JSON.stringify({
    installed_scripted_fake_cases:
      scriptedFakeProcessCases.positive.length + scriptedFakeProcessCases.negative.length,
    concurrent_profiles: 2,
  }),
);

await all(
  [...scriptedFakeWatchCases.positive, ...scriptedFakeWatchCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(scriptedFakeWatch, undefined, [...scenario.args, cli]);
      assert.equal(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(
  JSON.stringify({
    installed_watched_fake_cases:
      scriptedFakeWatchCases.positive.length + scriptedFakeWatchCases.negative.length,
  }),
);

await all(
  [...cliObserverProcessCases.positive, ...cliObserverProcessCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(cliObserverProcess, undefined, [...scenario.args, cli]);
      assert.equal(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_live_observer_cases: 4 }));

await all(
  [...cliConfiguredStartupCases.positive, ...cliConfiguredStartupCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(cliConfiguredStartup, undefined, [
        ...scenario.args,
        cli,
        installed,
      ]);
      assert.equal(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_configured_startup_cases: 4 }));

await all(
  [...workflowExampleCases.positive, ...workflowExampleCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(workflowExample, undefined, [
        ...scenario.args,
        cli,
        installed,
      ]);
      assert.equal(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
await all(
  [...workflowExamplesCheckCases.positive, ...workflowExamplesCheckCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(workflowExamplesCheck, undefined, [
        ...scenario.args,
        cli,
        installed,
      ]);
      assert.equal(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(
  JSON.stringify({ installed_workflow_examples: 4, repeated_runs: 2, installed_batch_checks: 8 }),
);

await all(
  [...workflowExampleCases.positive, ...workflowExampleCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(automaticWorkflowExample, undefined, [
        ...scenario.args,
        cli,
        installed,
      ]);
      assert.equal(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(
  JSON.stringify({ installed_automatic_workflows: 4, invalid_scripts_without_startup: 1 }),
);

await all(
  [...cliSubmissionReceiptCases.positive, ...cliSubmissionReceiptCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(cliSubmissionReceipt, undefined, [...scenario.args, cli]);
      assert.equal(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_submission_receipt_cases: 4 }));

await all(
  [...mcpSubmissionCases.positive, ...mcpSubmissionCases.negative].map((scenario) => async () => {
    const result = await Reflect.apply(mcpSubmissionProcess, undefined, [...scenario.args, cli]);
    assert.equal(result, scenario.expected, scenario.name);
  }),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_mcp_submission_cases: 4 }));

await all(
  [...cliEnvelopeProcessCases.positive, ...cliEnvelopeProcessCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(cliEnvelopeProcess, undefined, [...scenario.args, cli]);
      assert.equal(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
await all(
  [...cliEnvelopeQueryCases.positive, ...cliEnvelopeQueryCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(cliEnvelopeQuery, undefined, [...scenario.args, cli]);
      assert.equal(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
await all(
  [...cliEventFollowProcessCases.positive, ...cliEventFollowProcessCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(cliEventFollowProcess, undefined, [...scenario.args, cli]);
      assert.equal(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_cli_envelope_cases: 8, installed_event_follow_cases: 4 }));

await all(
  [...cliOutputObservationProcessCases.positive, ...cliOutputObservationProcessCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(cliOutputObservationProcess, undefined, [
        ...scenario.args,
        cli,
      ]);
      assert.equal(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_observation_recovery_cases: 4 }));

await all(
  [...mcpStdioFramesCases.positive, ...mcpStdioFramesCases.negative].map((scenario) => async () => {
    const result = await Reflect.apply(mcpStdioFrames, undefined, [...scenario.args, cli]);
    assert.deepEqual(result, scenario.expected, scenario.name);
  }),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_mcp_frame_cases: 4 }));

await all(
  [...crashResumeCases.positive, ...crashResumeCases.negative].map((scenario) => async () => {
    const result = await Reflect.apply(crashResume, undefined, [
      ...scenario.args,
      { cli, vendors: resolve(Packaging.VendorStubs) },
    ]);
    assert.equal(result, scenario.expected, scenario.name);
  }),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_crash_resume_cases: 4 }));

await all(
  [...graphValidationCases.positive, ...graphValidationCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(graphValidation, undefined, [...scenario.args, cli]);
      assert.equal(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_graph_validation_cases: 9 }));

await all(
  [...runCompatibilityCases.positive, ...runCompatibilityCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(runCompatibility, undefined, [...scenario.args, cli]);
      assert.equal(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_run_compatibility_cases: 4 }));

await all(
  [...runtimePinProcessCases.positive, ...runtimePinProcessCases.negative].map(
    (entry) => async () => {
      const result = await Reflect.apply(runtimePinProcess, undefined, [...entry.args, cli]);
      assert.equal(result, entry.expected, entry.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_runtime_pin_cases: 6 }));

await all(
  [...configFileEditCases.positive, ...configFileEditCases.negative].map((scenario) => async () => {
    const result = await Reflect.apply(configFileProcess, undefined, [...scenario.args, cli]);
    assert.deepEqual(result, scenario.expected, scenario.name);
  }),
  TestScheduling.Maximum,
);
await all(
  [...configFileConcurrencyCases.positive, ...configFileConcurrencyCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(configConcurrentProcess, undefined, [
        ...scenario.args,
        cli,
      ]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(
  JSON.stringify({
    installed_config_edits:
      configFileEditCases.positive.length + configFileEditCases.negative.length,
    installed_config_races:
      configFileConcurrencyCases.positive.length + configFileConcurrencyCases.negative.length,
  }),
);

await all(
  [...configFileBoundaryCases.positive, ...configFileBoundaryCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(configFileBoundaryProcess, undefined, [
        ...scenario.args,
        cli,
      ]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_config_boundary_cases: 7 }));

await all(
  [...frozenConfigProcessCases.positive, ...frozenConfigProcessCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(frozenConfigProcess, undefined, [
        ...scenario.args,
        { cli },
      ]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_frozen_config_cases: 4 }));

await all(
  [...scopedConfigShowCases.positive, ...scopedConfigShowCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(scopedConfigShowProcess, undefined, [
        ...scenario.args,
        cli,
      ]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_scoped_config_show_cases: 6 }));

await all(
  [...attemptInputProcessCases.positive, ...attemptInputProcessCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(attemptInputProcess, undefined, [
        ...scenario.args,
        { cli, vendors: resolve(Packaging.VendorStubs) },
      ]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_attempt_input_cases: 4 }));

await all(
  [...candidateCommitmentProcessCases.positive, ...candidateCommitmentProcessCases.negative].map(
    (scenario) => async () => {
      const result = await Reflect.apply(candidateCommitmentProcess, undefined, [
        ...scenario.args,
        { cli, vendors: resolve(Packaging.VendorStubs) },
      ]);
      assert.deepEqual(result, scenario.expected, scenario.name);
    },
  ),
  TestScheduling.Maximum,
);
console.log(JSON.stringify({ installed_candidate_commitment_cases: 4 }));
