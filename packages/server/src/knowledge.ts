import { ErrorCode, HttpMethod, KnowledgeCommand, KnowledgeServerCommand } from "@titan/constants";
import { TitanError } from "@titan/errors";
import type { KnowledgeHub } from "@titan/knowledge";
import { KnowledgeMessage, ServerMessage } from "@titan/messages";
import { KnowledgeServerCallSchema } from "@titan/types";

export async function knowledgeResponse(hub: KnowledgeHub, request: Request, url: URL) {
  if (request.method !== HttpMethod.Post)
    throw new TitanError(ErrorCode.Method, ServerMessage.Method);
  if (url.searchParams.size)
    throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
  }
  const parsed = KnowledgeServerCallSchema.safeParse(body);
  if (!parsed.success) throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
  const call = parsed.data;
  if (call.operation === KnowledgeCommand.Add) return Response.json(await hub.add(call.input));
  if (call.operation === KnowledgeCommand.Get) return Response.json(await hub.get(call.input.id));
  if (call.operation === KnowledgeCommand.Update)
    return Response.json(await hub.update(call.input));
  if (call.operation === KnowledgeCommand.Delete)
    return Response.json(await hub.delete(call.input));
  if (call.operation === KnowledgeCommand.Search)
    return Response.json(await hub.search(call.input));
  if (call.operation === KnowledgeServerCommand.History)
    return Response.json(await hub.history(call.input));
  if (call.operation === KnowledgeCommand.Stats) return Response.json(await hub.stats());
  if (call.operation === KnowledgeCommand.Prune || call.operation === KnowledgeCommand.Consolidate)
    return Response.json(await hub.maintenance(call.operation, call.input));
  if (call.operation === KnowledgeCommand.Restore)
    return Response.json(await hub.restore(call.input.id));
  return Response.json(await hub.reindex());
}
