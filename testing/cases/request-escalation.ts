import { ErrorCode, RequestEscalationFixture } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const requestEscalationCases = {
  positive: [
    positive(
      "person approval follows a durable escalation",
      [RequestEscalationFixture.Approve],
      true,
    ),
    positive(
      "person denial preserves audit and refuses use",
      [RequestEscalationFixture.Deny],
      true,
    ),
    positive("pending escalation survives owner reload", [RequestEscalationFixture.Reload], true),
    positive("lost escalation response retains one event", [RequestEscalationFixture.Lost], true),
    positive(
      "escalation wins before a simultaneous main answer",
      [RequestEscalationFixture.ConcurrentEscalate],
      true,
    ),
    positive(
      "main answer wins before a simultaneous escalation",
      [RequestEscalationFixture.ConcurrentAnswer],
      true,
    ),
  ],
  negative: [
    negative(
      "person answer must fit the escalated complete record",
      [RequestEscalationFixture.RecordAnswerBytes],
      { code: ErrorCode.InvalidRequest },
    ),
    negative(
      "backward clock after escalation cannot append an answer",
      [RequestEscalationFixture.ClockAnswer],
      { code: ErrorCode.RequestExpired },
    ),
    rejected(
      "failed append leaves a valid escalation retry",
      [RequestEscalationFixture.Failed],
      true,
    ),
    negative("human request cannot pass up again", [RequestEscalationFixture.Human], {
      code: ErrorCode.PermissionDenied,
    }),
    negative("automatic request cannot pass up", [RequestEscalationFixture.Auto], {
      code: ErrorCode.PermissionDenied,
    }),
    negative("stale observed version is refused", [RequestEscalationFixture.Stale], {
      code: ErrorCode.RequestConflict,
    }),
    negative("repeated escalation is refused", [RequestEscalationFixture.Repeated], {
      code: ErrorCode.RequestConflict,
    }),
    negative("answered request cannot escalate", [RequestEscalationFixture.Answered], {
      code: ErrorCode.RequestConflict,
    }),
    negative("expired request cannot escalate", [RequestEscalationFixture.Expired], {
      code: ErrorCode.RequestExpired,
    }),
    negative("backward clock cannot escalate", [RequestEscalationFixture.Clock], {
      code: ErrorCode.RequestExpired,
    }),
    negative("absent request is refused", [RequestEscalationFixture.Missing], {
      code: ErrorCode.RequestNotFound,
    }),
    negative("wrong run cannot borrow a request", [RequestEscalationFixture.WrongRun], {
      code: ErrorCode.RequestNotFound,
    }),
    negative("automatic actor cannot escalate", [RequestEscalationFixture.AutoActor], {
      code: ErrorCode.PermissionDenied,
    }),
    negative("missing reason is refused", [RequestEscalationFixture.Invalid], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("input getter is refused without evaluation", [RequestEscalationFixture.Accessor], {
      code: ErrorCode.InvalidRequest,
    }),
    negative(
      "excessive input bytes leave the request unchanged",
      [RequestEscalationFixture.InputBytes],
      { code: ErrorCode.InvalidRequest },
    ),
    negative(
      "complete escalation must fit record allowance",
      [RequestEscalationFixture.RecordBytes],
      { code: ErrorCode.InvalidRequest },
    ),
    negative("replay rejects changed escalation scope", [RequestEscalationFixture.ChangedScope], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("replay rejects changed escalation origin", [RequestEscalationFixture.ChangedOrigin], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("replay rejects changed creation time", [RequestEscalationFixture.ChangedCreated], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("replay requires escalation audit", [RequestEscalationFixture.MissingAudit], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("replay refuses automatic audit actor", [RequestEscalationFixture.AutoAudit], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("answer cannot alter the escalation audit", [RequestEscalationFixture.ChangedAudit], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("answer cannot precede escalation time", [RequestEscalationFixture.AnswerTime], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("duplicate escalation event is corrupt", [RequestEscalationFixture.Duplicate], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("opening cannot forge escalation metadata", [RequestEscalationFixture.Opening], {
      code: ErrorCode.CorruptBoard,
    }),
  ],
};
