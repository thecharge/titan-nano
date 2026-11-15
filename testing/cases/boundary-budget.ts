import { BoundaryReadLimit, ErrorCode, TypeScriptPolicy } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

export const boundaryBudgetCases = {
  positive: [
    ...TypeScriptPolicy.SourceExtensions.map((extension) =>
      positive(
        `boundary inventory includes ${extension}`,
        [["export const value = 1;"], {}, 1, undefined, extension],
        1,
      ),
    ),
    positive(
      "ordinary source fits exact byte allowance",
      [["export const value = 1;"], { source_bytes: 23 }],
      1,
    ),
    positive("UTF-8 allowance counts bytes", [["éé"], { source_bytes: 4 }], 1),
    positive("both workspace parents can be empty", [[], {}, 0], 0),
    positive(
      "several bounded packages remain readable",
      [["export {};"], { max_workspaces: 2 }, 2],
      2,
    ),
  ],
  negative: [
    ...TypeScriptPolicy.SourceExtensions.map((extension) =>
      negative(
        `boundary ${extension} read retains byte limits`,
        [["export const value = 1;"], { source_bytes: 1 }, 1, undefined, extension],
        { code: ErrorCode.StreamLimit },
      ),
    ),
    negative(
      "default source budget rejects an oversized file",
      [["x".repeat(BoundaryReadLimit.SourceBytes + 1)]],
      { code: ErrorCode.StreamLimit },
    ),
    negative(
      "default manifest budget rejects an oversized document",
      [
        ["export {};"],
        {},
        1,
        JSON.stringify({
          name: "@fixture/package",
          exports: { ".": "./src/index.ts" },
          description: "x".repeat(BoundaryReadLimit.ManifestBytes),
        }),
      ],
      { code: ErrorCode.StreamLimit },
    ),
    negative(
      "empty package names fail schema admission",
      [["export {};"], {}, 1, JSON.stringify({ name: "" })],
      { name: "ZodError" },
    ),
    negative(
      "exhausted aggregate budget stops the next read",
      [
        ["x".repeat(80), "y".repeat(80)],
        {
          source_bytes: 100,
          total_bytes:
            Buffer.byteLength(
              JSON.stringify({ name: "@fixture/package-0", exports: { ".": "./src/index.ts" } }),
            ) + 80,
        },
      ],
      { code: ErrorCode.VerificationBudget },
    ),
    negative("source over its byte cap fails", [["x".repeat(80)], { source_bytes: 64 }], {
      code: ErrorCode.StreamLimit,
    }),
    negative("UTF-8 cannot use character count as bytes", [["éé"], { source_bytes: 3 }], {
      code: ErrorCode.StreamLimit,
    }),
    negative("manifest over its byte cap fails", [["export {};"], { manifest_bytes: 16 }], {
      code: ErrorCode.StreamLimit,
    }),
    negative(
      "aggregate retained bytes are bounded",
      [["x".repeat(80), "y".repeat(80)], { source_bytes: 100, total_bytes: 200 }],
      { code: ErrorCode.StreamLimit },
    ),
    negative(
      "aggregate budget cannot be reused by a later package",
      [["x".repeat(80)], { total_bytes: 220 }, 2],
      { code: ErrorCode.StreamLimit },
    ),
    negative("workspace entry budget fails closed", [["export {};"], { max_workspaces: 1 }, 2], {
      code: ErrorCode.VerificationBudget,
    }),
    negative(
      "source entry budget fails closed",
      [["export {};", "export {};"], { max_sources: 1 }],
      { code: ErrorCode.VerificationBudget },
    ),
    negative("malformed manifest cannot bypass admission", [["export {};"], {}, 1, "{"], {
      name: "SyntaxError",
    }),
    negative(
      "invalid manifest shape cannot be asserted valid",
      [["export {};"], {}, 1, JSON.stringify({ name: 3 })],
      { name: "ZodError" },
    ),
    negative("zero limits are refused", [[], { max_sources: 0 }], { name: "ZodError" }),
    negative(
      "limits cannot exceed the owner ceiling",
      [[], { total_bytes: BoundaryReadLimit.TotalBytes + 1 }],
      { name: "ZodError" },
    ),
    negative("unknown limits cannot silently suppress reading", [[], { skip: true }], {
      name: "ZodError",
    }),
  ],
};
