import { strict as assert } from "node:assert";
import {
  ErrorCode,
  KnowledgeAttemptLimit,
  KnowledgeAttemptState,
  type KnowledgeKind,
  KnowledgePublicationStage,
} from "@titan/constants";
import { KnowledgeHub } from "@titan/knowledge";
import { readFileBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { KnowledgeAttemptDocumentSchema } from "@titan/types";
import {
  knowledgeAttemptChanges,
  knowledgeAttemptPath,
  knowledgeAttemptScope,
} from "./knowledge-attempts.ts";

export async function knowledgeAttemptQueue(kind: KnowledgeKind, fail: boolean) {
  async function observe(home: string) {
    const entered = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const hub = await KnowledgeHub.open(home, {}, async (stage) => {
      if (stage !== KnowledgePublicationStage.Journal) return;
      entered.resolve();
      await released.promise;
      if (fail) throw new Error("Interrupted queued publication");
    });
    const owner = knowledgeAttemptScope();
    const peer = knowledgeAttemptScope();
    const mutations = knowledgeAttemptChanges(kind);
    let stopping: Promise<void> | undefined;
    try {
      await hub.attempts.stage(owner, { revision: null, mutations });
      const publishing = fail
        ? assert.rejects(hub.attempts.publish(owner, 1), {
            message: "Interrupted queued publication",
          })
        : hub.attempts.publish(owner, 1);
      await entered.promise;
      const queued = fail
        ? assert.rejects(hub.attempts.stage(peer, { revision: null, mutations: [] }), {
            code: ErrorCode.KnowledgeUnavailable,
          })
        : hub.attempts.stage(peer, { revision: null, mutations: [] });
      if (!fail) stopping = hub.close();
      released.resolve();
      await publishing;
      await queued;
      await stopping;
      if (fail) {
        assert.equal(await Bun.file(knowledgeAttemptPath(home, peer)).exists(), false);
        await assert.rejects(hub.attempts.read(owner), { code: ErrorCode.KnowledgeUnavailable });
      } else {
        const document = KnowledgeAttemptDocumentSchema.parse(
          JSON.parse(
            (
              await readFileBytes(
                knowledgeAttemptPath(home, peer),
                KnowledgeAttemptLimit.DocumentBytes,
              )
            ).toString(),
          ),
        );
        assert.equal(document.state, KnowledgeAttemptState.Open);
        assert.equal(document.revision, 1);
        await assert.rejects(hub.attempts.read(peer), { code: ErrorCode.KnowledgeUnavailable });
      }
      return true;
    } finally {
      released.resolve();
      await stopping;
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}
