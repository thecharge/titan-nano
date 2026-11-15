import { Backend, UsageBackendSource } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const cumulative = [
  { input_tokens: 11, output_tokens: 7, cost_usd: 0.01 },
  { input_tokens: 22, output_tokens: 14, cost_usd: 0.02 },
  { input_tokens: 33, output_tokens: 21, cost_usd: 0.03 },
];
const complete = { input_tokens: true, output_tokens: true, cost_usd: true };
const recoveryReports = cumulative.map((report, index) => ({
  ...report,
  cost_usd: (index + 1) / 8,
}));
export const reconciliationUsageCases = {
  positive: [
    positive(
      "a Claude reconciliation uses cumulative counters across restart",
      [Backend.Claude, recoveryReports],
      { known: { input_tokens: 38, output_tokens: 23, cost_usd: 0.5 }, complete },
    ),
    positive(
      "a Codex reconciliation adds each turn across restart",
      [Backend.Codex, recoveryReports],
      {
        known: { input_tokens: 71, output_tokens: 44, cost_usd: 0.875 },
        complete,
      },
    ),
  ],
  negative: [
    rejected(
      "a regressed Claude reconciliation counter remains incomplete",
      [
        Backend.Claude,
        [recoveryReports[0], { ...recoveryReports[1], input_tokens: 5 }, recoveryReports[2]],
      ],
      {
        known: { input_tokens: 38, output_tokens: 23, cost_usd: 0.5 },
        complete: { ...complete, input_tokens: false },
      },
    ),
    rejected(
      "unknown Codex reconciliation cost remains incomplete",
      [
        Backend.Codex,
        [recoveryReports[0], { ...recoveryReports[1], cost_usd: null }, recoveryReports[2]],
      ],
      {
        known: { input_tokens: 71, output_tokens: 44, cost_usd: 0.625 },
        complete: { ...complete, cost_usd: false },
      },
    ),
  ],
};
export const usageSemanticsCases = {
  positive: [
    positive(
      "switching from Claude to Codex retains the earlier cumulative subtotal",
      [UsageBackendSource.Run, Backend.Claude, recoveryReports, true, Backend.Codex],
      { known: { input_tokens: 55, output_tokens: 35, cost_usd: 0.625 }, complete },
    ),
    positive(
      "switching from Codex to Claude retains earlier additive reports",
      [UsageBackendSource.Run, Backend.Codex, recoveryReports, true, Backend.Claude],
      { known: { input_tokens: 66, output_tokens: 42, cost_usd: 0.75 }, complete },
    ),
    positive(
      "persona Claude counters contribute their session total once",
      [UsageBackendSource.Persona, Backend.Claude, cumulative],
      { known: cumulative[2], complete },
    ),
    positive(
      "default Claude counters retain their total across reload",
      [UsageBackendSource.Defaults, Backend.Claude, cumulative, true],
      { known: cumulative[2], complete },
    ),
    positive(
      "run Codex counters remain additive per turn",
      [UsageBackendSource.Run, Backend.Codex, cumulative],
      { known: { input_tokens: 66, output_tokens: 42, cost_usd: 0.06 }, complete },
    ),
    positive(
      "equal Codex records remain distinct after reload",
      [UsageBackendSource.Run, Backend.Codex, [cumulative[0], cumulative[0], cumulative[0]], true],
      { known: { input_tokens: 33, output_tokens: 21, cost_usd: 0.03 }, complete },
    ),
  ],
  negative: [
    rejected(
      "a switch to Codex cannot invent missing cost",
      [
        UsageBackendSource.Run,
        Backend.Claude,
        [recoveryReports[0], recoveryReports[1], { ...recoveryReports[2], cost_usd: null }],
        true,
        Backend.Codex,
      ],
      {
        known: { input_tokens: 55, output_tokens: 35, cost_usd: 0.25 },
        complete: { ...complete, cost_usd: false },
      },
    ),
    rejected(
      "a switch to Claude cannot invent missing cost",
      [
        UsageBackendSource.Run,
        Backend.Codex,
        [recoveryReports[0], recoveryReports[1], { ...recoveryReports[2], cost_usd: null }],
        true,
        Backend.Claude,
      ],
      {
        known: { input_tokens: 66, output_tokens: 42, cost_usd: 0.375 },
        complete: { ...complete, cost_usd: false },
      },
    ),
    rejected(
      "a regressed Claude input counter cannot claim complete usage",
      [
        UsageBackendSource.Persona,
        Backend.Claude,
        [cumulative[0], { ...cumulative[1], input_tokens: 5 }, cumulative[2]],
        true,
      ],
      { known: cumulative[2], complete: { ...complete, input_tokens: false } },
    ),
    rejected(
      "a regressed Claude cost retains a conservative subtotal",
      [UsageBackendSource.Defaults, Backend.Claude, [cumulative[2], cumulative[0], cumulative[1]]],
      {
        known: cumulative[2],
        complete: { input_tokens: false, output_tokens: false, cost_usd: false },
      },
    ),
    rejected(
      "unknown cumulative cost stays incomplete after a later report",
      [
        UsageBackendSource.Persona,
        Backend.Claude,
        [cumulative[0], { ...cumulative[1], cost_usd: null }, cumulative[2]],
        true,
      ],
      { known: cumulative[2], complete: { ...complete, cost_usd: false } },
    ),
    rejected(
      "an unknown first cumulative token count does not invent a zero",
      [
        UsageBackendSource.Defaults,
        Backend.Claude,
        [{ ...cumulative[0], input_tokens: null }, cumulative[1], cumulative[2]],
      ],
      { known: cumulative[2], complete: { ...complete, input_tokens: false } },
    ),
  ],
};
