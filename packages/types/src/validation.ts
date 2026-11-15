import { z } from "zod";

export function exactStringList(expected: readonly string[]) {
  return z
    .array(z.string())
    .refine(
      (actual) =>
        actual.length === expected.length &&
        actual.every((entry, index) => entry === expected[index]),
    );
}
