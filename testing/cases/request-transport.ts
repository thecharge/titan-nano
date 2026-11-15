import { HttpStatus, RequestTransportFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const requestTransportCases = {
  positive: [
    positive(
      "person approves escalated scope after server restart",
      [RequestTransportFixture.EscalatedApprove],
      HttpStatus.Ok,
    ),
    positive(
      "person denies escalated scope after server restart",
      [RequestTransportFixture.EscalatedDeny],
      HttpStatus.Ok,
    ),
    positive("agent answers a main request", [RequestTransportFixture.Main], HttpStatus.Ok),
    positive("person answers a human request", [RequestTransportFixture.Human], HttpStatus.Ok),
    positive(
      "denial is durable without granting approval",
      [RequestTransportFixture.Deny],
      HttpStatus.Ok,
    ),
    positive(
      "identical creation retry preserves one request",
      [RequestTransportFixture.Retry],
      HttpStatus.Ok,
    ),
    positive(
      "server restart reloads pending request",
      [RequestTransportFixture.Restart],
      HttpStatus.Ok,
    ),
    positive(
      "concurrent answers commit exactly one decision",
      [RequestTransportFixture.Concurrent],
      HttpStatus.Ok,
    ),
  ],
  negative: [
    rejected(
      "agent cannot answer human request",
      [RequestTransportFixture.AgentHuman],
      HttpStatus.Forbidden,
    ),
    rejected(
      "body cannot grant authority",
      [RequestTransportFixture.Forged],
      HttpStatus.BadRequest,
    ),
    rejected(
      "stale observed version conflicts",
      [RequestTransportFixture.Stale],
      HttpStatus.Conflict,
    ),
    rejected("repeated answer conflicts", [RequestTransportFixture.Repeated], HttpStatus.Conflict),
    rejected(
      "changed retry scope conflicts",
      [RequestTransportFixture.Changed],
      HttpStatus.Conflict,
    ),
    rejected("unknown request is absent", [RequestTransportFixture.Missing], HttpStatus.NotFound),
    rejected(
      "answer cannot target another run",
      [RequestTransportFixture.WrongRun],
      HttpStatus.NotFound,
    ),
    rejected(
      "path and body request must match",
      [RequestTransportFixture.WrongPath],
      HttpStatus.BadRequest,
    ),
    rejected(
      "expired request cannot be answered",
      [RequestTransportFixture.Expired],
      HttpStatus.Conflict,
    ),
    rejected("unexpected selectors fail", [RequestTransportFixture.Query], HttpStatus.BadRequest),
    rejected(
      "unsupported request method fails",
      [RequestTransportFixture.Method],
      HttpStatus.BadRequest,
    ),
    rejected(
      "malformed JSON fails as input",
      [RequestTransportFixture.Malformed],
      HttpStatus.BadRequest,
    ),
    rejected(
      "invalid scope fails admission",
      [RequestTransportFixture.Invalid],
      HttpStatus.BadRequest,
    ),
    rejected(
      "invalid percent encoding fails as input",
      [RequestTransportFixture.Encoding],
      HttpStatus.BadRequest,
    ),
    rejected(
      "missing selected request is absent",
      [RequestTransportFixture.ReadMissing],
      HttpStatus.NotFound,
    ),
  ],
};
