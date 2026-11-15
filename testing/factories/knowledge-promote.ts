import { join } from "node:path";
import {
  KnowledgeKind,
  KnowledgePromoteCase,
  KnowledgeScope,
  KnowledgeScopeFixture,
} from "@titan/constants";
import { newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { ScopedKnowledgeHub } from "@titan/knowledge";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";

const utc = {
  kind: KnowledgeKind.Fact,
  title: KnowledgeScopeFixture.UtcTitle,
  body: KnowledgeScopeFixture.UtcBody,
};

function failure(error: unknown, message: boolean): string {
  if (!(error instanceof TitanError)) return KnowledgeScopeFixture.Nothing;
  return message ? error.message : error.code;
}

export function scopedPromote(which: KnowledgePromoteCase): Promise<string> {
  return withTemporaryDirectory(async (directory) => {
    const hub = await ScopedKnowledgeHub.open(
      join(directory, KnowledgeScopeFixture.Project),
      join(directory, KnowledgeScopeFixture.Home),
    );
    try {
      const id = newId();
      await hub.project.add({ ...utc, id });
      if (which === KnowledgePromoteCase.Missing) {
        const error = await thrownBy(async () => {
          await hub.promote(newId());
        });
        return failure(error, false);
      }
      if (
        which === KnowledgePromoteCase.Duplicate ||
        which === KnowledgePromoteCase.DuplicateMessage ||
        which === KnowledgePromoteCase.DuplicateKept
      ) {
        await hub.home.add({
          id,
          kind: utc.kind,
          title: KnowledgeScopeFixture.ZoneTitle,
          body: KnowledgeScopeFixture.ZoneBody,
        });
        const error = await thrownBy(async () => {
          await hub.promote(id);
        });
        if (which === KnowledgePromoteCase.DuplicateKept)
          return (await hub.home.get(id)).entry.body;
        return failure(error, which === KnowledgePromoteCase.DuplicateMessage);
      }
      await hub.promote(id);
      const copied = (await hub.home.get(id)).entry;
      if (which === KnowledgePromoteCase.Text) return copied.body;
      if (which === KnowledgePromoteCase.Source)
        return copied.tags.join(KnowledgeScopeFixture.Rows);
      const kept = await hub.project.get(id);
      return `${KnowledgeScope.Project}${KnowledgeScopeFixture.Joiner}${kept.entry.title}`;
    } finally {
      await hub.close();
    }
  });
}
