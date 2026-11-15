import { isAbsolute, resolve } from "node:path";
import {
  EventCursor,
  IdentifierPattern,
  RequestLimit,
  RequestPageFormat,
  RequestPageLimit,
  RequestState,
  ServerState,
} from "@titan/constants";
import { z } from "zod";
import type { StoredCatalog } from "./catalog.ts";
import type { CatalogDatabase } from "./contracts/catalog.ts";
import { OperationRequestSchema } from "./requests.ts";

const identity = z.string().regex(IdentifierPattern);
export const RequestListQuerySchema = z.strictObject({
  cursor: z
    .string()
    .max(RequestPageLimit.CursorCharacters)
    .regex(RequestPageFormat.CursorPattern)
    .optional(),
  limit: z.number().int().positive().max(RequestPageLimit.Maximum).default(RequestPageLimit.Count),
  run_id: identity.optional(),
  client_id: identity.optional(),
  harness_session_id: identity.optional(),
  project_path: z
    .string()
    .max(RequestPageLimit.ProjectCharacters)
    .refine((path) => isAbsolute(path) && resolve(path) === path)
    .optional(),
  state: z.enum(RequestState).optional(),
});
export type RequestListQuery = z.infer<typeof RequestListQuerySchema>;
export type RequestListQueryInput = z.input<typeof RequestListQuerySchema>;
export const RequestListSearchSchema = RequestListQuerySchema.omit({ limit: true })
  .extend({
    limit: z.string().regex(EventCursor.IntegerPattern).transform(Number).optional(),
  })
  .pipe(RequestListQuerySchema);
export const RequestCursorSchema = z
  .strictObject({
    before: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    run_id: identity.nullable(),
    after: identity.nullable(),
    filters: z.string().regex(RequestLimit.HashPattern),
  })
  .refine((cursor) => cursor.after === null || cursor.run_id !== null);
export type RequestCursor = z.infer<typeof RequestCursorSchema>;
export const RequestPageItemSchema = z.strictObject({
  project_path: z.string().max(RequestPageLimit.ProjectCharacters),
  request: OperationRequestSchema,
});
export type RequestPageItem = z.infer<typeof RequestPageItemSchema>;
export const RequestUnavailableSchema = z.strictObject({
  run_id: identity,
  client_id: identity,
  state: z.literal(ServerState.ReadUnavailable),
});
export type RequestUnavailable = z.infer<typeof RequestUnavailableSchema>;
export const RequestPageSchema = z
  .strictObject({
    schema_version: z.literal(RequestPageLimit.Version),
    query: RequestListQuerySchema,
    requests: z.array(RequestPageItemSchema).max(RequestPageLimit.Maximum),
    unavailable: z.array(RequestUnavailableSchema).max(RequestPageLimit.Runs),
    next_cursor: z
      .string()
      .max(RequestPageLimit.CursorCharacters)
      .regex(RequestPageFormat.CursorPattern)
      .nullable(),
    has_more: z.boolean(),
  })
  .refine((page) => page.has_more === (page.next_cursor !== null))
  .refine((page) => !page.has_more || page.next_cursor !== page.query.cursor)
  .refine((page) => page.requests.length <= page.query.limit)
  .refine((page) =>
    page.requests.every(
      (item) =>
        (page.query.run_id === undefined || item.request.run_id === page.query.run_id) &&
        (page.query.client_id === undefined ||
          item.request.origin.client_id === page.query.client_id) &&
        (page.query.harness_session_id === undefined ||
          item.request.origin.harness_session_id === page.query.harness_session_id) &&
        (page.query.project_path === undefined || item.project_path === page.query.project_path) &&
        (page.query.state === undefined ||
          (item.request.answer === null ? RequestState.Waiting : RequestState.Answered) ===
            page.query.state),
    ),
  )
  .refine(
    (page) =>
      new Set(
        page.requests.map((item) => JSON.stringify([item.request.run_id, item.request.request_id])),
      ).size === page.requests.length,
  );
export type RequestPage = z.infer<typeof RequestPageSchema>;
export const RequestListRunSchema = z.strictObject({
  project_path: z.string(),
  requests: z.array(OperationRequestSchema),
});
export type RequestListRun = z.infer<typeof RequestListRunSchema>;
export interface RequestPageSource {
  database: CatalogDatabase;
  read(row: StoredCatalog, project?: string): Promise<RequestListRun>;
}
