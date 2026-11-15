import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { KnowledgeKind, KnowledgeLimit, KnowledgeSearchMode } from "@titan/constants";
import { jsonByteLength } from "@titan/core";
import { KnowledgeHub, nativeRunKnowledge, ScopedKnowledgeHub } from "@titan/knowledge";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { knowledgeAttemptScope } from "./knowledge-attempts.ts";

export async function knowledgeMergeBounds(privateView: boolean, large: boolean) {
  return withTemporaryDirectory(async (root) => {
    await using resources = new AsyncDisposableStack();
    const local = await KnowledgeHub.open(resolve(root, "project"));
    resources.defer(() => local.close());
    const home = await KnowledgeHub.open(resolve(root, "home"));
    resources.defer(() => home.close());
    const hubs = ScopedKnowledgeHub.join(local, home);
    try {
      const tags = large
        ? Array.from(
            { length: 32 },
            (_, index) => String(index).padStart(2, "0") + "\u0001".repeat(62),
          )
        : [];
      for (const hub of [hubs.project, hubs.home]) {
        for (let index = 0; index < 48; index++)
          await hub.add({
            kind: KnowledgeKind.Fact,
            title: `Fact ${index}`,
            body: "Bounded knowledge",
            tags,
          });
      }
      const query = {
        kind: KnowledgeKind.Fact,
        mode: KnowledgeSearchMode.Words,
        limit: KnowledgeLimit.MaximumPage,
      };
      const scope = knowledgeAttemptScope();
      const native = await nativeRunKnowledge(local, home, scope);
      const page = privateView ? await native.view(scope).search(query) : await hubs.search(query);
      assert.ok(jsonByteLength(page.results, KnowledgeLimit.PageBytes) <= KnowledgeLimit.PageBytes);
      assert.equal(page.truncated, large);
      assert.equal(page.results.length < 96, large);
      assert.ok(page.results.length > 0);
      return true;
    } finally {
      await hubs.close();
    }
  });
}
