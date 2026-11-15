import { describe, expect, test } from "bun:test";
import { CaseMode, CasePolarity, TestLabel, TestSchedule } from "@titan/constants";
import { thrownBy } from "@titan/test-framework";
import {
  type NegativeCase,
  type PositiveCase,
  TestScheduleSchema,
  type TestSubject,
  type UnitCase,
  type UnitSuite,
  UnitSuiteSchema,
} from "@titan/types";

export {
  agentSpec,
  observeVendorContinuation,
  observeVendorIdentity,
  observeVendorIsolation,
  observeVendorSession,
  observeVendorSessionBytes,
} from "./vendor.ts";

export function positive(name: string, args: readonly unknown[], expected: unknown): PositiveCase {
  return {
    name,
    args: [...args],
    expected,
    polarity: CasePolarity.Positive,
    mode: CaseMode.Returns,
  };
}

export function negative(name: string, args: readonly unknown[], expected: object): NegativeCase {
  return {
    name,
    args: [...args],
    expected,
    polarity: CasePolarity.Negative,
    mode: CaseMode.Throws,
  };
}

export function rejected(name: string, args: readonly unknown[], expected: unknown): NegativeCase {
  return {
    name,
    args: [...args],
    expected,
    polarity: CasePolarity.Negative,
    mode: CaseMode.Returns,
  };
}

async function assertCase(subject: TestSubject, item: UnitCase): Promise<void> {
  const call = async () => Reflect.apply(subject, undefined, item.args);
  if (item.mode === CaseMode.Throws) {
    const error = await thrownBy(call);
    expect(error).toBeDefined();
    expect(error).toMatchObject(item.expected as object);
    return;
  }
  expect(await call()).toEqual(item.expected);
}

export function unit(
  subject: TestSubject,
  suite: UnitSuite,
  timeout?: number,
  schedule = TestSchedule.Sequential,
): void {
  const parsed = UnitSuiteSchema.parse(suite);
  const register =
    TestScheduleSchema.parse(schedule) === TestSchedule.Concurrent ? test.concurrent : test.serial;
  describe(subject.name, () => {
    register.each(parsed.positive)(
      TestLabel.Positive,
      async (item) => assertCase(subject, item),
      timeout,
    );
    register.each(parsed.negative)(
      TestLabel.Negative,
      async (item) => assertCase(subject, item),
      timeout,
    );
  });
}

export { assertRecoveryCheckpoint } from "./recovery-checkpoint.ts";
export { observeVendorRecovery, vendorRecoveryWorkflow } from "./vendor-recovery.ts";
export { inspectVendorRetry, observeVendorRetry } from "./vendor-retry.ts";
