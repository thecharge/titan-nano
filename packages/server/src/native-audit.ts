import {
  FileEncoding,
  HttpMethod,
  IoLimit,
  KnowledgeTool,
  NativeTool,
  NativeToolAudit,
  NativeToolOutcome,
  ServerLimit,
  TextSymbol,
} from "@titan/constants";
import { readBytes } from "@titan/streams";
import {
  KnowledgeDeletionResultSchema,
  KnowledgeEntryResultSchema,
  KnowledgeSearchPageSchema,
  KnowledgeViewDeletionSchema,
  KnowledgeViewEntrySchema,
  KnowledgeViewSearchPageSchema,
  NativeFileListResultSchema,
  NativeFileResultSchema,
  type NativeToolAuditRecord,
  NativeToolCallEnvelopeSchema,
  type NativeToolName,
  NativeToolNameSchema,
  NativeToolReplyEnvelopeSchema,
} from "@titan/types";

export async function nativeCallName(request: Request) {
  const body = request.clone().body;
  if (request.method !== HttpMethod.Post || !body) return undefined;
  const bytes = await readBytes(body, ServerLimit.RequestBytes);
  try {
    const call = NativeToolCallEnvelopeSchema.safeParse(
      JSON.parse(bytes.toString(FileEncoding.Utf8)),
    );
    if (!call.success) return undefined;
    const name = NativeToolNameSchema.safeParse(call.data.params?.name);
    return name.success ? name.data : NativeToolAudit.Unknown;
  } catch {
    return undefined;
  }
}

function entryIds(tool: NativeToolName, value: unknown): string[] {
  if (tool === NativeTool.Ready) return [];
  if (tool === KnowledgeTool.Search) {
    const page = KnowledgeViewSearchPageSchema.or(KnowledgeSearchPageSchema).parse(value);
    return page.results.map((entry) => entry.id);
  }
  if (tool === KnowledgeTool.Delete) {
    const deleted = KnowledgeViewDeletionSchema.or(KnowledgeDeletionResultSchema).parse(value);
    return [deleted.id];
  }
  return [KnowledgeViewEntrySchema.or(KnowledgeEntryResultSchema).parse(value).entry.id];
}

export async function nativeCallRecord(
  tool: NativeToolName,
  response: Response,
): Promise<NativeToolAuditRecord> {
  const refused = { tool, outcome: NativeToolOutcome.Refused, entry_ids: [] };
  const body = response.clone().body;
  if (!response.ok || !body) return refused;
  const bytes = await readBytes(body, IoLimit.ResponseBytes);
  const reply = NativeToolReplyEnvelopeSchema.safeParse(
    JSON.parse(bytes.toString(FileEncoding.Utf8)),
  );
  if (!reply.success || reply.data.result.isError) return refused;
  const value: unknown = JSON.parse(reply.data.result.content[0]?.text ?? TextSymbol.Empty);
  if (tool === NativeTool.ReadFile)
    return {
      tool,
      outcome: NativeToolOutcome.Returned,
      entry_ids: [],
      observation: NativeFileResultSchema.parse(value).observation,
    };
  if (tool === NativeTool.ListFiles)
    return {
      tool,
      outcome: NativeToolOutcome.Returned,
      entry_ids: [],
      observation: NativeFileListResultSchema.parse(value).observation,
    };
  return { tool, outcome: NativeToolOutcome.Returned, entry_ids: entryIds(tool, value) };
}
