import { Backend, VendorStubMode } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const recovered = {
  passed: true,
  attempt: 1,
  refutations: 0,
  workerExecutions: 1,
  checkerExecutions: 2,
  sessionPreserved: true,
  checkpointPreserved: true,
  delivered: true,
  originalPreserved: true,
  artifactClean: true,
};
const exhausted = { ...recovered, passed: false, checkerExecutions: 1, delivered: false };

export const sdkProcessRecoveryCases = {
  positive: [
    positive(
      "Codex checker continues after SIGKILL and daemon restart",
      [Backend.Codex, true, 1],
      recovered,
    ),
    positive(
      "Codex checker continues after graceful daemon restart",
      [Backend.Codex, false, 1],
      recovered,
    ),
    positive(
      "Claude checker continues after SIGKILL and daemon restart",
      [Backend.Claude, true, 1],
      recovered,
    ),
    positive(
      "Claude checker continues after graceful daemon restart",
      [Backend.Claude, false, 1],
      recovered,
    ),
    positive(
      "Codex delayed interruption remains within the daemon budget",
      [Backend.Codex, true, 1, VendorStubMode.DelayedRecoverOnce],
      recovered,
    ),
    positive(
      "Claude delayed interruption remains within the daemon budget",
      [Backend.Claude, false, 1, VendorStubMode.DelayedRecoverOnce],
      recovered,
    ),
  ],
  negative: [
    rejected(
      "Codex replacement initialization cannot replace an installed checkpoint",
      [Backend.Codex, true, 1, VendorStubMode.RecoverReplacedSession],
      { ...recovered, passed: false, delivered: false },
    ),
    rejected(
      "Claude replacement initialization cannot replace an installed checkpoint",
      [Backend.Claude, false, 1, VendorStubMode.RecoverReplacedSession],
      { ...recovered, passed: false, delivered: false },
    ),
    rejected(
      "Codex late replacement after restart cannot publish",
      [Backend.Codex, false, 1, VendorStubMode.RecoverReplacedResult],
      { ...recovered, passed: false, delivered: false },
    ),
    rejected(
      "Claude late replacement after restart cannot publish",
      [Backend.Claude, true, 1, VendorStubMode.RecoverReplacedResult],
      { ...recovered, passed: false, delivered: false },
    ),
    rejected(
      "Codex delayed exhausted allowance cannot refill",
      [Backend.Codex, false, 0, VendorStubMode.DelayedRecoverOnce],
      exhausted,
    ),
    rejected(
      "Claude delayed exhausted allowance cannot refill",
      [Backend.Claude, true, 0, VendorStubMode.DelayedRecoverOnce],
      exhausted,
    ),
    rejected("Codex exhausted allowance survives SIGKILL", [Backend.Codex, true, 0], exhausted),
    rejected(
      "Codex exhausted allowance survives graceful restart",
      [Backend.Codex, false, 0],
      exhausted,
    ),
    rejected("Claude exhausted allowance survives SIGKILL", [Backend.Claude, true, 0], exhausted),
    rejected(
      "Claude exhausted allowance survives graceful restart",
      [Backend.Claude, false, 0],
      exhausted,
    ),
  ],
};

export const runtimeBackendCases = {
  positive: [
    positive("runtime composes configured Codex SDK", [Backend.Codex, false], {
      passed: true,
      blocked: false,
    }),
    positive("runtime composes configured Claude SDK", [Backend.Claude, false], {
      passed: true,
      blocked: false,
    }),
  ],
  negative: [
    rejected("missing Codex executable blocks without fallback", [Backend.Codex, true], {
      passed: false,
      blocked: true,
    }),
    rejected("missing Claude executable blocks without fallback", [Backend.Claude, true], {
      passed: false,
      blocked: true,
    }),
  ],
};
