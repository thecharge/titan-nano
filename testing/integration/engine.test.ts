import { afterEach, test } from "bun:test";
import { unit } from "@titan/test-factories";
import { groupedRunCases, keptInputCases } from "../cases/workflow.ts";
import {
  engineCapacityCancellation,
  engineContractCleanup,
  engineExhaustedRecovery,
  engineMalformedChecker,
  engineMixedArtifacts,
  engineParallelConflicts,
  engineQualityEvidence,
  engineRestartedChecker,
  engineSameSessionRecovery,
  engineTornJournal,
  engineUnsafeSnapshot,
} from "../factories/engine-contract.ts";
import { groupedRun, keptInput } from "../factories/workflow.ts";

afterEach(engineContractCleanup);
test("mixed graph produces artifacts without editing the original project", engineMixedArtifacts);
test(
  "retryable interruption continues the same session and quality attempt",
  engineSameSessionRecovery,
);
test("recovery exhaustion blocks and does not become a refutation", engineExhaustedRecovery);
test(
  "refutation spends a quality attempt and carries evidence to the next worker",
  engineQualityEvidence,
);
test("malformed checker output blocks instead of passing or refuting", engineMalformedChecker);
test("parallel file conflicts block final assembly", engineParallelConflicts);
test("durable board recovers after an incomplete trailing write", engineTornJournal);
test(
  "blocked invocation survives an engine restart without rerunning completed work",
  engineRestartedChecker,
);
test("cancelled capacity wait leaves the running job alone", engineCapacityCancellation);
test("snapshot paths cannot escape their destination", engineUnsafeSnapshot);

unit(groupedRun, groupedRunCases);

unit(keptInput, keptInputCases);
