import { SubmissionMutation, WorkflowSourceFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const serverSubmissionCases = {
  positive: [
    positive(
      "caller session retains opaque Unicode through replay",
      [false, SubmissionMutation.None, false, false, "caller/α:42"],
      true,
    ),
    positive(
      "caller session survives discarded receipt and restart",
      [true, SubmissionMutation.None, false, true, "caller/β:99"],
      true,
    ),
    positive("submission replay retains one inspected run", [false, SubmissionMutation.None], true),
    positive(
      "submission replay loads its run after owner restart",
      [true, SubmissionMutation.None],
      true,
    ),
    positive(
      "empty workflow path retains its exact retry identity",
      [false, SubmissionMutation.None, true],
      true,
    ),
    positive(
      "empty workflow path retains identity after restart",
      [true, SubmissionMutation.None, true],
      true,
    ),
    positive(
      "discarded response retries the original run",
      [false, SubmissionMutation.None, false, true],
      true,
    ),
    positive(
      "completed discarded response survives owner restart before retry",
      [true, SubmissionMutation.None, false, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "caller session cannot change under a retained identity",
      [false, SubmissionMutation.Session, false, false, "caller-one"],
      true,
    ),
    rejected(
      "restart cannot replace caller session",
      [true, SubmissionMutation.Session, false, false, "caller-two"],
      true,
    ),
    rejected(
      "legacy identity cannot acquire caller metadata",
      [false, SubmissionMutation.Session],
      true,
    ),
    rejected(
      "restarted legacy identity cannot acquire caller metadata",
      [true, SubmissionMutation.Session],
      true,
    ),
    rejected(
      "changed goal cannot reuse submission identity",
      [false, SubmissionMutation.Goal],
      true,
    ),
    rejected(
      "changed goal after restart leaves the original journal unchanged",
      [true, SubmissionMutation.Goal],
      true,
    ),
    rejected(
      "absent path cannot replace an explicitly empty path",
      [false, SubmissionMutation.Path, true],
      true,
    ),
    rejected(
      "restart preserves the empty versus absent path distinction",
      [true, SubmissionMutation.Path, true],
      true,
    ),
  ],
};

export const workflowSourceSubmissionCases = {
  positive: [
    positive(
      "YAML comments and CRLF bytes survive admission and replay",
      [WorkflowSourceFixture.Yaml],
      true,
    ),
    positive(
      "JSON source outside the project survives exact retries",
      [WorkflowSourceFixture.Json],
      true,
    ),
  ],
  negative: [
    rejected("missing source leaves no reserved submission", [WorkflowSourceFixture.Missing], true),
    rejected(
      "changed source plan leaves no reserved submission",
      [WorkflowSourceFixture.Mismatch],
      true,
    ),
    rejected(
      "relative source path cannot read the owner working directory",
      [WorkflowSourceFixture.Relative],
      true,
    ),
    rejected(
      "oversized source is refused before admission",
      [WorkflowSourceFixture.TooLarge],
      true,
    ),
    rejected(
      "changed source comments cannot reuse a submission identity",
      [WorkflowSourceFixture.Changed],
      true,
    ),
  ],
};
