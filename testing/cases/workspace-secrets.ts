import { WorkspaceSecretFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const scopedWorkspaceCases = {
  positive: [
    positive("a scoped read preserves ordinary bytes", [WorkspaceSecretFixture.Clean, false], true),
    positive("a scoped copy preserves ordinary bytes", [WorkspaceSecretFixture.Clean, true], true),
    positive(
      "scanner tails do not cross source files",
      [WorkspaceSecretFixture.Separate, false],
      true,
    ),
    positive(
      "scanner tails do not cross copied files",
      [WorkspaceSecretFixture.Separate, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "a scoped read refuses an ephemeral credential",
      [WorkspaceSecretFixture.Content, false],
      true,
    ),
    rejected(
      "a scoped copy refuses an ephemeral credential",
      [WorkspaceSecretFixture.Content, true],
      true,
    ),
    rejected(
      "a read detects a credential across chunk boundaries",
      [WorkspaceSecretFixture.Boundary, false],
      true,
    ),
    rejected(
      "a copy detects a credential across chunk boundaries",
      [WorkspaceSecretFixture.Boundary, true],
      true,
    ),
    rejected(
      "a read refuses a credential in a filename",
      [WorkspaceSecretFixture.Filename, false],
      true,
    ),
    rejected(
      "a copy refuses a credential in a filename",
      [WorkspaceSecretFixture.Filename, true],
      true,
    ),
    rejected(
      "a read refuses a credential in a directory name",
      [WorkspaceSecretFixture.Directory, false],
      true,
    ),
    rejected(
      "a copy refuses a credential in a directory name",
      [WorkspaceSecretFixture.Directory, true],
      true,
    ),
  ],
};

export const globalWorkspaceGuardCases = {
  positive: [
    positive("an additional read guard permits ordinary bytes", [false, false], true),
    positive("an additional copy guard permits ordinary bytes", [true, false], true),
  ],
  negative: [
    rejected("an additional read guard cannot replace environment protection", [false, true], true),
    rejected("an additional copy guard cannot replace environment protection", [true, true], true),
  ],
};
