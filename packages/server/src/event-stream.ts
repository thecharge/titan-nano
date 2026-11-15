import { DashboardBuild, DashboardHeader, DashboardStream, EventCursor } from "@titan/constants";
import { DashboardMessage } from "@titan/messages";
import type { EventPage } from "@titan/types";

export function cursorOf(request: Request): number | undefined {
  const header =
    request.headers.get(DashboardHeader.LastEventId) ??
    new URL(request.url).searchParams.get(EventCursor.After) ??
    DashboardBuild.FirstCursor;
  return DashboardStream.IdPattern.test(header) ? Number(header) : undefined;
}

export function eventBody(
  read: (after: number) => Promise<EventPage>,
  first: number,
): ReadableStream<Uint8Array> {
  let after = first;
  let closed = false;
  let lastWrite = Date.now();
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (!closed) {
        const page = await read(after);
        if (page.events.length > 0) {
          for (const event of page.events)
            controller.enqueue(
              encoder.encode(
                DashboardMessage.Frame(event.id, DashboardStream.EventName, JSON.stringify(event)),
              ),
            );
          after = page.next_cursor;
          lastWrite = Date.now();
          return;
        }
        if (Date.now() - lastWrite >= DashboardStream.KeepAliveMilliseconds) {
          controller.enqueue(encoder.encode(DashboardStream.KeepAlive));
          lastWrite = Date.now();
          return;
        }
        await Bun.sleep(DashboardStream.PollMilliseconds);
      }
    },
    cancel() {
      closed = true;
    },
  });
}
