import { NativeToolResponseFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeToolResponseCases = {
  positive: [
    positive(
      "JSON body and headers survive bounded collection",
      [NativeToolResponseFixture.Json, false],
      true,
    ),
    positive(
      "an empty response keeps its status and empty body",
      [NativeToolResponseFixture.Empty, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "an oversized owner body stops before SDK parsing",
      [NativeToolResponseFixture.Oversized, false],
      true,
    ),
    rejected(
      "a stalled body cannot outlive its deadline",
      [NativeToolResponseFixture.Slow, false],
      true,
    ),
    rejected(
      "a redirect cannot forward the credential",
      [NativeToolResponseFixture.Redirect, false],
      true,
    ),
    rejected("caller cancellation stops fetching", [NativeToolResponseFixture.Json, true], true),
  ],
};

export const nativeStdioOutputCases = {
  positive: [
    positive("escaped characters retain valid MCP framing", [false, false], true),
    positive("UTF-8 output retains valid MCP framing", [true, false], true),
  ],
  negative: [
    rejected("JSON escaping cannot exceed the output budget", [false, true], true),
    rejected("UTF-8 cannot exceed the output budget", [true, true], true),
  ],
};
