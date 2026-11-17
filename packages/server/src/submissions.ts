import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveConfig, workflowSettings } from "@titan/config";
import {
  BoardFile,
  ErrorCode,
  ErrorField,
  FileErrorCode,
  HttpStatus,
  IoLimit,
  ServerSql,
} from "@titan/constants";
import { hash, newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { ServerMessage, WorkflowMessage } from "@titan/messages";
import type { Engine } from "@titan/runner";
import type { KeyedQueue } from "@titan/store";
import { readFileBytes } from "@titan/streams";
import {
  type BackendFactory,
  type CatalogDatabase,
  type Logger,
  type OwnedKnowledge,
  type RunCreation,
  StoredSubmissionSchema,
  SubmissionSchema,
} from "@titan/types";
import { validateWorkflow, workflowFile } from "@titan/workflow";
import { exists } from "@titan/workspace";
import { observeRun } from "./background.ts";

async function projectDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (
      error instanceof Error &&
      [FileErrorCode.Missing, FileErrorCode.NotDirectory].some(
        (code) => Reflect.get(error, ErrorField.Code) === code,
      )
    )
      return false;
    throw error;
  }
}

export class RunSubmissions {
  constructor(
    private home: string,
    private factory: BackendFactory,
    private database: CatalogDatabase,
    private engine: Engine,
    private operations: KeyedQueue,
    private submissions: KeyedQueue,
    private logger: Logger,
    private knowledge: OwnedKnowledge,
  ) {}

  private async prepare(input: unknown): Promise<RunCreation> {
    const parsed = SubmissionSchema.safeParse(input);
    if (!parsed.success) throw new TitanError(ErrorCode.InvalidSubmission, parsed.error.message);
    const body = parsed.data;
    const project = body.project;
    if (resolve(project) !== project || !(await projectDirectory(project)))
      throw new TitanError(ErrorCode.ProjectPath, ServerMessage.Project);
    this.factory(body.backend);
    const config = await resolveConfig({
      home: this.home,
      project,
      workflow: workflowSettings(body.workflow),
      overrides: body.overrides ?? {},
    });
    const plan = validateWorkflow(body.workflow, config.value.limits.max_group_depth);
    let source: Uint8Array | undefined;
    if (body.preserve_source) {
      if (!body.workflow_path || resolve(body.workflow_path) !== body.workflow_path)
        throw new TitanError(ErrorCode.InvalidSubmission, WorkflowMessage.SourceRead);
      try {
        source = await readFileBytes(body.workflow_path, IoLimit.DataBytes);
      } catch {
        throw new TitanError(ErrorCode.InvalidSubmission, WorkflowMessage.SourceRead);
      }
      source = workflowFile(plan, source, config.value.limits.max_group_depth);
    }
    const resolved = validateWorkflow(
      await this.knowledge.resolvePersonas(plan.workflow, project),
      config.value.limits.max_group_depth,
    );
    this.engine.preflight(resolved, config, body.backend);
    return {
      ...(source === undefined ? {} : { workflow_source: source }),
      project,
      plan,
      ...(resolved.revision === plan.revision ? {} : { resolved_plan: resolved }),
      config,
      backend: body.backend,
      client_id: String(body.client_id),
      submission_id: String(body.submission_id),
      ...(body.harness_session_id !== undefined
        ? { harness_session_id: body.harness_session_id }
        : {}),
      ...(body.workflow_path !== undefined ? { workflow_path: body.workflow_path } : {}),
    };
  }

  async submit(input: unknown): Promise<Response> {
    const options = await this.prepare(input);
    const request_hash = hash(
      JSON.stringify({
        project: options.project,
        plan: options.plan,
        backend: options.backend,
        config: options.config.hash,
        workflow_path: options.workflow_path,
        workflow_source:
          options.workflow_source === undefined ? undefined : hash(options.workflow_source),
        ...(options.harness_session_id !== undefined
          ? { harness_session_id: options.harness_session_id }
          : {}),
      }),
    );
    const identity = JSON.stringify([options.client_id, options.submission_id]);
    return await this.submissions.use(identity, () => this.admit(options, request_hash));
  }

  private async admit(options: RunCreation, requestHash: string): Promise<Response> {
    const old = StoredSubmissionSchema.optional().parse(
      (
        await this.database.unsafe(ServerSql.Submission, [options.client_id, options.submission_id])
      )[0],
    );
    if (old && old.request_hash !== requestHash)
      throw new TitanError(ErrorCode.SubmissionConflict, ServerMessage.SubmissionConflict);
    const id = old?.id ?? newId();
    return await this.operations.use(id, async () => {
      const root = old?.root ?? resolve(options.project, BoardFile.Runs, id);
      if (!old)
        await this.database.unsafe(ServerSql.Insert, [
          id,
          root,
          options.client_id,
          options.submission_id,
          requestHash,
        ]);
      const created = await this.retain(id, root, options);
      if (created) void observeRun(this.engine.start(id), id, this.logger);
      return Response.json(await this.engine.snapshot(id), {
        status: old ? HttpStatus.Ok : HttpStatus.Created,
      });
    });
  }

  private async retain(id: string, root: string, options: RunCreation): Promise<boolean> {
    if (this.engine.has(id)) return false;
    if (await exists(resolve(root, BoardFile.Journal))) {
      await this.engine.load(root);
      return false;
    }
    const { workflow_path, resolved_plan: _resolved, ...creation } = options;
    const binding = await this.knowledge.bindPersonas(
      options.plan.workflow,
      options.project,
      hash(id),
    );
    const resolved = validateWorkflow(
      binding.workflow,
      options.config.value.limits.max_group_depth,
    );
    await this.engine.create({
      ...creation,
      persona_references: binding.references,
      ...(resolved.revision === options.plan.revision ? {} : { resolved_plan: resolved }),
      ...(workflow_path ? { workflow_path } : {}),
      run_id: id,
    });
    return true;
  }
}
