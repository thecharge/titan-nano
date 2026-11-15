import {
  ApprovalLevel,
  ErrorCode,
  HttpMethod,
  RequestKind,
  RequestOperation,
  RequestRoute,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { RequestMessage } from "@titan/messages";
import {
  type ClientAuthority,
  RequestAnswerSubmissionSchema,
  RequestEscalationSubmissionSchema,
  type RequestRouteSelection,
  RequestRouteSelectionSchema,
  type RequestService,
} from "@titan/types";

function identifier(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
  }
}

async function body(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
  }
}

export async function selectRequest(
  request: Request,
  url: URL,
): Promise<RequestRouteSelection | null> {
  const run = RequestRoute.Run.exec(url.pathname);
  const answer = RequestRoute.Answer.exec(url.pathname);
  const escalation = RequestRoute.Escalate.exec(url.pathname);
  if (!run && !answer && !escalation) return null;
  if (url.searchParams.size) throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
  let selection: unknown;
  if (escalation?.[1] && request.method === HttpMethod.Post) {
    const parsed = RequestEscalationSubmissionSchema.safeParse(await body(request));
    if (!parsed.success || parsed.data.request_id !== identifier(escalation[1]))
      throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
    selection = {
      operation: RequestOperation.Escalate,
      run_id: parsed.data.run_id,
      input: parsed.data,
    };
  } else if (answer?.[1] && request.method === HttpMethod.Post) {
    const parsed = RequestAnswerSubmissionSchema.safeParse(await body(request));
    if (!parsed.success || parsed.data.request_id !== identifier(answer[1]))
      throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
    selection = {
      operation: RequestOperation.Answer,
      run_id: parsed.data.run_id,
      input: parsed.data,
    };
  } else if (run?.[1] && !run[2] && request.method === HttpMethod.Post) {
    selection = {
      operation: RequestOperation.Open,
      run_id: identifier(run[1]),
      input: await body(request),
    };
  } else if (run?.[1] && run[2] && request.method === HttpMethod.Get) {
    selection = {
      operation: RequestOperation.Read,
      run_id: identifier(run[1]),
      request_id: identifier(run[2]),
    };
  } else throw new TitanError(ErrorCode.Method, RequestMessage.Invalid);
  const parsed = RequestRouteSelectionSchema.safeParse(selection);
  if (!parsed.success) throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
  return parsed.data;
}

export async function operateRequest(
  service: RequestService,
  selection: RequestRouteSelection,
  authority: ClientAuthority,
) {
  if (selection.operation === RequestOperation.Open) {
    const opened = await service.open(selection.run_id, selection.input);
    if (
      opened.kind === RequestKind.AddStep &&
      opened.level === ApprovalLevel.Auto &&
      opened.answer === null
    )
      return service.decideWithinLimits(opened.run_id, opened.request_id);
    return opened;
  }
  if (selection.operation === RequestOperation.Read) {
    const found = (await service.list(selection.run_id)).find(
      (entry) => entry.request_id === selection.request_id,
    );
    if (!found) throw new TitanError(ErrorCode.RequestNotFound, RequestMessage.Missing);
    return found;
  }
  if (selection.operation === RequestOperation.Escalate) {
    const { client_id, ...input } = selection.input;
    return service.escalate(input, { client_id, authority });
  }
  const { client_id, ...input } = selection.input;
  return service.answer(input, { client_id, authority });
}
