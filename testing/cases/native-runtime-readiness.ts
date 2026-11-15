import { NativeRuntimeFixture, NativeToolRole } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeRuntimeReadinessCases = {
  positive: [
    positive(
      "worker task waits for exact connected inventory",
      [NativeToolRole.Worker, NativeRuntimeFixture.Ready],
      true,
    ),
    positive(
      "checker accepts its exact prefixed inventory",
      [NativeToolRole.Checker, NativeRuntimeFixture.Prefixed],
      true,
    ),
    positive(
      "pending connection releases no task until connected",
      [NativeToolRole.Worker, NativeRuntimeFixture.Pending],
      true,
    ),
  ],
  negative: [
    rejected(
      "failed native connection cannot release task",
      [NativeToolRole.Worker, NativeRuntimeFixture.Failed],
      true,
    ),
    rejected(
      "incomplete checker inventory cannot release task",
      [NativeToolRole.Checker, NativeRuntimeFixture.Inventory],
      true,
    ),
    rejected(
      "duplicate inventory cannot replace a required tool",
      [NativeToolRole.Worker, NativeRuntimeFixture.Duplicate],
      true,
    ),
    rejected(
      "missing native server cannot release task",
      [NativeToolRole.Checker, NativeRuntimeFixture.Missing],
      true,
    ),
    rejected(
      "pending connection reaches its deadline",
      [NativeToolRole.Worker, NativeRuntimeFixture.Deadline],
      true,
    ),
    rejected(
      "caller cancellation closes blocked native query",
      [NativeToolRole.Checker, NativeRuntimeFixture.Cancelled],
      true,
    ),
    rejected(
      "initialization failure closes without task delivery",
      [NativeToolRole.Worker, NativeRuntimeFixture.Initialize],
      true,
    ),
    rejected(
      "status failure cannot disclose private diagnostics",
      [NativeToolRole.Checker, NativeRuntimeFixture.Status],
      true,
    ),
  ],
};
