import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  BoardFile,
  RunStatus,
  ServerDatabaseAdapter,
  ServerSql,
  SummaryCase,
  SummaryTest,
} from "@titan/constants";
import { describeRun } from "@titan/server/listing";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { ReadStoredRun, StoredCatalog } from "@titan/types";

export async function runSummaryReads(kind: SummaryCase) {
  return withTemporaryDirectory(async (root) => {
    const db = new Bun.SQL({
      adapter: ServerDatabaseAdapter,
      filename: resolve(root, SummaryTest.Database),
      strict: true,
    });
    try {
      for (const statement of ServerSql.Initialize) await db.unsafe(statement);
      const folder = resolve(root, SummaryTest.Folder);
      await mkdir(folder);
      const journal = resolve(folder, BoardFile.Journal);
      if (kind !== SummaryCase.Missing) await writeFile(journal, SummaryTest.Journal);
      let reads = 0;
      const read = (async () => {
        reads++;
        return {
          workflow_id: SummaryTest.Workflow,
          state: RunStatus.Passed,
          project: SummaryTest.Project,
        };
      }) as unknown as ReadStoredRun;
      const row: StoredCatalog = {
        sequence: SummaryTest.Sequence,
        id: SummaryTest.Id,
        root: folder,
        client_id: SummaryTest.Client,
      } as StoredCatalog;
      const cache = kind === SummaryCase.NoCache ? undefined : db;
      await describeRun(row, read, cache);
      if (kind === SummaryCase.Appended)
        await writeFile(journal, SummaryTest.Journal + SummaryTest.Extra);
      const summary = await describeRun(row, read, cache);
      return { reads, state: summary.state };
    } finally {
      await db.close();
    }
  });
}
