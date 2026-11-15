import { ArtifactRequestFixture, ErrorCode } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

export const artifactRequestCases = {
  positive: [
    positive(
      "ordinary kept result survives escalation and person decision",
      [ArtifactRequestFixture.Escalated],
      true,
    ),
    positive(
      "executable kept result survives escalation and person decision",
      [ArtifactRequestFixture.EscalatedExecutable],
      true,
    ),
    positive(
      "ordinary kept result survives later decision events",
      [ArtifactRequestFixture.Plain],
      true,
    ),
    positive(
      "executable kept result survives later decision events",
      [ArtifactRequestFixture.Executable],
      true,
    ),
  ],
  negative: [
    negative(
      "escalation cannot hide changed delivery state",
      [ArtifactRequestFixture.EscalatedState],
      { code: ErrorCode.ArtifactInvalid },
    ),
    negative(
      "escalation cannot hide changed delivery bytes",
      [ArtifactRequestFixture.EscalatedContent],
      { code: ErrorCode.ArtifactInvalid },
    ),
    negative(
      "current workflow identity must match passed state",
      [ArtifactRequestFixture.CurrentIdentity],
      { code: ErrorCode.ArtifactInvalid },
    ),
    negative(
      "intermediate request cannot rewrite restored delivery state",
      [ArtifactRequestFixture.Intermediate],
      { code: ErrorCode.ArtifactInvalid },
    ),
    negative(
      "missing tail cannot claim latest committed state",
      [ArtifactRequestFixture.MissingTail],
      { code: ErrorCode.ArtifactInvalid },
    ),
    negative("later approval cannot hide changed file bytes", [ArtifactRequestFixture.Content], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("later approval cannot hide changed executable mode", [ArtifactRequestFixture.Mode], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("request event cannot rewrite delivery state", [ArtifactRequestFixture.State], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative(
      "unrelated later event cannot retain delivery commitment",
      [ArtifactRequestFixture.Unrelated],
      { code: ErrorCode.ArtifactInvalid },
    ),
    negative("second passed event cannot replace commitment", [ArtifactRequestFixture.Duplicate], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative(
      "unsupported current state cannot match commitment",
      [ArtifactRequestFixture.Unsupported],
      { code: ErrorCode.ArtifactInvalid },
    ),
  ],
};
