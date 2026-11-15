import { NativeToolOutputFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeStdioLifecycleCases = {
  positive: [
    positive("an immediately accepted frame completes", [NativeToolOutputFixture.Immediate], true),
    positive(
      "a frame under backpressure completes after its write callback",
      [NativeToolOutputFixture.Backpressure],
      true,
    ),
  ],
  negative: [
    rejected(
      "a synchronous write failure has a generic diagnostic",
      [NativeToolOutputFixture.Throw],
      true,
    ),
    rejected("a closed transport refuses another send", [NativeToolOutputFixture.Closed], true),
    rejected(
      "a write failure returns only the generic diagnostic",
      [NativeToolOutputFixture.Error],
      true,
    ),
    rejected(
      "a closed output cannot retain a pending write",
      [NativeToolOutputFixture.Close],
      true,
    ),
    rejected(
      "a stalled output cannot exceed its deadline",
      [NativeToolOutputFixture.Stalled],
      true,
    ),
    rejected(
      "closing the transport rejects a pending write",
      [NativeToolOutputFixture.Cancelled],
      true,
    ),
    rejected("an ended output cannot accept another frame", [NativeToolOutputFixture.Ended], true),
  ],
};
