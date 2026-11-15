import { ErrorCode, RequestClientFixture } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

export const requestClientCases = {
  positive: [
    positive(
      "escalated record retains its audit at the client",
      [RequestClientFixture.EscalatedRead],
      true,
    ),
    positive(
      "person response advances the escalated observed version",
      [RequestClientFixture.EscalatedAnswer],
      true,
    ),
    positive("read response binds selected identity", [RequestClientFixture.Read], true),
    positive(
      "creation retry can return an already answered record",
      [RequestClientFixture.Open],
      true,
    ),
    positive("agent answer validates its actor", [RequestClientFixture.Main], true),
    positive(
      "person answer explicitly uses private credential",
      [RequestClientFixture.Human],
      true,
    ),
  ],
  negative: [
    negative("changed answer reason is a transport failure", [RequestClientFixture.WrongReason], {
      code: ErrorCode.InvalidResponse,
    }),
    negative(
      "pending answer response is a transport failure",
      [RequestClientFixture.StaleResponse],
      { code: ErrorCode.InvalidResponse },
    ),
    negative("response must advance observed version", [RequestClientFixture.ObservedVersion], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("malformed record is a transport failure", [RequestClientFixture.Malformed], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("substituted run is a transport failure", [RequestClientFixture.WrongRun], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("substituted request is a transport failure", [RequestClientFixture.WrongRequest], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("changed creation scope is a transport failure", [RequestClientFixture.ChangedScope], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("changed answer is a transport failure", [RequestClientFixture.WrongDecision], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("changed answering client is a transport failure", [RequestClientFixture.WrongActor], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("changed authority is a transport failure", [RequestClientFixture.WrongAuthority], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("invalid answer version is a transport failure", [RequestClientFixture.WrongVersion], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("invalid creation opens no transport", [RequestClientFixture.InvalidOpen], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("invalid answer opens no transport", [RequestClientFixture.InvalidAnswer], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("invalid authority opens no transport", [RequestClientFixture.InvalidAuthority], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("oversized input opens no transport", [RequestClientFixture.Oversized], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("accessor input opens no transport", [RequestClientFixture.Accessor], {
      code: ErrorCode.InvalidRequest,
    }),
  ],
};
