import { ErrorCode, UsageReport, UsageTransport } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const partial = {
  executions: 2,
  reported: 2,
  unreported: 0,
  known: { input_tokens: 0, output_tokens: 0, cost_usd: 0 },
  complete: { input_tokens: false, output_tokens: false, cost_usd: false },
};
export const usageTransportCases = {
  positive: Object.values(UsageTransport).flatMap((transport) => [
    positive(`${transport} preserves unknown native measures`, [transport], partial),
    positive(
      `${transport} executable delivery retains accounting`,
      [transport, true, true],
      partial,
    ),
  ]),
  negative: Object.values(UsageTransport).flatMap((transport) =>
    transport === UsageTransport.Mcp
      ? [
          rejected("MCP missing run cannot produce totals", [transport, false], { error: true }),
          rejected("MCP executable missing run cannot produce totals", [transport, false, true], {
            error: true,
          }),
        ]
      : [
          negative(`${transport} missing run cannot produce totals`, [transport, false], {
            code: ErrorCode.RunNotFound,
          }),
          negative(
            `${transport} executable missing run cannot produce totals`,
            [transport, false, true],
            { code: ErrorCode.RunNotFound },
          ),
        ],
  ),
};
const report = {
  schema_version: UsageReport.Version,
  run_id: "run",
  through: 8,
  executions: 2,
  reported_executions: 2,
  unreported_executions: 0,
  known: { input_tokens: 4, output_tokens: 3, cost_usd: 0.03 },
  complete: { input_tokens: true, output_tokens: true, cost_usd: true },
};
const incomplete = {
  ...report,
  executions: 3,
  unreported_executions: 1,
  complete: { input_tokens: false, output_tokens: false, cost_usd: false },
};
export const usageResponseCases = {
  positive: [
    positive("complete known measures are retained", [report], report),
    positive("partial subtotal retains its missing execution", [incomplete], incomplete),
    positive(
      "no started execution has a zero subtotal",
      [
        {
          ...report,
          executions: 0,
          reported_executions: 0,
          known: { input_tokens: 0, output_tokens: 0, cost_usd: 0 },
        },
      ],
      {
        ...report,
        executions: 0,
        reported_executions: 0,
        known: { input_tokens: 0, output_tokens: 0, cost_usd: 0 },
      },
    ),
  ],
  negative: [
    negative(
      "unreported execution cannot be complete",
      [{ ...incomplete, complete: report.complete }],
      { code: ErrorCode.InvalidResponse },
    ),
    negative(
      "no report cannot invent a subtotal",
      [{ ...incomplete, reported_executions: 0, unreported_executions: 3 }],
      { code: ErrorCode.InvalidResponse },
    ),
    negative("foreign run is refused", [{ ...report, run_id: "another" }], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("missing schema is refused", [{}], { code: ErrorCode.InvalidResponse }),
    negative("contradictory counts are refused", [{ ...report, executions: 3 }], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("unknown fields are refused", [{ ...report, guessed_cost: 0 }], {
      code: ErrorCode.InvalidResponse,
    }),
    negative(
      "negative cost is refused",
      [{ ...report, known: { ...report.known, cost_usd: -1 } }],
      { code: ErrorCode.InvalidResponse },
    ),
  ],
};
export const usageHttpRouteCases = {
  positive: [
    positive("exact route is admitted", [], 200),
    positive("empty query retains exact route", ["usage", "?"], 200),
  ],
  negative: [
    rejected("unknown query cannot alter totals", ["usage", "?cursor=1"], 400),
    rejected("extra path cannot qualify usage", ["usage/extra"], 400),
    rejected("POST cannot mutate usage", ["usage", "", "POST"], 400),
  ],
};
