import { strict as assert } from "node:assert";
import { appendFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { boardPosts, RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  ApprovalLevel,
  Backend,
  BoardExchange,
  BoardFile,
  BoardLoad,
  BoardPostKind,
  BoardTalk,
  FileEncoding,
  Newline,
  RequestDecision,
  RequestKind,
} from "@titan/constants";
import { all, settle } from "@titan/core";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { BoardPost } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

function describeRequest(kind: RequestKind, resource: string, question: string) {
  return {
    kind,
    scope: {
      operation: BoardExchange.Operation,
      resource,
      content_hashes: {},
      arguments: [question],
      environment_names: [],
    },
    expires_at: Date.now() + BoardTalk.ExpiresMs,
  };
}

function summarize(posts: readonly BoardPost[]): string {
  return posts
    .map((post) => `${post.from}${BoardTalk.Arrow}${post.to}${BoardTalk.Colon}${post.kind}`)
    .join(BoardTalk.Split);
}

async function startedRun(root: string, backend: FakeBackend) {
  const config = await resolveConfig({
    home: resolve(root, "home"),
    project: root,
    overrides: { recovery: { max_retries: 0 }, limits: { max_parallel: 2 } },
  });
  const base = vendorRecoveryWorkflow(BoardExchange.CheckTask);
  const step = base.steps[0];
  assert.ok(step);
  const workflow = validateWorkflow({
    ...base,
    personas: {
      [BoardTalk.Fixer]: { ...base.personas.worker, request_turns: true },
      [BoardTalk.Skeptic]: { ...base.personas.checker, request_turns: true },
    },
    steps: [
      {
        ...step,
        do: { persona: BoardTalk.Fixer, task: BoardExchange.FixTask },
        falsify: [{ persona: BoardTalk.Skeptic, task: BoardExchange.CheckTask }],
      },
    ],
  });
  const engine = new Engine(() => backend);
  const run = await engine.create({
    project: root,
    config,
    plan: workflow,
    backend: Backend.Fake,
    client_id: BoardExchange.RunClient,
    submission_id: BoardExchange.RunClient,
  });
  return { engine, run };
}

export async function boardAfterQuestion(
  asker: string,
  target: string,
  asked: boolean,
  answered: boolean,
): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const { engine, run } = await startedRun(root, new FakeBackend());
    if (asked) {
      const request = await engine.requests.open(run.run_id, {
        request_id: BoardTalk.RequestId,
        ...describeRequest(RequestKind.Ask, target, BoardTalk.Question),
        origin: { client_id: asker, harness_session_id: null },
      });
      if (answered)
        await engine.requests.answer(
          {
            run_id: run.run_id,
            request_id: request.request_id,
            version: request.version,
            decision: RequestDecision.Approve,
            reason: BoardTalk.Answer,
          },
          { client_id: target, authority: ApprovalLevel.Main },
        );
    }
    return summarize(await boardPosts(new RunStore(run.root).events()));
  });
}

export async function parallelBoardWrites(
  writers: number,
  posts: number,
  torn: boolean,
): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const { run } = await startedRun(root, new FakeBackend());
    const store = new RunStore(run.root);
    await store.read();
    const path = resolve(run.root, BoardFile.Journal);
    const lines = async () =>
      (await readFile(path, FileEncoding.Utf8)).split(Newline).filter((line) => line.length > 0);
    const before = (await lines()).length;
    await all(
      Array.from(
        { length: writers },
        (_, writer) => async () =>
          all(
            Array.from(
              { length: posts },
              (__, index) => async () => store.commit(run, BoardTalk.Event, { writer, index }),
            ),
            1,
          ),
      ),
      BoardLoad.Concurrency,
    );
    if (torn) await appendFile(path, BoardTalk.Torn);
    const after = await lines();
    const valid = after.every((line) => {
      try {
        JSON.parse(line);
        return true;
      } catch {
        return false;
      }
    });
    return `${after.length - before} ${valid}`;
  });
}

export async function unknownRequestKindRefusal(kind: string): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const backend = new FakeBackend(async (spec) => ({
      json:
        spec.persona_id === BoardTalk.Fixer
          ? {
              result: null,
              requests: [describeRequest(kind as RequestKind, BoardTalk.Investigator, kind)],
            }
          : { result: null, requests: [] },
    }));
    const { engine, run } = await startedRun(root, backend);
    await settle([() => engine.start(run.run_id)]);
    const posts = await boardPosts(new RunStore(run.root).events());
    const refused = posts.filter((post) => post.kind === BoardPostKind.Refused);
    const others = posts.filter((post) => post.kind !== BoardPostKind.Refused);
    return `${refused.length} ${refused.map((post) => post.text).join(BoardTalk.Split)} ${others.length}`;
  });
}
