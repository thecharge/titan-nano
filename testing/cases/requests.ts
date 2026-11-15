import { ApprovalLevel, ErrorCode, RequestFixture, RequestKind } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

const denied = { code: ErrorCode.PermissionDenied };
export const operationRequestCases = {
  positive: [
    positive(
      "identical request retry retains pending and answered identity",
      [RequestFixture.IdempotentOpen],
      true,
    ),
    positive("lost response retries the durable request", [RequestFixture.LostOpen], true),
    positive(
      "Ask default requires Auto authority",
      [RequestFixture.Approve, RequestKind.Ask, ApprovalLevel.Auto],
      true,
    ),
    positive(
      "AddStep default requires Auto authority",
      [RequestFixture.Approve, RequestKind.AddStep, ApprovalLevel.Auto],
      true,
    ),
    positive(
      "Replan default requires Main authority",
      [RequestFixture.Approve, RequestKind.Replan, ApprovalLevel.Main],
      true,
    ),
    positive(
      "NewPersona default requires Main authority",
      [RequestFixture.Approve, RequestKind.NewPersona, ApprovalLevel.Main],
      true,
    ),
    positive(
      "ImprovePersona default requires Main authority",
      [RequestFixture.Approve, RequestKind.ImprovePersona, ApprovalLevel.Main],
      true,
    ),
    positive(
      "MergePersonas default requires Main authority",
      [RequestFixture.Approve, RequestKind.MergePersonas, ApprovalLevel.Main],
      true,
    ),
    positive(
      "RetirePersona default requires Main authority",
      [RequestFixture.Approve, RequestKind.RetirePersona, ApprovalLevel.Main],
      true,
    ),
    positive(
      "DeletePersona default requires Human authority",
      [RequestFixture.Approve, RequestKind.DeletePersona, ApprovalLevel.Human],
      true,
    ),
    positive(
      "Tool default requires Main authority",
      [RequestFixture.Approve, RequestKind.Tool, ApprovalLevel.Main],
      true,
    ),
    positive(
      "Skill default requires Main authority",
      [RequestFixture.Approve, RequestKind.Skill, ApprovalLevel.Main],
      true,
    ),
    positive(
      "ToolServer default requires Human authority",
      [RequestFixture.Approve, RequestKind.ToolServer, ApprovalLevel.Human],
      true,
    ),
    positive(
      "Resource default requires Main authority",
      [RequestFixture.Approve, RequestKind.Resource, ApprovalLevel.Main],
      true,
    ),
    positive(
      "Action default requires Human authority",
      [RequestFixture.Approve, RequestKind.Action, ApprovalLevel.Human],
      true,
    ),
    positive(
      "RaiseLimit default requires Human authority",
      [RequestFixture.Approve, RequestKind.RaiseLimit, ApprovalLevel.Human],
      true,
    ),
    positive(
      "PaidCompute default requires Human authority",
      [RequestFixture.Approve, RequestKind.PaidCompute, ApprovalLevel.Human],
      true,
    ),
    positive(
      "LockStatement default requires Human authority",
      [RequestFixture.Approve, RequestKind.LockStatement, ApprovalLevel.Human],
      true,
    ),

    positive("failed answer append permits a valid retry", [RequestFixture.FailedAnswer], true),
    positive("exact operation approval survives journal replay", [RequestFixture.Approve], true),
    positive("explicit denial is durably recorded", [RequestFixture.Deny], true),
    positive("new ledger reads the same decision", [RequestFixture.Reload], true),
    positive("concurrent answers commit exactly one decision", [RequestFixture.Concurrent], true),
    positive(
      "failed append leaves no request and permits retry",
      [RequestFixture.FailedAppend],
      true,
    ),
  ],
  negative: [
    negative("accessor is refused before request parsing", [RequestFixture.AccessorInput], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("accessor cannot authorize a scope", [RequestFixture.AccessorScope], denied),
    negative("oversized input refuses request admission", [RequestFixture.OversizedInput], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("oversized durable request fails replay", [RequestFixture.OversizedRecord], {
      code: ErrorCode.CorruptBoard,
    }),
    negative(
      "repeated request ids in another run need their own decision",
      [RequestFixture.CrossRunId],
      denied,
    ),
    negative("request id cannot be reused for changed scope", [RequestFixture.ChangedOpen], {
      code: ErrorCode.RequestConflict,
    }),
    negative("request id cannot be reused by changed origin", [RequestFixture.ChangedOrigin], {
      code: ErrorCode.RequestConflict,
    }),
    negative("request kind cannot substitute another approval", [RequestFixture.WrongKind], denied),
    negative("queue rejects excess pending admission", [RequestFixture.Queue], {
      code: ErrorCode.Capacity,
    }),
    negative("replay enforces retained request cap", [RequestFixture.ReplayCapacity], {
      code: ErrorCode.Capacity,
    }),
    negative("duplicate request opening is corrupt", [RequestFixture.DuplicateOpen], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("duplicate durable decision is corrupt", [RequestFixture.ChangedDecision], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("invalid request data fails replay", [RequestFixture.InvalidRecord], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("foreign request fails replay", [RequestFixture.ForeignRecord], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("answer requires a prior opening", [RequestFixture.AnswerWithoutOpen], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("replay checks answer authority", [RequestFixture.ReplayAuthority], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("replay checks decision expiry", [RequestFixture.ReplayTime], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("replay checks default approval level", [RequestFixture.ReplayLevel], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("decision cannot rewrite original scope", [RequestFixture.ReplayScope], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("opening cannot contain a decision", [RequestFixture.OpeningAnswered], {
      code: ErrorCode.CorruptBoard,
    }),

    negative("answer cannot cross runs", [RequestFixture.WrongRun], {
      code: ErrorCode.RequestNotFound,
    }),
    negative("answer requires observed request version", [RequestFixture.WrongVersion], {
      code: ErrorCode.RequestConflict,
    }),
    negative("second answer cannot replace first", [RequestFixture.SecondAnswer], {
      code: ErrorCode.RequestConflict,
    }),
    negative("agent cannot answer a human request", [RequestFixture.AgentAnswer], denied),
    negative("expired request cannot receive an answer", [RequestFixture.Expired], {
      code: ErrorCode.RequestExpired,
    }),
    negative("backwards clock cannot predate request", [RequestFixture.BackwardsClock], {
      code: ErrorCode.RequestExpired,
    }),
    negative("changed command cannot reuse approval", [RequestFixture.ChangedCommand], denied),
    negative("changed arguments cannot reuse approval", [RequestFixture.ChangedArguments], denied),
    negative("changed content cannot reuse approval", [RequestFixture.ChangedHash], denied),
    negative(
      "changed environment cannot reuse approval",
      [RequestFixture.ChangedEnvironment],
      denied,
    ),
    negative("changed resource cannot reuse approval", [RequestFixture.ChangedResource], denied),
    negative(
      "identical scope in another run needs approval",
      [RequestFixture.OtherRunApproval],
      denied,
    ),
    negative("denied operation cannot execute", [RequestFixture.DeniedApproval], denied),
    negative("approval expires before use", [RequestFixture.ExpiredApproval], denied),
    negative(
      "future decision cannot authorize present use",
      [RequestFixture.FutureApproval],
      denied,
    ),
    negative("missing request cannot authorize", [RequestFixture.MissingApproval], denied),
    negative("malformed scope cannot authorize", [RequestFixture.InvalidScope], denied),
    negative("unknown request kind is rejected", [RequestFixture.InvalidKind], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("unknown actor authority is rejected", [RequestFixture.InvalidActor], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("empty decision reason is rejected", [RequestFixture.InvalidAnswer], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("expired request never opens", [RequestFixture.ExpiredOpen], {
      code: ErrorCode.RequestExpired,
    }),
    negative("answered requests still consume lifetime allowance", [RequestFixture.Capacity], {
      code: ErrorCode.Capacity,
    }),
    negative("ledger cannot enlarge central ceiling", [RequestFixture.InvalidLimit], {
      name: "ZodError",
    }),
    negative("foreign snapshot cannot supply run requests", [RequestFixture.ForeignSnapshot], {
      code: ErrorCode.CorruptBoard,
    }),
  ],
};

export const engineRequestCases = {
  positive: [
    positive("engine request and approval survive owner reload", [RequestFixture.Approve], true),
    positive("engine denial survives owner reload", [RequestFixture.Deny], true),
  ],
  negative: [
    negative("engine rejects stale request version after reload", [RequestFixture.WrongVersion], {
      code: ErrorCode.RequestConflict,
    }),
    negative("engine rejects main actor on human request", [RequestFixture.AgentAnswer], {
      code: ErrorCode.PermissionDenied,
    }),
    negative("engine requests require a loaded run", [RequestFixture.MissingApproval], {
      code: ErrorCode.RunNotFound,
    }),
  ],
};
