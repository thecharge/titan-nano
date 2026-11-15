import { ProcessScopeMode, TestProcessFixture, TestProcessLimit } from "@titan/constants";
import { testProcessActionFailure } from "@titan/messages";
import { negative, positive, rejected } from "@titan/test-factories";

export const processScopeCases = {
  positive: [
    positive("completed child returns its result", [ProcessScopeMode.Complete, 1000, 0], true),
    positive(
      "delayed child clears the longest permitted timer",
      [ProcessScopeMode.Complete, TestProcessLimit.MaximumMilliseconds, 5],
      true,
    ),
  ],
  negative: [
    negative(
      "excessive deadline is refused after cleaning up its child",
      [
        ProcessScopeMode.Deadline,
        TestProcessLimit.MaximumMilliseconds + 1,
        TestProcessFixture.HeldMilliseconds,
      ],
      { name: "ZodError" },
    ),
    negative(
      "fractional deadline is refused after cleaning up its child",
      [ProcessScopeMode.Deadline, 1.5, TestProcessFixture.HeldMilliseconds],
      { name: "ZodError" },
    ),
    rejected(
      "short deadline stops and drains an actual child",
      [ProcessScopeMode.Deadline, 10, TestProcessFixture.HeldMilliseconds],
      false,
    ),
    rejected(
      "another deadline stops and drains an actual child",
      [ProcessScopeMode.Deadline, 20, TestProcessFixture.HeldMilliseconds],
      false,
    ),
    negative(
      "action failure stops its held child",
      [ProcessScopeMode.Throw, 1000, TestProcessFixture.HeldMilliseconds],
      { message: testProcessActionFailure },
    ),
    negative(
      "action failure with a long budget still stops its child",
      [
        ProcessScopeMode.Throw,
        TestProcessLimit.MaximumMilliseconds,
        TestProcessFixture.HeldMilliseconds,
      ],
      { message: testProcessActionFailure },
    ),
    negative(
      "zero deadline is refused after cleaning up its child",
      [ProcessScopeMode.Deadline, 0, TestProcessFixture.HeldMilliseconds],
      { name: "ZodError" },
    ),
    negative(
      "negative deadline is refused after cleaning up its child",
      [ProcessScopeMode.Deadline, -1, TestProcessFixture.HeldMilliseconds],
      { name: "ZodError" },
    ),
  ],
};
