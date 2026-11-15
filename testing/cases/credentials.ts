import { CredentialFixture, ErrorCode, HttpStatus } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const invalid = { code: ErrorCode.PermissionDenied };
export const credentialCases = {
  positive: [
    positive(
      "fresh private credentials accept the agent",
      [CredentialFixture.Fresh],
      HttpStatus.Ok,
    ),
    positive(
      "person credential authenticates without entering server address",
      [CredentialFixture.Human],
      HttpStatus.Ok,
    ),
    positive(
      "restart preserves person token and rotates agent token",
      [CredentialFixture.Reuse],
      HttpStatus.Ok,
    ),
  ],
  negative: [
    rejected(
      "agent token from a web page is forbidden",
      [CredentialFixture.OriginAgent],
      HttpStatus.Forbidden,
    ),
    rejected(
      "person token from a web page is forbidden",
      [CredentialFixture.OriginHuman],
      HttpStatus.Forbidden,
    ),
    rejected("missing token is unauthorized", [CredentialFixture.NoToken], HttpStatus.Unauthorized),
    rejected(
      "unrelated token is unauthorized",
      [CredentialFixture.InvalidToken],
      HttpStatus.Unauthorized,
    ),
    negative("symbolic link token cannot start a server", [CredentialFixture.Linked], invalid),
    negative("hard linked token cannot start a server", [CredentialFixture.HardLink], invalid),
    negative(
      "shared token permissions cannot start a server",
      [CredentialFixture.BroadMode],
      invalid,
    ),
    negative("invalid token bytes cannot start a server", [CredentialFixture.InvalidFile], invalid),
    negative("oversized token file cannot start a server", [CredentialFixture.LargeFile], invalid),
    negative("token newline cannot bypass exact length", [CredentialFixture.LineEnding], invalid),
    negative("token directory cannot start a server", [CredentialFixture.Directory], invalid),
  ],
};
