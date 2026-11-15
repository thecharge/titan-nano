import { ErrorCode, JsonEncoding, JsonFixture } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

const invalid = { code: ErrorCode.JsonEncoding };
const limit = { code: ErrorCode.StreamLimit };
export const jsonEncodingCases = {
  positive: [
    positive("UTF-8 object keys fit their exact allowance", [JsonFixture.Value, { é: 0 }, 8], true),
    positive(
      "escaped object keys fit their exact allowance",
      [JsonFixture.Value, { "\u0000": 0 }, 12],
      true,
    ),
    positive("null has exact JSON bytes", [JsonFixture.Value, null, 4], true),
    positive("boolean has exact JSON bytes", [JsonFixture.Value, true, 4], true),
    positive("finite number has exact JSON bytes", [JsonFixture.Value, -12.5, 5], true),
    positive("empty string uses two bytes", [JsonFixture.Value, "", 2], true),
    positive(
      "empty object and arrays remain JSON",
      [JsonFixture.Value, { first: [], second: {} }],
      true,
    ),
    positive(
      "mixed structured values preserve order",
      [JsonFixture.Value, { rows: [1, false, null, 'quote"\n😀'], empty: "" }],
      true,
    ),
    positive("null object prototype is supported", [JsonFixture.NullObject, 1], true),
    positive("null array prototype is supported", [JsonFixture.NullArray, 1], true),
    positive(
      "surrogate pair crossing chunk boundary is preserved",
      [JsonFixture.PairBoundary],
      true,
    ),
    positive(
      "control characters and lone surrogates are escaped",
      [JsonFixture.Value, '\u0000\u0001\b\f\n\r\t\\"\ud800-\udfff'],
      true,
    ),
    positive(
      "maximum nesting remains supported",
      [JsonFixture.Deep, JsonEncoding.MaximumDepth],
      true,
    ),
    positive("shared references are not mistaken for cycles", [JsonFixture.Repeated, 3], true),
  ],
  negative: [
    negative(
      "UTF-8 object keys exceed a smaller allowance",
      [JsonFixture.Value, { é: 0 }, 7],
      limit,
    ),
    negative(
      "escaped object keys exceed a smaller allowance",
      [JsonFixture.Value, { "\u0000": 0 }, 11],
      limit,
    ),
    negative("null cannot exceed exact allowance", [JsonFixture.Value, null, 3], limit),
    negative("quoted string counts delimiters", [JsonFixture.Value, "", 1], limit),
    negative("UTF-8 bytes determine allowance", [JsonFixture.Value, "é", 3], limit),
    negative("escape expansion determines allowance", [JsonFixture.Value, "\u0000", 7], limit),
    negative(
      "repeated input stops before full expansion",
      [JsonFixture.Repeated, 20000, 128],
      limit,
    ),
    negative("cycle is refused", [JsonFixture.Cycle], invalid),
    negative(
      "excessive nesting is refused",
      [JsonFixture.Deep, JsonEncoding.MaximumDepth + 1],
      invalid,
    ),
    negative("getter properties are refused", [JsonFixture.Accessor], invalid),
    negative("setter properties are refused", [JsonFixture.Setter], invalid),
    negative("sparse array is refused", [JsonFixture.Sparse], invalid),
    negative("big integer is refused", [JsonFixture.BigInt], invalid),
    negative("symbol is refused", [JsonFixture.Symbol], invalid),
    negative("function is refused", [JsonFixture.Function], invalid),
    negative("custom serialization instance is refused", [JsonFixture.Date], invalid),
    negative("undefined is refused", [JsonFixture.Undefined], invalid),
    negative("nested undefined is refused", [JsonFixture.Value, { nested: undefined }], invalid),
    negative("infinity is refused", [JsonFixture.Value, Number.POSITIVE_INFINITY], invalid),
    negative("not-a-number is refused", [JsonFixture.Value, Number.NaN], invalid),
    negative("zero limit is refused", [JsonFixture.Value, null, 0], {
      code: ErrorCode.InvalidStreamLimit,
    }),
    negative("fractional limit is refused", [JsonFixture.Value, null, 1.5], {
      code: ErrorCode.InvalidStreamLimit,
    }),
  ],
};
