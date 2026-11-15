import { chmod, lstat, mkdir } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import {
  ErrorCode,
  FileEncoding,
  IoLimit,
  ProofAnswer,
  RequestDecision,
  RequestKind,
  RequestLimit,
  RunEventKind,
  StatementLock,
  StatementState,
  VerifyKind,
} from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { RunnerMessage } from "@titan/messages";
import { atomicWrite } from "@titan/streams";
import {
  type OperationScope,
  type Run,
  type ScriptCheckAnswer,
  type StatementEntry,
  type StatementLocked,
  StatementLockedSchema,
  type StatementLockPorts,
  type Step,
} from "@titan/types";
import { assertStatementPaths } from "@titan/workflow";
import { readRetainedFile, readWorkspaceFile } from "@titan/workspace";

function requestId(entry: StatementEntry): string {
  return `${StatementLock.RequestPrefix}${hash(`${entry.scope}${StatementLock.Separator}${entry.path}`).slice(StatementLock.Start, StatementLock.IdLength)}`;
}

function chunks(text: string): string[] {
  const parts: string[] = [];
  for (let at = StatementLock.Start; at < text.length; at += RequestLimit.TextCharacters)
    parts.push(text.slice(at, at + RequestLimit.TextCharacters));
  return parts;
}

function lockScope(entry: StatementEntry, text: string, digest: string): OperationScope {
  return {
    operation: StatementLock.Operation,
    resource: entry.scope,
    content_hashes: { [StatementLock.HashKey]: digest },
    arguments: [entry.path, ...chunks(text)],
    environment_names: [],
  };
}

export class StatementLocks {
  constructor(private ports: StatementLockPorts) {}

  entries(run: Run, step: Step): StatementEntry[] {
    const selected = [
      ...(run.plan.workflow.verify ?? []).map((entry) => ({ scope: StatementLock.Goal, entry })),
      ...step.verify.map((entry) => ({ scope: step.id, entry })),
    ];
    return selected.flatMap(({ scope, entry }) =>
      entry.kind === VerifyKind.Lean || entry.kind === VerifyKind.Smt
        ? [{ scope, path: entry.statement }]
        : [],
    );
  }

  async ready(run: Run, step: Step): Promise<StatementState> {
    let state = StatementState.Ready;
    for (const entry of this.entries(run, step)) {
      const next = await this.admit(run, entry);
      if (next === StatementState.Denied) return next;
      if (next === StatementState.Waiting) state = next;
    }
    return state;
  }

  private async admit(run: Run, entry: StatementEntry): Promise<StatementState> {
    let text: string;
    try {
      await assertStatementPaths(run.plan, run.project);
      text = (
        await readWorkspaceFile(
          run.project,
          relative(run.project, resolve(run.project, entry.path)),
          IoLimit.DataBytes,
        )
      ).toString(FileEncoding.Utf8);
    } catch {
      return StatementState.Denied;
    }
    const digest = hash(text);
    const id = requestId(entry);
    const scope = lockScope(entry, text, digest);
    const ledger = this.ports.ledger();
    const existing = (await ledger.list(run.run_id)).find((request) => request.request_id === id);
    if (!existing) {
      await ledger.open(run.run_id, {
        request_id: id,
        kind: RequestKind.LockStatement,
        scope,
        origin: { client_id: run.client_id, harness_session_id: null },
        expires_at: Date.now() + StatementLock.ExpiresMs,
      });
      return StatementState.Waiting;
    }
    if (existing.answer === null) return StatementState.Waiting;
    if (existing.answer.decision === RequestDecision.Deny) return StatementState.Denied;
    try {
      await ledger.approved(run.run_id, id, RequestKind.LockStatement, scope);
    } catch {
      return StatementState.Denied;
    }
    await this.lock(run, entry, id, text, digest);
    return StatementState.Ready;
  }

  private async lock(
    run: Run,
    entry: StatementEntry,
    id: string,
    text: string,
    digest: string,
  ): Promise<void> {
    if (await this.recorded(run, id)) return;
    const target = resolve(
      run.root,
      StatementLock.Directory,
      `${id}${StatementLock.Separator}${basename(entry.path)}`,
    );
    await mkdir(dirname(target), { recursive: true });
    const parent = await lstat(dirname(target));
    if (parent.isSymbolicLink() || !parent.isDirectory())
      throw new TitanError(ErrorCode.UnsafeSymlink, dirname(target));
    await atomicWrite(target, text);
    await chmod(target, StatementLock.Mode);
    const record: StatementLocked = {
      request_id: id,
      scope: entry.scope,
      path: entry.path,
      hash: digest,
      copy: relative(run.root, target),
    };
    await this.ports.commit(run, RunEventKind.StatementLocked, record);
  }

  private async recorded(run: Run, id: string): Promise<StatementLocked | undefined> {
    for await (const event of this.ports.events(run)) {
      if (event.type !== RunEventKind.StatementLocked) continue;
      const parsed = StatementLockedSchema.safeParse(event.data);
      if (parsed.success && parsed.data.request_id === id) return parsed.data;
    }
    return undefined;
  }

  async check(run: Run, step: Step): Promise<ScriptCheckAnswer | null> {
    for (const entry of this.entries(run, step)) {
      const record = await this.recorded(run, requestId(entry));
      if (!record) continue;
      const current = await readRetainedFile(
        run.root,
        record.copy,
        record.hash,
        IoLimit.DataBytes,
      ).catch(() => null);
      if (current === null)
        return { answer: ProofAnswer.NotProven, evidence: RunnerMessage.StatementChanged };
    }
    return null;
  }
}
