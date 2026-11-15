import {
  ApprovalLevel,
  AutomaticDecisionFixture,
  BoardDecision,
  BoardParty,
  ErrorCode,
} from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

const line = `1 ${BoardDecision.Kind} ${BoardParty.Titan} ${BoardDecision.WithinLimits} ${ApprovalLevel.Auto}`;

export const automaticDecisionCases = {
  positive: [
    positive(
      "add_step request inside the limits leaves one titan decision line with its rule",
      [AutomaticDecisionFixture.WithinLimits],
      line,
    ),
    positive(
      "add_step request opened through the server is decided and leaves the same line",
      [AutomaticDecisionFixture.Route],
      line,
    ),
  ],
  negative: [
    negative(
      "add_step request beyond the step limit leaves no decision line",
      [AutomaticDecisionFixture.OutsideLimits],
      { code: ErrorCode.PermissionDenied },
    ),
    negative(
      "request of another kind is never decided by titan alone",
      [AutomaticDecisionFixture.WrongKind],
      { code: ErrorCode.PermissionDenied },
    ),
    negative("unknown request leaves no decision line", [AutomaticDecisionFixture.Missing], {
      code: ErrorCode.RequestNotFound,
    }),
    negative("decided request is not decided a second time", [AutomaticDecisionFixture.Repeated], {
      code: ErrorCode.PermissionDenied,
    }),
  ],
};
