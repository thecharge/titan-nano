import { Backend, VendorStubMode } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const operationalPeerCases = {
  positive: [
    positive(
      "Codex completes both independent branches",
      [Backend.Codex, true, VendorStubMode.Complete],
      true,
    ),
    positive(
      "Claude completes both independent branches",
      [Backend.Claude, false, VendorStubMode.Complete],
      true,
    ),
  ],
  negative: [
    rejected(
      "Claude worker exhausted credits blocks while its peer completes",
      [Backend.Claude, true, VendorStubMode.QuotaExhausted],
      true,
    ),
    rejected(
      "Claude checker exhausted credits keeps its candidate and peer",
      [Backend.Claude, false, VendorStubMode.QuotaExhausted],
      true,
    ),
    rejected(
      "Claude worker billing credit exhaustion blocks without busy retries",
      [Backend.Claude, true, VendorStubMode.QuotaBilling],
      true,
    ),
    rejected(
      "Claude checker billing credit exhaustion keeps completed work",
      [Backend.Claude, false, VendorStubMode.QuotaBilling],
      true,
    ),
    rejected(
      "Codex worker exit retains progress while its peer completes",
      [Backend.Codex, true, VendorStubMode.Exit],
      true,
    ),
    rejected(
      "Codex checker exit retains its candidate while its peer completes",
      [Backend.Codex, false, VendorStubMode.Exit],
      true,
    ),
    rejected(
      "Claude worker exit retains progress while its peer completes",
      [Backend.Claude, true, VendorStubMode.Exit],
      true,
    ),
    rejected(
      "Claude checker exit retains its candidate while its peer completes",
      [Backend.Claude, false, VendorStubMode.Exit],
      true,
    ),
    rejected(
      "Claude worker billing refusal blocks without automatic retry",
      [Backend.Claude, true, VendorStubMode.BillingRetry],
      true,
    ),
    rejected(
      "Claude checker billing refusal blocks without automatic retry",
      [Backend.Claude, false, VendorStubMode.BillingRetry],
      true,
    ),
  ],
};
