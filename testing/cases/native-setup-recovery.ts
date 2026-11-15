import { ExecutionDelivery, NativeSetupFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeSetupRecoveryCases = {
  positive: [
    positive(
      "worker owner refusal resumes without a false verdict",
      [NativeSetupFixture.Owner, true, false],
      true,
    ),
    positive(
      "checker owner refusal resumes after reload",
      [NativeSetupFixture.Owner, false, true],
      true,
    ),
    positive(
      "worker bound validation refusal resumes after reload",
      [NativeSetupFixture.Validation, true, true],
      true,
    ),
    positive(
      "checker bound validation refusal resumes",
      [NativeSetupFixture.Validation, false, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "uncertain worker startup cannot repeat without a session",
      [NativeSetupFixture.Dispatch, true, true],
      true,
    ),
    rejected(
      "uncertain checker startup cannot repeat without a session",
      [NativeSetupFixture.Dispatch, false, false],
      true,
    ),
    rejected(
      "legacy worker record cannot imply safe delivery",
      [NativeSetupFixture.Legacy, true, true],
      true,
    ),
    rejected(
      "legacy checker record cannot imply safe delivery",
      [NativeSetupFixture.Legacy, false, true],
      true,
    ),
    rejected(
      "worker setup refusal cannot refill recovery allowance",
      [NativeSetupFixture.Exhausted, true, true],
      true,
    ),
    rejected(
      "checker setup refusal cannot refill recovery allowance",
      [NativeSetupFixture.Exhausted, false, false],
      true,
    ),
  ],
};

export const nativeSetupRecordCases = {
  positive: [
    positive("prepared reservation has no dispatch", [ExecutionDelivery.Prepared, 0], true),
    positive("uncertain delivery retains its dispatch", [ExecutionDelivery.Uncertain, 1], true),
    positive("legacy phase has no fabricated proof", [undefined, undefined], true),
  ],
  negative: [
    rejected(
      "uncertain delivery cannot erase its dispatch",
      [ExecutionDelivery.Uncertain, 0],
      false,
    ),
    rejected(
      "prepared delivery cannot include its current dispatch",
      [ExecutionDelivery.Prepared, 1],
      false,
    ),
    rejected("dispatch count cannot exceed reservations", [ExecutionDelivery.Uncertain, 2], false),
    rejected("dispatch count without delivery state is invalid", [undefined, 0], false),
    rejected(
      "unknown delivery state cannot imply setup proof",
      [NativeSetupFixture.Owner, 0],
      false,
    ),
  ],
};
