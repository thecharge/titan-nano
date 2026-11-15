import { positive, rejected } from "@titan/test-factories";
import { UnitSuiteSchema } from "@titan/types";

export function acceptsCaseCounts(positiveCount: number, negativeCount: number): boolean {
  return UnitSuiteSchema.safeParse({
    positive: Array.from({ length: positiveCount }, (_, index) =>
      positive(String(index), [], null),
    ),
    negative: Array.from({ length: negativeCount }, (_, index) =>
      rejected(String(index), [], null),
    ),
  }).success;
}
