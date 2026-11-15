import { Backend, NativeToolTransport } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeWorkflowCases = {
  positive: [
    positive(
      "Codex workflow uses the automatic stdio helper",
      [Backend.Codex, true, NativeToolTransport.Stdio],
      true,
    ),
    positive(
      "Claude workflow uses the automatic stdio helper",
      [Backend.Claude, true, NativeToolTransport.Stdio],
      true,
    ),
    positive(
      "Codex worker and checker use automatic native tools before publication",
      [Backend.Codex, true, NativeToolTransport.Http],
      true,
    ),
    positive(
      "Claude worker and checker use automatic native tools before publication",
      [Backend.Claude, true, NativeToolTransport.Http],
      true,
    ),
  ],
  negative: [
    rejected(
      "Codex stdio workflow refuses a missing native entry",
      [Backend.Codex, false, NativeToolTransport.Stdio],
      true,
    ),
    rejected(
      "Claude stdio workflow refuses a missing native entry",
      [Backend.Claude, false, NativeToolTransport.Stdio],
      true,
    ),
    rejected(
      "Codex cannot invent the required native search result",
      [Backend.Codex, false, NativeToolTransport.Http],
      true,
    ),
    rejected(
      "Claude cannot invent the required native search result",
      [Backend.Claude, false, NativeToolTransport.Http],
      true,
    ),
  ],
};

export const nativeProjectWorkflowCases = {
  positive: [
    positive("Codex native tools read project knowledge", [Backend.Codex, true], true),
    positive("Claude native tools read project knowledge", [Backend.Claude, true], true),
  ],
  negative: [
    rejected("Codex native tools cannot read another project", [Backend.Codex, false], true),
    rejected("Claude native tools cannot read another project", [Backend.Claude, false], true),
  ],
};
