import { BoardLimit, ErrorCode } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { BoardMessage } from "@titan/messages";
import {
  type EventPage,
  type EventQueryInput,
  EventQuerySchema,
  type RunEvent,
  type RunEventView,
} from "@titan/types";

export async function readEventPage(
  source: AsyncIterable<RunEvent>,
  query: EventQueryInput,
  runId: string,
): Promise<EventPage> {
  const { after, limit } = EventQuerySchema.parse(query);
  const events: RunEventView[] = [];
  const identity = { schema_version: BoardLimit.EventPageVersion, run_id: runId, after };
  let bytes = Buffer.byteLength(
    JSON.stringify({ ...identity, events, next_cursor: Number.MAX_SAFE_INTEGER, has_more: false }),
  );
  let latest = 0;
  for await (const { state: _state, ...event } of source) {
    latest = event.id;
    if (event.id <= after) continue;
    const size = Buffer.byteLength(JSON.stringify(event)) + Number(events.length > 0);
    const full = events.length === limit || bytes + size > BoardLimit.EventPageBytes;
    if (full && !events.length) throw new TitanError(ErrorCode.EventSize, BoardMessage.EventSize);
    if (full)
      return { ...identity, events, next_cursor: events.at(-1)?.id ?? after, has_more: true };
    events.push(event);
    bytes += size;
  }
  if (after > latest) throw new TitanError(ErrorCode.EventCursor, BoardMessage.EventCursor);
  return { ...identity, events, next_cursor: events.at(-1)?.id ?? after, has_more: false };
}
