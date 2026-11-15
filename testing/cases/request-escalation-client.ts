import { ErrorCode, RequestEscalationClientFixture as Fixture } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

export const requestEscalationClientCases = {
  positive: [
    positive("client binds escalation reason and main actor", [Fixture.Main], true),
    positive("client preserves a different explicit reason", [Fixture.Retry], true),
  ],
  negative: [
    negative("escalation client refuses Reason", [Fixture.Reason], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("escalation client refuses Actor", [Fixture.Actor], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("escalation client refuses Authority", [Fixture.Authority], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("escalation client refuses Version", [Fixture.Version], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("escalation client refuses Answered", [Fixture.Answered], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("escalation client refuses MissingAudit", [Fixture.MissingAudit], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("escalation client refuses Invalid", [Fixture.Invalid], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("escalation client refuses Accessor", [Fixture.Accessor], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("escalation client refuses Oversized", [Fixture.Oversized], {
      code: ErrorCode.InvalidRequest,
    }),
  ],
};
