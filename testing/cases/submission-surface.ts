import { ServerLimit, SubmissionSurface } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const submissionSurfaceCases = {
  positive: [
    positive("CLI retains opaque caller session", [SubmissionSurface.Cli, "cli/α:42", true], true),
    positive(
      "CLI accepts a maximum caller session",
      [SubmissionSurface.Cli, "c".repeat(ServerLimit.IdentityCharacters), true],
      true,
    ),
    positive("MCP retains opaque caller session", [SubmissionSurface.Mcp, "mcp/β:42", true], true),
    positive(
      "MCP accepts a maximum caller session",
      [SubmissionSurface.Mcp, "m".repeat(ServerLimit.IdentityCharacters), true],
      true,
    ),
    positive(
      "HTTP retains opaque caller session",
      [SubmissionSurface.Http, "http/γ:42", true],
      true,
    ),
    positive(
      "HTTP accepts a maximum caller session",
      [SubmissionSurface.Http, "h".repeat(ServerLimit.IdentityCharacters), true],
      true,
    ),
  ],
  negative: [
    rejected("CLI refuses empty caller session", [SubmissionSurface.Cli, "", false], true),
    rejected(
      "CLI refuses excessive caller session",
      [SubmissionSurface.Cli, "c".repeat(ServerLimit.IdentityCharacters + 1), false],
      true,
    ),
    rejected("MCP refuses empty caller session", [SubmissionSurface.Mcp, "", false], true),
    rejected(
      "MCP refuses excessive caller session",
      [SubmissionSurface.Mcp, "m".repeat(ServerLimit.IdentityCharacters + 1), false],
      true,
    ),
    rejected("HTTP refuses empty caller session", [SubmissionSurface.Http, "", false], true),
    rejected(
      "HTTP refuses excessive caller session",
      [SubmissionSurface.Http, "h".repeat(ServerLimit.IdentityCharacters + 1), false],
      true,
    ),
  ],
};
