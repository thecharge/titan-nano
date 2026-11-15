import { RequestMcpFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const requestMcpCases = {
  positive: [
    positive(
      "opens a main-level request without waiting for an answer",
      [RequestMcpFixture.OpenTool],
      true,
    ),
    positive(
      "opens a human-level request without granting it",
      [RequestMcpFixture.OpenHuman],
      true,
    ),
    positive("reads the selected request", [RequestMcpFixture.Read], true),
    positive("approves a main-level request", [RequestMcpFixture.Approve], true),
    positive("denies a main-level request", [RequestMcpFixture.Deny], true),
    positive("reconnected MCP answers the durable request", [RequestMcpFixture.Restart], true),
    positive("pending creation retry returns the same request", [RequestMcpFixture.Retry], true),
    positive(
      "answered creation retry retains its decision",
      [RequestMcpFixture.AnsweredRetry],
      true,
    ),
  ],
  negative: [
    rejected("agent credential cannot answer human request", [RequestMcpFixture.HumanAnswer], true),
    rejected("forged authority is refused", [RequestMcpFixture.ForgedAuthority], true),
    rejected("stale version preserves pending request", [RequestMcpFixture.Stale], true),
    rejected("repeated answer preserves first decision", [RequestMcpFixture.Repeated], true),
    rejected("missing reason leaves request pending", [RequestMcpFixture.MissingReason], true),
    rejected("wrong run leaves selected request unchanged", [RequestMcpFixture.WrongRun], true),
    rejected("invalid scope creates no request", [RequestMcpFixture.InvalidScope], true),
    rejected("missing request returns typed failure", [RequestMcpFixture.Missing], true),
  ],
};
