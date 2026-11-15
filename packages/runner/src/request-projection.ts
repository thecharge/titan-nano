import { resolve } from "node:path";
import { atomicWriteStream, type RunStore } from "@titan/board";
import { RequestProjection, RunEventKind } from "@titan/constants";
import type { RequestLedger } from "@titan/requests";
import { jsonStream } from "@titan/streams";
import type { Run } from "@titan/types";

export async function projectRequests(
  store: RunStore,
  ledger: RequestLedger,
  run: Run,
  kind?: string,
): Promise<void> {
  if (
    kind !== undefined &&
    kind !== RunEventKind.Created &&
    kind !== RunEventKind.RequestOpened &&
    kind !== RunEventKind.RequestAnswered &&
    kind !== RunEventKind.RequestEscalated &&
    kind !== RunEventKind.RequestTurnOpened
  )
    return;
  const document = await ledger.projection(run, store.events(run.version));
  await atomicWriteStream(
    resolve(run.root, RequestProjection.File),
    jsonStream(document, RequestProjection.MaximumBytes),
    RequestProjection.MaximumBytes,
  );
}
