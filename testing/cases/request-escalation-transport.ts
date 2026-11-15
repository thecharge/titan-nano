import {
  ErrorCode,
  RequestEscalationTransportFixture as Fixture,
  RequestEscalationSurface as Surface,
} from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

export const requestEscalationTransportCases = {
  positive: [
    positive(
      "same-process MCP passes scope for approval",
      [Surface.Mcp, Fixture.Approve, true],
      true,
    ),
    positive("same-process MCP passes scope for denial", [Surface.Mcp, Fixture.Deny, true], true),
    positive("Http passes scope to person for Approve", [Surface.Http, Fixture.Approve], true),
    positive("Http passes scope to person for Deny", [Surface.Http, Fixture.Deny], true),
    positive("Cli passes scope to person for Approve", [Surface.Cli, Fixture.Approve], true),
    positive("Cli passes scope to person for Deny", [Surface.Cli, Fixture.Deny], true),
    positive("Mcp passes scope to person for Approve", [Surface.Mcp, Fixture.Approve], true),
    positive("Mcp passes scope to person for Deny", [Surface.Mcp, Fixture.Deny], true),
  ],
  negative: [
    negative("same-process MCP refuses a stale version", [Surface.Mcp, Fixture.Stale, true], {
      code: ErrorCode.RequestConflict,
    }),
    negative(
      "same-process MCP refuses repeated escalation",
      [Surface.Mcp, Fixture.Repeated, true],
      { code: ErrorCode.RequestConflict },
    ),
    negative("Http refuses Stale", [Surface.Http, Fixture.Stale], {
      code: ErrorCode.RequestConflict,
    }),
    negative("Http refuses Repeated", [Surface.Http, Fixture.Repeated], {
      code: ErrorCode.RequestConflict,
    }),
    negative("Http refuses Human", [Surface.Http, Fixture.Human], {
      code: ErrorCode.PermissionDenied,
    }),
    negative("Http refuses Answered", [Surface.Http, Fixture.Answered], {
      code: ErrorCode.RequestConflict,
    }),
    negative("Http refuses MissingReason", [Surface.Http, Fixture.MissingReason], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("Http refuses MissingVersion", [Surface.Http, Fixture.MissingVersion], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("Http refuses WrongRun", [Surface.Http, Fixture.WrongRun], {
      code: ErrorCode.RunNotFound,
    }),
    negative("Cli refuses Stale", [Surface.Cli, Fixture.Stale], {
      code: ErrorCode.RequestConflict,
    }),
    negative("Cli refuses Repeated", [Surface.Cli, Fixture.Repeated], {
      code: ErrorCode.RequestConflict,
    }),
    negative("Cli refuses Human", [Surface.Cli, Fixture.Human], {
      code: ErrorCode.PermissionDenied,
    }),
    negative("Cli refuses Answered", [Surface.Cli, Fixture.Answered], {
      code: ErrorCode.RequestConflict,
    }),
    negative("Cli refuses MissingReason", [Surface.Cli, Fixture.MissingReason], {
      code: ErrorCode.Arguments,
    }),
    negative("Cli refuses MissingVersion", [Surface.Cli, Fixture.MissingVersion], {
      code: ErrorCode.Arguments,
    }),
    negative("Cli refuses WrongRun", [Surface.Cli, Fixture.WrongRun], {
      code: ErrorCode.RunNotFound,
    }),
    negative("Mcp refuses Stale", [Surface.Mcp, Fixture.Stale], {
      code: ErrorCode.RequestConflict,
    }),
    negative("Mcp refuses Repeated", [Surface.Mcp, Fixture.Repeated], {
      code: ErrorCode.RequestConflict,
    }),
    negative("Mcp refuses Human", [Surface.Mcp, Fixture.Human], {
      code: ErrorCode.PermissionDenied,
    }),
    negative("Mcp refuses Answered", [Surface.Mcp, Fixture.Answered], {
      code: ErrorCode.RequestConflict,
    }),
    negative("Mcp refuses MissingReason", [Surface.Mcp, Fixture.MissingReason], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("Mcp refuses MissingVersion", [Surface.Mcp, Fixture.MissingVersion], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("Mcp refuses WrongRun", [Surface.Mcp, Fixture.WrongRun], {
      code: ErrorCode.RunNotFound,
    }),
    negative("Http refuses Authority", [Surface.Http, Fixture.Authority], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("Http refuses WrongPath", [Surface.Http, Fixture.WrongPath], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("Http refuses Method", [Surface.Http, Fixture.Method], { code: ErrorCode.Method }),
    negative("Http refuses Query", [Surface.Http, Fixture.Query], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("Mcp refuses Authority", [Surface.Mcp, Fixture.Authority], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("Cli refuses Decision", [Surface.Cli, Fixture.Decision], {
      code: ErrorCode.Arguments,
    }),
    negative("Cli refuses MissingDecision", [Surface.Cli, Fixture.MissingDecision], {
      code: ErrorCode.Arguments,
    }),
  ],
};
