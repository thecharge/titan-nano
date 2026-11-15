import { NativeToolRole } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeToolProcessCases = {
  positive: [
    positive(
      "worker CLI serves real stdio tools without diagnostic stdout",
      [NativeToolRole.Worker, false],
      true,
    ),
    positive(
      "checker CLI serves real stdio tools without diagnostic stdout",
      [NativeToolRole.Checker, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "substituted worker scope exits before stdio readiness",
      [NativeToolRole.Worker, true],
      true,
    ),
    rejected(
      "substituted checker scope exits before stdio readiness",
      [NativeToolRole.Checker, true],
      true,
    ),
  ],
};
