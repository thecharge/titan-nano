import { Backend, NativeBindingFixture } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const nativeEnvironmentBudgetCases = {
  positive: [
    positive("native helpers retain minimum managed thread budgets", [1, 2, true], true),
    positive("native helpers retain maximum managed thread budgets", [16, 16, true], true),
  ],
  negative: [
    rejected("native helpers refuse an unbounded GC setting", [0, 2, false], true),
    rejected("native helpers refuse an excessive worker pool", [1, 17, false], true),
  ],
};

export const nativeBindingContractCases = {
  positive: [
    positive("strict execution binding is admitted", [NativeBindingFixture.Valid], true),
    positive("ordinary backend use has no binding", [NativeBindingFixture.Omitted], null),
  ],
  negative: [
    negative("another run cannot own the binding", [NativeBindingFixture.Run], {
      code: "permission_denied",
    }),
    negative("another execution cannot own the binding", [NativeBindingFixture.Execution], {
      code: "permission_denied",
    }),
    negative("relative native executable is refused", [NativeBindingFixture.Launch], {
      code: "permission_denied",
    }),
    negative("credential cannot enter launch arguments", [NativeBindingFixture.Credential], {
      code: "permission_denied",
    }),
  ],
};
export const nativeBindingEnvironmentCases = {
  positive: [
    positive("Codex binding receives centrally composed environment", [Backend.Codex, true], true),
    positive(
      "Claude binding receives centrally composed environment",
      [Backend.Claude, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "Codex binding without an environment factory fails closed",
      [Backend.Codex, false],
      true,
    ),
    rejected(
      "Claude binding without an environment factory fails closed",
      [Backend.Claude, false],
      true,
    ),
    rejected(
      "injected Codex client cannot silently omit native setup",
      [Backend.Codex, true, true],
      true,
    ),
  ],
};
